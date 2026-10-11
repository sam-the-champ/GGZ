import "server-only";
import { db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyTransaction, type VerifiedTransaction } from "@/lib/paystack/client";
import { getCapacitySnapshot, lockAttempt, lockEvent } from "@/lib/services/event";
import { issueEmailLinkToken } from "@/lib/services/continuation";
import { sendEmail } from "@/lib/email/send";
import { paymentReceivedEmail } from "@/lib/email/templates";
import type {
  PaymentStatus,
  RegistrationAttempt,
  ReservationStatus,
  VerificationSource,
} from "@/generated/prisma/client";

export type VerificationOutcome =
  | { kind: "unknown_reference" }
  | { kind: "not_found_at_provider"; attempt: RegistrationAttempt }
  | {
      kind: "processed";
      attempt: RegistrationAttempt;
      /** True only for the single call that moved this attempt to PAID. */
      becamePaid: boolean;
    };

/** Statuses after which provider data can no longer change our decision. */
const SETTLED: PaymentStatus[] = ["PAID", "MISMATCH", "REVERSED"];

type Decision = {
  paymentStatus: PaymentStatus;
  reservationStatus: ReservationStatus;
};

/**
 * Validates a Paystack transaction against the attempt it should belong to.
 * Pure function — easy to unit test.
 */
export function evaluateTransaction(
  attempt: Pick<RegistrationAttempt, "id" | "paymentReference" | "amountKobo" | "currency">,
  tx: VerifiedTransaction,
): { ok: true } | { ok: false; reason: string } {
  if (tx.reference !== attempt.paymentReference) return { ok: false, reason: "reference mismatch" };
  if (tx.metadataAttemptId && tx.metadataAttemptId !== attempt.id) {
    return { ok: false, reason: "transaction belongs to a different attempt" };
  }
  if (tx.amountKobo !== attempt.amountKobo) return { ok: false, reason: "amount mismatch" };
  if (tx.currency !== attempt.currency.toUpperCase()) return { ok: false, reason: "currency mismatch" };
  return { ok: true };
}

const PENDING_STATES = new Set(["ongoing", "pending", "processing", "queued"]);

/**
 * Verifies a payment reference with Paystack's API and applies the result.
 *
 * Idempotent: webhooks, browser callbacks, recovery and reconciliation may all
 * call this for the same reference, in any order and any number of times. The
 * event + attempt rows are locked (in that order) and a settled attempt is
 * never changed again, so duplicate deliveries cannot create duplicate
 * payments, double-count places or send duplicate emails.
 */
export async function verifyAndApply(
  reference: string,
  source: VerificationSource,
  options: { cancelled?: boolean; now?: Date } = {},
): Promise<VerificationOutcome> {
  const now = options.now ?? new Date();
  const existing = await db.registrationAttempt.findUnique({ where: { paymentReference: reference } });
  if (!existing) return { kind: "unknown_reference" };
  if (SETTLED.includes(existing.paymentStatus)) {
    return { kind: "processed", attempt: existing, becamePaid: false };
  }

  // Network call happens outside the transaction so no lock is held while waiting.
  const providerTx = await verifyTransaction(reference);

  if (!providerTx) {
    if (options.cancelled) {
      const attempt = await releaseUnpaid(existing.id, "ABANDONED", now);
      return { kind: "processed", attempt, becamePaid: false };
    }
    return { kind: "not_found_at_provider", attempt: existing };
  }

  const result = await db.$transaction(async (tx) => {
    await lockEvent(tx, existing.eventId);
    await lockAttempt(tx, existing.id);
    const attempt = await tx.registrationAttempt.findUniqueOrThrow({ where: { id: existing.id } });
    if (SETTLED.includes(attempt.paymentStatus)) {
      return { attempt, becamePaid: false };
    }

    const decision = await decide(tx, attempt, providerTx, now, options.cancelled ?? false);
    const updated = await tx.registrationAttempt.update({
      where: { id: attempt.id },
      data: decision,
    });

    const paymentFields = {
      reference: attempt.paymentReference,
      providerTransactionId: providerTx.providerId,
      expectedAmountKobo: attempt.amountKobo,
      expectedCurrency: attempt.currency,
      paidAmountKobo: providerTx.amountKobo,
      paidCurrency: providerTx.currency,
      status: decision.paymentStatus,
      channel: providerTx.channel,
      gatewayResponse: providerTx.gatewayResponse,
      customerEmail: providerTx.customerEmail,
      paidAt: providerTx.paidAt,
      verifiedAt: now,
      verificationSource: source,
    };
    await tx.payment.upsert({
      where: { attemptId: attempt.id },
      create: { attemptId: attempt.id, ...paymentFields },
      update: paymentFields,
    });

    return { attempt: updated, becamePaid: decision.paymentStatus === "PAID" };
  });

  if (result.becamePaid && result.attempt.reservationStatus === "HELD") {
    await sendPaymentReceivedEmail(result.attempt);
  }
  return { kind: "processed", ...result };
}

