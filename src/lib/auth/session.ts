import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { generateToken, sha256 } from "@/lib/crypto";
import { isSecureContext } from "@/lib/env";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import type { AdminRole } from "@/generated/prisma/client";

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function adminCookieName() {
  // __Host- prefix: Secure, Path=/, no Domain — only possible over HTTPS.
  return isSecureContext() ? "__Host-ggz_admin" : "ggz_admin";
}

export type AdminIdentity = { id: string; email: string; name: string; role: AdminRole };

export type LoginResult =
  | { ok: true; token: string; admin: AdminIdentity }
  | { ok: false; reason: "invalid" | "locked" };

/** Verifies credentials, applying per-account lockout. Does not touch cookies. */
export async function authenticate(emailInput: string, password: string, now = new Date()): Promise<LoginResult> {
  const email = emailInput.trim().toLowerCase();
  const user = await db.adminUser.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    await verifyPassword(await getDummyHash(), password);
    return { ok: false, reason: "invalid" };
  }
  if (user.lockedUntil && user.lockedUntil > now) return { ok: false, reason: "locked" };

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await db.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCKOUT_MS) : null,
      },
    });
    return { ok: false, reason: "invalid" };
  }

  const token = generateToken();
  await db.$transaction([
    db.adminSession.create({
      data: {
        tokenHash: sha256(token),
        adminUserId: user.id,
        expiresAt: new Date(now.getTime() + ADMIN_SESSION_TTL_MS),
      },
    }),
    db.adminUser.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    }),
    db.adminSession.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return { ok: true, token, admin: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

export async function resolveAdminSession(token: string | undefined, now = new Date()): Promise<AdminIdentity | null> {
  if (!token || token.length > 100) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { adminUser: true },
  });
  if (!session || session.expiresAt <= now || !session.adminUser.isActive) return null;
  const u = session.adminUser;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function setAdminCookie(token: string) {
  (await cookies()).set(adminCookieName(), token, {
    httpOnly: true,
    secure: isSecureContext(),
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
}

export async function destroyAdminSession() {
  const store = await cookies();
  const token = store.get(adminCookieName())?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });
  store.delete(adminCookieName());
}

/** Current admin from the request cookie (memoised per request). */
export const getCurrentAdmin = cache(async (): Promise<AdminIdentity | null> => {
  const token = (await cookies()).get(adminCookieName())?.value;
  return resolveAdminSession(token);
});

export class AuthorizationError extends Error {
  constructor() {
    super("Not authorised");
    this.name = "AuthorizationError";
  }
}

/** For pages: redirects to the login page when unauthenticated. */
export async function requireAdminPage(): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requireAdmin(role: AdminRole | "ANY" = "ANY"): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AuthorizationError();
  if (!hasRole(admin, role)) throw new AuthorizationError();
  return admin;
}

export function hasRole(admin: Pick<AdminIdentity, "role">, role: AdminRole | "ANY") {
  if (role === "ANY") return true;
  if (role === "VIEWER") return admin.role === "VIEWER" || admin.role === "ADMIN";
  return admin.role === "ADMIN";
}
