import "server-only";
import { db } from "@/lib/db";
import { randomCode } from "@/lib/crypto";
import { lockAttempt } from "@/lib/services/event";
import { sendEmail } from "@/lib/email/send";
import { confirmationEmail } from "@/lib/email/templates";
import {
  ageOn,
  agePolicyErrors,
  registrationFormSchema,
  type RegistrationFormData,
} from "@/lib/validation/registration";

export type FormAccess =
  | { kind: "no_session" }
  | { kind: "awaiting_payment"; publicRef: string }
  | { kind: "payment_problem"; publicRef: string; paymentStatus: string }
  | { kind: "overflow"; publicRef: string }
  | { kind: "ready"; attemptId: string; email: string; publicRef: string }
  | { kind: "completed"; registrationId: string };

/**
 * Decides what a browser holding a (server-validated) session may see.
 * Only a *verified* PAID attempt holding a place unlocks the form.
 */
export async function getFormAccess(attemptId: string | null): Promise<FormAccess> {
  if (!attemptId) return { kind: "no_session" };
  const attempt = await db.registrationAttempt.findUnique({
    where: { id: attemptId },
    include: { registration: { select: { id: true } } },
  });
  if (!attempt) return { kind: "no_session" };
  if (attempt.registration) return { kind: "completed", registrationId: attempt.registration.id };
  if (attempt.paymentStatus === "PAID") {
    if (attempt.reservationStatus === "OVERFLOW") return { kind: "overflow", publicRef: attempt.publicRef };
    if (attempt.reservationStatus === "HELD") {
      return { kind: "ready", attemptId: attempt.id, email: attempt.email, publicRef: attempt.publicRef };
    }
    return { kind: "payment_problem", publicRef: attempt.publicRef, paymentStatus: "PAID_RELEASED" };
  }
  if (attempt.paymentStatus === "PENDING" || attempt.paymentStatus === "INITIATED") {
    return { kind: "awaiting_payment", publicRef: attempt.publicRef };
  }
  return { kind: "payment_problem", publicRef: attempt.publicRef, paymentStatus: attempt.paymentStatus };
}

export type SubmitResult =
  | { kind: "created"; registrationId: string; registrationNumber: string }
  | { kind: "already_completed"; registrationId: string }
  | { kind: "invalid"; fieldErrors: Record<string, string> }
  | { kind: "forbidden" };

export function newRegistrationNumber() {
  return `GGZ26-${randomCode(6)}`;
}

/**
 * Completes a registration for a verified, paid attempt. Safe against double
 * submission: the attempt row is locked and `Registration.attemptId` is
 * unique, so a second submit returns the existing registration.
 */
export async function submitRegistration(
  attemptId: string,
  rawInput: unknown,
  now = new Date(),
): Promise<SubmitResult> {
  const parsed = registrationFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { kind: "invalid", fieldErrors };
  }
  const data: RegistrationFormData = parsed.data;

  const result = await db.$transaction(async (tx) => {
    await lockAttempt(tx, attemptId);
    const attempt = await tx.registrationAttempt.findUnique({
      where: { id: attemptId },
      include: { registration: true, payment: true, event: true },
    });
    if (!attempt) return { kind: "forbidden" as const };
    if (attempt.registration) {
      return { kind: "already_completed" as const, registrationId: attempt.registration.id };
    }
    if (
      attempt.paymentStatus !== "PAID" ||
      attempt.reservationStatus !== "HELD" ||
      !attempt.payment ||
      attempt.payment.status !== "PAID"
    ) {
      return { kind: "forbidden" as const };
    }

    const ageErrors = agePolicyErrors(data, {
      minimumAge: attempt.event.minimumAge,
      guardianConsentAge: attempt.event.guardianConsentAge,
      eventStart: attempt.event.startDate,
    });
    if (Object.keys(ageErrors).length > 0) {
      return { kind: "invalid" as const, fieldErrors: ageErrors as Record<string, string> };
    }
    const needsGuardian = ageOn(data.dateOfBirth, attempt.event.startDate) < attempt.event.guardianConsentAge;

    const participant = await tx.participant.create({
      data: {
        fullName: data.fullName,
        email: attempt.email,
        phone: data.phone,
        dateOfBirth: new Date(`${data.dateOfBirth}T00:00:00Z`),
        cityOrState: data.cityOrState,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        supportNeeds: data.supportNeeds ?? null,
        guardianName: needsGuardian ? data.guardianName : null,
        guardianPhone: needsGuardian ? (data.guardianPhone ?? null) : null,
        guardianEmail: needsGuardian ? (data.guardianEmail ?? null) : null,
        guardianConsentAt: needsGuardian ? now : null,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        termsVersion: attempt.event.termsVersion,
      },
    });

    // Random numbers (31^6 ≈ 887M combinations). A failed INSERT would abort
    // the Postgres transaction, so check for a collision before inserting.
    let registrationNumber = newRegistrationNumber();
    for (let i = 0; await tx.registration.findUnique({ where: { registrationNumber } }); i++) {
      if (i >= 5) throw new Error("Could not allocate a unique registration number");
      registrationNumber = newRegistrationNumber();
    }
    const registration = await tx.registration.create({
      data: {
        registrationNumber,
        eventId: attempt.eventId,
        participantId: participant.id,
        attemptId: attempt.id,
        paymentId: attempt.payment.id,
        status: "CONFIRMED",
        formCompletedAt: now,
        confirmedAt: now,
      },
    });
    return {
      kind: "created" as const,
      registrationId: registration.id,
      registrationNumber: registration.registrationNumber,
      email: attempt.email,
      fullName: participant.fullName,
    };
  });

  if (result.kind === "created") {
    const { sent } = await sendEmail(
      confirmationEmail({
        to: result.email,
        fullName: result.fullName,
        registrationNumber: result.registrationNumber,
      }),
    );
    if (sent) {
      await db.registration.update({
        where: { id: result.registrationId },
        data: { confirmationEmailSentAt: new Date() },
      });
    }
    return { kind: "created", registrationId: result.registrationId, registrationNumber: result.registrationNumber };
  }
  return result;
}

/** Confirmation details for the participant who owns the session. */
export async function getConfirmation(attemptId: string | null) {
  if (!attemptId) return null;
  const registration = await db.registration.findUnique({
    where: { attemptId },
    include: { participant: { select: { fullName: true, email: true, erasedAt: true } }, event: true },
  });
  if (!registration || registration.participant.erasedAt) return null;
  return {
    registrationNumber: registration.registrationNumber,
    status: registration.status,
    fullName: registration.participant.fullName,
    email: registration.participant.email,
    confirmedAt: registration.confirmedAt,
    emailSent: Boolean(registration.confirmationEmailSentAt),
  };
}
