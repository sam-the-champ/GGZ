"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { changePassword } from "@/lib/auth/account";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  adminCookieName,
  authenticate,
  AuthorizationError,
  destroyAdminSession,
  requireAdmin,
  setAdminCookie,
} from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { audit } from "@/lib/services/audit";
import { db } from "@/lib/db";
import { emailConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { testEmail } from "@/lib/email/templates";
import { respondToTicket, setTicketStatus } from "@/lib/services/support";
import { sendPendingConfirmations } from "@/lib/services/registrations";
import {
  allocateOverflowPlace,
  cancelRegistration,
  eraseParticipant,
  issueRecoveryLink,
  resendConfirmation,
  reverifyAttempt,
  updateParticipant,
  updateSettings,
  type SettingsResult,
} from "@/lib/services/admin";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z
    .object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };

  const ip = await clientIp();
  const [byIp, byAccount] = await Promise.all([
    rateLimit("adminLogin", ip),
    rateLimit("adminLogin", `acct:${parsed.data.email.toLowerCase()}`),
  ]);
  if (!byIp.ok || !byAccount.ok) return { error: "Too many sign-in attempts. Try again in 15 minutes." };

  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return {
      error:
        result.reason === "locked"
          ? "This account is temporarily locked after repeated failed attempts. Try again in 15 minutes."
          : "Incorrect email or password.",
    };
  }
  await setAdminCookie(result.token);
  await audit(db, { actorId: result.admin.id, action: "admin.login", entityType: "AdminUser", entityId: result.admin.id });
  redirect("/admin");
}

export async function logoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export type ActionResult = { ok?: boolean; message?: string; url?: string };

/** Wraps a sensitive admin mutation with auth, role check and rate limiting. */
async function guarded(fn: (admin: Awaited<ReturnType<typeof requireAdmin>>) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const admin = await requireAdmin("ADMIN");
    if (!(await rateLimit("adminSensitive", admin.id)).ok) {
      return { ok: false, message: "Too many actions in a short time. Please wait a few minutes." };
    }
    return await fn(admin);
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, message: "You don't have permission to do that." };
    console.error("[admin] action failed", (err as Error).message);
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}

const idSchema = z.string().min(10).max(40);

export async function saveSettingsAction(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  try {
    const admin = await requireAdmin("ADMIN");
    const result = await updateSettings(admin, {
      feeNaira: String(formData.get("feeNaira") ?? ""),
      capacity: String(formData.get("capacity") ?? ""),
      reservationMinutes: String(formData.get("reservationMinutes") ?? "30"),
      feeCovers: String(formData.get("feeCovers") ?? ""),
      refundPolicy: String(formData.get("refundPolicy") ?? ""),
      minimumAge: String(formData.get("minimumAge") ?? ""),
      guardianConsentAge: String(formData.get("guardianConsentAge") ?? "18"),
      registrationOpen: formData.get("registrationOpen") === "on",
    });
    if (result.ok) {
      revalidatePath("/");
      revalidatePath("/admin", "layout");
    }
    return result;
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, errors: { form: "You don't have permission to change settings." } };
    throw err;
  }
}

export async function reverifyAction(_p: ActionResult, formData: FormData) {
  return guarded(async (admin) => {
    const id = idSchema.parse(formData.get("attemptId"));
    const r = await reverifyAttempt(admin, id);
    revalidatePath(`/admin/registrations/${id}`);
    return r;
  });
}

export async function recoveryLinkAction(_p: ActionResult, formData: FormData) {
  return guarded(async (admin) => issueRecoveryLink(admin, idSchema.parse(formData.get("attemptId"))));
}

export async function allocateAction(_p: ActionResult, formData: FormData) {
  return guarded(async (admin) => {
    const id = idSchema.parse(formData.get("attemptId"));
    const r = await allocateOverflowPlace(admin, id);
    revalidatePath(`/admin/registrations/${id}`);
    return r;
  });
}

export async function cancelAction(_p: ActionResult, formData: FormData) {
  return guarded(async (admin) => {
    const id = idSchema.parse(formData.get("attemptId"));
    const r = await cancelRegistration(admin, id, String(formData.get("reason") ?? ""));
    revalidatePath(`/admin/registrations/${id}`);
    return r;
  });
}

export async function eraseAction(_p: ActionResult, formData: FormData) {
  return guarded(async (admin) => {
    if (formData.get("confirm") !== "ERASE") return { ok: false, message: "Type ERASE to confirm." };
    const id = idSchema.parse(formData.get("attemptId"));
    const r = await eraseParticipant(admin, id);
    revalidatePath(`/admin/registrations/${id}`);
    return r;
  });
}

