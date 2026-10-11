import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { issueEmailLinkToken } from "@/lib/services/continuation";
import { verifyAndApply } from "@/lib/services/payments";
import { getEvent } from "@/lib/services/event";
import { sendEmail } from "@/lib/email/send";
import { recoveryEmail } from "@/lib/email/templates";

/**
 * Recovery for participants who paid but could not finish the form.
 *
 * 1. Re-checks any of this email's unsettled checkouts with Paystack (covers
 *    "paid, then closed the browser before the webhook arrived").
 * 2. If a verified, unfinished payment exists, emails a single-use link.
 *
 * The caller always shows the same generic message, so this cannot be used
 * to discover whether an email address has registered.
 */
export async function requestRecovery(rawEmail: string, now = new Date()): Promise<{ emailSent: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  const event = await getEvent();
  if (!event) return { emailSent: false };

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
    if (outcome?.kind === "processed" && outcome.becamePaid) return { emailSent: true };
  }

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
  if (!paid) return { emailSent: false };

  const raw = await issueEmailLinkToken(db, paid.id, now);
  const { sent } = await sendEmail(recoveryEmail(email, `${env().APP_URL}/register/resume/${raw}`));
  return { emailSent: sent };
}
