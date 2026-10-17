import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { issueEmailLinkToken } from "@/lib/services/continuation";
import { verifyAndApply } from "@/lib/services/payments";
import { getEvent } from "@/lib/services/event";
import { sendEmail } from "@/lib/email/send";
import {
  alreadyRegisteredEmail,
  noPaymentFoundEmail,
  paymentOnHoldEmail,
  recoveryEmail,
} from "@/lib/email/templates";

/**
 * Recovery for participants who paid but could not finish the form.
 *
 * 1. Re-checks any of this email's unsettled checkouts with Flutterwave (covers
 *    "paid, then closed the browser before the webhook arrived").
 * 2. Always emails the inbox owner the next step: a single-use link (paid,
 *    form unfinished), their registration number (already registered), a
 *    reassurance (paid after the event filled), or how to start (no payment).
 *
 * The caller always shows the same generic message, so this cannot be used
 * to discover whether an email address has registered.
 */
export type RecoveryOutcome = "link" | "already_registered" | "on_hold" | "no_payment" | "payment_received" | "no_event";

export async function requestRecovery(
  rawEmail: string,
  now = new Date(),
): Promise<{ outcome: RecoveryOutcome; emailSent: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  const event = await getEvent();
  if (!event) return { outcome: "no_event", emailSent: false };

  const unsettled = await db.registrationAttempt.findMany({
    where: {
      eventId: event.id,
      email,
      paymentStatus: { in: ["PENDING", "ABANDONED", "INITIATED"] },
      createdAt: { gt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  for (const attempt of unsettled) {
    const outcome = await verifyAndApply(attempt.paymentReference, "RECOVERY", { now }).catch((err) => {
      console.error("[recovery] verify failed", (err as Error).message);
      return null;
    });
    // Newly confirmed payments already received a "payment received" link.
    if (outcome?.kind === "processed" && outcome.becamePaid) return { outcome: "payment_received", emailSent: true };
  }

  const appUrl = env().APP_URL;
  const helpUrl = `${appUrl}/help`;

  // 1. Paid, form not finished → secure link.
  const paid = await db.registrationAttempt.findFirst({
    where: {
      eventId: event.id,
      email,
      paymentStatus: "PAID",
      reservationStatus: "HELD",
      registration: { is: null },
    },
    orderBy: { createdAt: "desc" },
  });
  if (paid) {
    const raw = await issueEmailLinkToken(db, paid.id, now);
    const { sent } = await sendEmail(recoveryEmail(email, `${appUrl}/register/resume/${raw}`));
    return { outcome: "link" as const, emailSent: sent };
  }

  // 2. Already registered → remind them, with their registration number.
  const registration = await db.registration.findFirst({
    where: { eventId: event.id, status: "CONFIRMED", attempt: { email }, participant: { erasedAt: null } },
    orderBy: { confirmedAt: "desc" },
    include: { participant: { select: { fullName: true } } },
  });
  if (registration) {
    const { sent } = await sendEmail(
      alreadyRegisteredEmail({
        to: email,
        fullName: registration.participant.fullName,
        registrationNumber: registration.registrationNumber,
        helpUrl,
      }),
    );
    return { outcome: "already_registered" as const, emailSent: sent };
  }

  // 3. Paid after the event filled up → reassure; organisers follow up.
  const onHold = await db.registrationAttempt.findFirst({
    where: { eventId: event.id, email, paymentStatus: "PAID", reservationStatus: "OVERFLOW" },
    orderBy: { createdAt: "desc" },
  });
  if (onHold) {
    const { sent } = await sendEmail(paymentOnHoldEmail({ to: email, publicRef: onHold.publicRef, helpUrl }));
    return { outcome: "on_hold" as const, emailSent: sent };
  }

  // 4. Nothing paid → explain, so nobody waits for an email that never comes.
  // (Per-email rate limits in the caller stop this being used to spam inboxes.)
  const { sent } = await sendEmail(noPaymentFoundEmail({ to: email, registerUrl: `${appUrl}/register`, helpUrl }));
  return { outcome: "no_payment" as const, emailSent: sent };
}
