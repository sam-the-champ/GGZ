"use server";

import { redirect } from "next/navigation";
import { getSessionAttemptId, setRegistrationCookie } from "@/lib/registration-cookie";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { initiateRegistration } from "@/lib/services/attempts";
import { submitRegistration } from "@/lib/services/registrations";
import { requestRecovery } from "@/lib/services/recovery";
import { consumeEmailLinkToken } from "@/lib/services/continuation";
import { verifyAndApply } from "@/lib/services/payments";
import { db } from "@/lib/db";
import { emailConfigured } from "@/lib/env";
import { startRegistrationSchema } from "@/lib/validation/registration";

export type StartState = { error?: string; notice?: string; email?: string };

export async function startRegistrationAction(_prev: StartState, formData: FormData): Promise<StartState> {
  const parsed = startRegistrationSchema.safeParse({ email: formData.get("email") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]!.message, email };
  if (formData.get("acceptPolicies") !== "on") {
    return { error: "Please confirm you have read the registration terms and refund policy.", email };
  }

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit("initiate", ip),
    rateLimit("initiateEmail", parsed.data.email),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", email };
  }

  const result = await initiateRegistration({
    email: parsed.data.email,
    currentAttemptId: await getSessionAttemptId(),
  });

  switch (result.kind) {
    case "checkout":
      await setRegistrationCookie(result.sessionToken);
      redirect(result.authorizationUrl);
    case "already_paid":
      return {
        notice: result.emailSent
          ? "You already have a verified payment with this email — you won't be charged again. We've emailed you a secure link to finish your registration."
          : "You already have a verified payment with this email — you won't be charged again. Use “Resume registration” or contact the organisers to finish your registration.",
        email,
      };
    case "full":
      return { error: "Sorry — camp is fully booked right now.", email };
    case "closed":
      return { error: "Registration is currently closed.", email };
    case "not_configured":
      return { error: "Registration has not opened yet.", email };
    case "provider_error":
      return {
        error: "We couldn't reach our payment provider. You have not been charged. Please try again in a moment.",
        email,
      };
  }
}

export async function recheckPaymentAction(formData: FormData) {
  const attemptId = await getSessionAttemptId();
  if (!attemptId) redirect("/register/resume");
  const ip = await clientIp();
  if ((await rateLimit("verify", ip)).ok) {
    const attempt = await db.registrationAttempt.findUnique({ where: { id: attemptId } });
    if (attempt) await verifyAndApply(attempt.paymentReference, "CALLBACK").catch(() => null);
  }
  void formData;
  redirect("/register/form");
}

export type SubmitState = { fieldErrors?: Record<string, string>; error?: string };

export async function submitRegistrationAction(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const attemptId = await getSessionAttemptId();
  if (!attemptId) return { error: "Your session has expired. Use “Resume registration” to get a new secure link." };
  if (!(await rateLimit("formSubmit", await clientIp())).ok) {
    return { error: "Too many submissions. Please wait a few minutes." };
  }
  const input = {
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    cityOrState: formData.get("cityOrState") ?? "",
    emergencyContactName: formData.get("emergencyContactName") ?? "",
    emergencyContactPhone: formData.get("emergencyContactPhone") ?? "",
    supportNeeds: formData.get("supportNeeds") ?? "",
    guardianName: formData.get("guardianName") ?? "",
    guardianPhone: formData.get("guardianPhone") ?? "",
    guardianEmail: formData.get("guardianEmail") ?? "",
    guardianConsent: formData.get("guardianConsent") === "on",
    acceptTerms: formData.get("acceptTerms") === "on",
    acceptPrivacy: formData.get("acceptPrivacy") === "on",
  };
  const result = await submitRegistration(attemptId, input);
  switch (result.kind) {
    case "created":
    case "already_completed":
      redirect("/register/confirmation");
    case "invalid":
      return { fieldErrors: result.fieldErrors };
    case "forbidden":
      return { error: "This registration can't be completed yet — your payment has not been verified." };
  }
}

export type ResumeState = { done?: boolean; error?: string; emailEnabled?: boolean };

export async function requestRecoveryAction(_prev: ResumeState, formData: FormData): Promise<ResumeState> {
  const parsed = startRegistrationSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const ip = await clientIp();
  const [a, b] = await Promise.all([rateLimit("recovery", ip), rateLimit("recoveryEmail", parsed.data.email)]);
  if (!a.ok || !b.ok) return { error: "Too many requests. Please wait a few minutes and try again." };
  await requestRecovery(parsed.data.email).catch((err) =>
    console.error("[recovery] failed", (err as Error).message),
  );
  // Identical response whether or not the email exists.
  return { done: true, emailEnabled: emailConfigured() };
}

export async function consumeRecoveryLinkAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!(await rateLimit("recovery", await clientIp())).ok) redirect("/register/resume?error=rate");
  const result = await consumeEmailLinkToken(token);
  if (!result) redirect("/register/resume?error=expired");
  await setRegistrationCookie(result.sessionToken);
  redirect("/register/form");
}
