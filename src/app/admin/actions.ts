"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
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
import {
  allocateOverflowPlace,
  cancelRegistration,
  eraseParticipant,
  issueRecoveryLink,
  reverifyAttempt,
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