async function decide(
  tx: Tx,
  attempt: RegistrationAttempt,
  providerTx: VerifiedTransaction,
  now: Date,
  cancelled: boolean,
): Promise<Decision> {
  const status = providerTx.status;

  if (status === "success") {
    const check = evaluateTransaction(attempt, providerTx);
    if (!check.ok) {
      console.warn(`[payments] ${attempt.paymentReference}: ${check.reason}`);
      return { paymentStatus: "MISMATCH", reservationStatus: releasedFrom(attempt) };
    }
    return { paymentStatus: "PAID", reservationStatus: await placeForPaid(tx, attempt, now) };
  }

  if (status === "failed") {
    return { paymentStatus: "FAILED", reservationStatus: releasedFrom(attempt) };
  }

  if (status === "reversed") {
    return { paymentStatus: "REVERSED", reservationStatus: releasedFrom(attempt) };
  }

  if (status === "abandoned" && cancelled) {
    return { paymentStatus: "ABANDONED", reservationStatus: releasedFrom(attempt) };
  }

  // "abandoned" without an explicit cancel (checkout may still be open),
  // or a genuinely pending state: keep the reservation until it expires.
  if (status === "abandoned" || PENDING_STATES.has(status)) {
    return {
      paymentStatus: "PENDING",
      reservationStatus:
        attempt.reservationStatus === "ACTIVE" && attempt.reservationExpiresAt <= now
          ? "EXPIRED"
          : attempt.reservationStatus,
    };
  }

  console.warn(`[payments] ${attempt.paymentReference}: unrecognised Paystack status "${status}"`);
  return { paymentStatus: "PENDING", reservationStatus: attempt.reservationStatus };
}

function releasedFrom(attempt: RegistrationAttempt): ReservationStatus {
  return attempt.reservationStatus === "ACTIVE" ? "RELEASED" : attempt.reservationStatus;
}

/**
 * A verified payment keeps its place if its reservation is still live.
 * If the reservation lapsed (late payment), it gets a place only if one is
 * free right now; otherwise it is flagged OVERFLOW for organisers — the
 * system never oversells automatically.
 */
async function placeForPaid(tx: Tx, attempt: RegistrationAttempt, now: Date): Promise<ReservationStatus> {
  if (attempt.reservationStatus === "ACTIVE" && attempt.reservationExpiresAt > now) return "HELD";
  if (attempt.reservationStatus === "HELD") return "HELD";
  const event = await tx.event.findUniqueOrThrow({ where: { id: attempt.eventId } });
  const snap = await getCapacitySnapshot(tx, event, now, attempt.id);
  return snap.available != null && snap.available > 0 ? "HELD" : "OVERFLOW";
}

async function releaseUnpaid(attemptId: string, paymentStatus: PaymentStatus, now: Date) {
  return db.$transaction(async (tx) => {
    const current = await tx.registrationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    await lockEvent(tx, current.eventId);
    await lockAttempt(tx, attemptId);
    const attempt = await tx.registrationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (SETTLED.includes(attempt.paymentStatus)) return attempt;
    return tx.registrationAttempt.update({
      where: { id: attemptId },
      data: {
        paymentStatus,
        reservationStatus:
          attempt.reservationStatus === "ACTIVE" && attempt.reservationExpiresAt > now
            ? "RELEASED"
            : attempt.reservationStatus === "ACTIVE"
              ? "EXPIRED"
              : attempt.reservationStatus,
      },
    });
  });
}

export async function sendPaymentReceivedEmail(attempt: RegistrationAttempt) {
  try {
    const raw = await issueEmailLinkToken(db, attempt.id);
    const url = `${env().APP_URL}/register/resume/${raw}`;
    await sendEmail(paymentReceivedEmail(attempt.email, url));
  } catch (err) {
    // The payment is safely recorded; the participant can still recover.
    console.error("[payments] could not send payment-received email", (err as Error).message);
  }
}