export async function sendTestEmailAction(_p: ActionResult, formData: FormData) {
  void formData;
  return guarded(async (admin) => {
    if (!emailConfigured()) {
      return { ok: false, message: "Email isn't configured yet. Add the SMTP_* variables in Vercel and redeploy." };
    }
    const result = await sendEmail(testEmail(admin.email));
    await audit(db, {
      actorId: admin.id,
      action: "email.test",
      entityType: "AdminUser",
      entityId: admin.id,
      details: { sent: result.sent },
    });
    return result.sent
      ? { ok: true, message: `Test email sent to ${admin.email}. Check the inbox (and spam folder).` }
      : { ok: false, message: `Sending failed: ${result.error ?? "unknown error"}` };
  });
}

export type FormActionResult = ActionResult & { errors?: Record<string, string> };

export async function updateParticipantAction(_p: FormActionResult, formData: FormData): Promise<FormActionResult> {
  return guarded(async (admin) => {
    const id = idSchema.parse(formData.get("attemptId"));
    const field = (k: string) => String(formData.get(k) ?? "");
    const r = await updateParticipant(admin, id, {
      fullName: field("fullName"),
      phone: field("phone"),
      cityOrState: field("cityOrState"),
      emergencyContactName: field("emergencyContactName"),
      emergencyContactPhone: field("emergencyContactPhone"),
      supportNeeds: field("supportNeeds"),
      guardianName: field("guardianName"),
      guardianPhone: field("guardianPhone"),
      guardianEmail: field("guardianEmail"),
    });
    revalidatePath(`/admin/registrations/${id}`);
    return r;
  });
}

export async function resendConfirmationAction(_p: ActionResult, formData: FormData) {
  return guarded(async (admin) => resendConfirmation(admin, idSchema.parse(formData.get("attemptId"))));
}

export type PasswordState = { ok?: boolean; field?: string; message?: string };

export async function changePasswordAction(_p: PasswordState, formData: FormData): Promise<PasswordState> {
  try {
    // Any signed-in admin (including viewers) may change their own password.
    const admin = await requireAdmin("ANY");
    if (!(await rateLimit("adminLogin", `pw:${admin.id}`)).ok) {
      return { ok: false, message: "Too many attempts. Try again in 15 minutes." };
    }
    const token = (await cookies()).get(adminCookieName())?.value;
    const r = await changePassword(
      admin.id,
      {
        current: String(formData.get("current") ?? ""),
        next: String(formData.get("next") ?? ""),
        confirm: String(formData.get("confirm") ?? ""),
      },
      token,
    );
    return r.ok ? { ok: true, message: "Password changed. Other devices have been signed out." } : r;
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, message: "Please sign in again." };
    throw err;
  }
}

// ─── Help desk ──────────────────────────────────────────────────────────────

export async function respondToTicketAction(_p: ActionResult, formData: FormData) {
  return guarded(async (admin) => {
    const id = idSchema.parse(formData.get("ticketId"));
    const status = String(formData.get("status") ?? "");
    const r = await respondToTicket(admin, id, {
      channel: String(formData.get("channel") ?? ""),
      body: String(formData.get("body") ?? ""),
      status: status || undefined,
    });
    revalidatePath(`/admin/help/${id}`);
    revalidatePath("/admin/help");
    return r;
  });
}

export async function setTicketStatusAction(_p: ActionResult, formData: FormData) {
  return guarded(async (admin) => {
    const id = idSchema.parse(formData.get("ticketId"));
    const status = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).parse(formData.get("status"));
    const r = await setTicketStatus(admin, id, status);
    revalidatePath(`/admin/help/${id}`);
    revalidatePath("/admin/help");
    return r;
  });
}

export async function sendPendingConfirmationsAction(_p: ActionResult, formData: FormData) {
  void formData;
  return guarded(async (admin) => {
    if (!emailConfigured()) return { ok: false, message: "Email isn't connected yet." };
    const r = await sendPendingConfirmations(100);
    await audit(db, {
      actorId: admin.id,
      action: "registration.confirmations_catch_up",
      entityType: "Registration",
      details: { sent: r.sent, failed: r.failed },
    });
    revalidatePath("/admin/settings");
    if (r.attempted === 0) return { ok: true, message: "Everyone already has their confirmation email." };
    return r.failed === 0
      ? { ok: true, message: `Sent ${r.sent} confirmation email${r.sent === 1 ? "" : "s"}.` }
      : { ok: false, message: `Sent ${r.sent}, ${r.failed} failed. Check the email settings and try again.` };
  });
}
