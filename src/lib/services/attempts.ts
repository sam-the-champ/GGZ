import "server-only";
import { db } from "@/lib/db";
import { env, paymentsConfigured } from "@/lib/env";
import { generateToken, randomCode } from "@/lib/crypto";
import { initializeTransaction, PaymentProviderError } from "@/lib/flutterwave/client";
import { getCapacitySnapshot, getEvent, lockEvent, missingSetup } from "@/lib/services/event";
import { issueEmailLinkToken, issueSessionToken } from "@/lib/services/continuation";
import { verifyAndApply } from "@/lib/services/payments";
import { sendEmail } from "@/lib/email/send";
import { recoveryEmail } from "@/lib/email/templates";
import { site } from "@/content/site";

export type InitiateResult =
  | { kind: "checkout"; authorizationUrl: string; sessionToken: string; attemptId: string }
  | { kind: "not_configured" }
  | { kind: "closed" }
  | { kind: "full" }
  /** This email already has a verified, unfinished payment — never charge again. */
  | { kind: "already_paid"; emailSent: boolean }
  | { kind: "provider_error" };

export function newPaymentReference() {
  return `ggz_${generateToken(18)}`;
}

export function newPublicRef() {
  return `GGZ-${randomCode(8)}`;
}

/**
 * Starts (or resumes) a payment-first registration.
 *
 * Capacity is reserved inside a transaction holding a row lock on the event,
 * so concurrent requests are serialised and can never reserve more places
 * than the configured capacity. The payable amount always comes from the
 * database, never from the client.
 */
export async function initiateRegistration(input: {
  email: string;
  /** Attempt bound to this browser's existing session cookie, if any. */
  currentAttemptId?: string | null;
  now?: Date;
}): Promise<InitiateResult> {
  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();

  const event = await getEvent();
  if (!event || missingSetup(event).length > 0 || !paymentsConfigured()) return { kind: "not_configured" };
  if (!event.registrationOpen) return { kind: "closed" };

  // 1. Never ask someone to pay twice: a verified, unfinished payment for this
  //    email is recovered by emailed link (proving inbox ownership).
  const paidUnfinished = await db.registrationAttempt.findFirst({
    where: { eventId: event.id, email, paymentStatus: "PAID", registration: { is: null } },
    orderBy: { createdAt: "desc" },
  });
  if (paidUnfinished) {
    const raw = await issueEmailLinkToken(db, paidUnfinished.id, now);
    const { sent } = await sendEmail(
      recoveryEmail(email, `${env().APP_URL}/register/resume/${raw}`),
    );
    return { kind: "already_paid", emailSent: sent };
  }

  // 2. Resume this browser's own open checkout instead of creating a second
  //    reservation (protects against double charges on back/refresh).
  if (input.currentAttemptId) {
    const own = await db.registrationAttempt.findUnique({ where: { id: input.currentAttemptId } });
    if (
      own &&
      own.eventId === event.id &&
      own.email === email &&
      own.paymentStatus === "PENDING" &&
      own.reservationStatus === "ACTIVE" &&
      own.reservationExpiresAt > now &&
      own.authorizationUrl
    ) {
      // If it was actually paid meanwhile, record that instead of re-sending to checkout.
      const outcome = await verifyAndApply(own.paymentReference, "RECOVERY", { now }).catch(() => null);
      if (outcome?.kind === "processed" && outcome.attempt.paymentStatus === "PAID") {
        return { kind: "already_paid", emailSent: false };
      }
      const sessionToken = await issueSessionToken(db, own.id, now);
      return { kind: "checkout", authorizationUrl: own.authorizationUrl, sessionToken, attemptId: own.id };
    }
  }

  // 3. Reserve a place.
  const reserved = await db.$transaction(async (tx) => {
    await lockEvent(tx, event.id);
    const fresh = await tx.event.findUniqueOrThrow({ where: { id: event.id } });
    if (missingSetup(fresh).length > 0) return { kind: "not_configured" as const };
    if (!fresh.registrationOpen) return { kind: "closed" as const };
    const snap = await getCapacitySnapshot(tx, fresh, now);
    if (!snap.available || snap.available <= 0) return { kind: "full" as const };

    const attempt = await tx.registrationAttempt.create({
      data: {
        eventId: fresh.id,
        email,
        publicRef: newPublicRef(),
        paymentReference: newPaymentReference(),
        amountKobo: fresh.feeKobo!,
        currency: fresh.currency,
        paymentStatus: "INITIATED",
        reservationStatus: "ACTIVE",
        reservationExpiresAt: new Date(now.getTime() + fresh.reservationMinutes * 60_000),
      },
    });
    const sessionToken = await issueSessionToken(tx, attempt.id, now);
    return { kind: "reserved" as const, attempt, sessionToken };
  });

  if (reserved.kind !== "reserved") return reserved;
  const { attempt, sessionToken } = reserved;

  // 4. Create the Flutterwave checkout (server-side; amount from the attempt).
  const appUrl = env().APP_URL;
  try {
    const { authorizationUrl } = await initializeTransaction({
      email,
      amountKobo: attempt.amountKobo,
      currency: attempt.currency,
      reference: attempt.paymentReference,
      redirectUrl: `${appUrl}/register/callback`,
      meta: { attempt_id: attempt.id, public_ref: attempt.publicRef },
      title: `${site.eventName} — ${site.theme}`,
      description: `Registration fee · ${site.dates.label}`,
      // A bank-transfer account must not outlive the place being held for it.
      bankTransferExpirySeconds: Math.max(
        60,
        Math.floor((attempt.reservationExpiresAt.getTime() - Date.now()) / 1000),
      ),
    });
    await db.registrationAttempt.update({
      where: { id: attempt.id },
      data: { paymentStatus: "PENDING", authorizationUrl },
    });
    return { kind: "checkout", authorizationUrl, sessionToken, attemptId: attempt.id };
  } catch (err) {
    console.error("[attempts] Flutterwave checkout creation failed", err instanceof PaymentProviderError ? err.message : err);
    // Release the place immediately; no payment exists at Flutterwave.
    await db.registrationAttempt.update({
      where: { id: attempt.id },
      data: { paymentStatus: "FAILED", reservationStatus: "RELEASED" },
    });
    return { kind: "provider_error" };
  }
}
