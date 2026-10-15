import "server-only";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { hashPassword, passwordProblems, verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/services/audit";

export type ChangePasswordResult = { ok: true } | { ok: false; field: "current" | "next" | "confirm"; message: string };

/**
 * Changes an admin's own password. Requires the current password, applies the
 * password policy, and signs out every other session (the current one stays).
 */
export async function changePassword(
  adminId: string,
  input: { current: string; next: string; confirm: string },
  currentSessionToken: string | undefined,
): Promise<ChangePasswordResult> {
  const user = await db.adminUser.findUnique({ where: { id: adminId } });
  if (!user || !user.isActive) return { ok: false, field: "current", message: "Account not found." };
  if (!(await verifyPassword(user.passwordHash, input.current))) {
    return { ok: false, field: "current", message: "Your current password is incorrect." };
  }
  const problem = passwordProblems(input.next);
  if (problem) return { ok: false, field: "next", message: problem };
  if (input.next === input.current) {
    return { ok: false, field: "next", message: "Choose a password different from your current one." };
  }
  if (input.next !== input.confirm) return { ok: false, field: "confirm", message: "The passwords don't match." };

  const passwordHash = await hashPassword(input.next);
  const keep = currentSessionToken ? sha256(currentSessionToken) : null;
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: adminId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
    await tx.adminSession.deleteMany({
      where: { adminUserId: adminId, ...(keep ? { tokenHash: { not: keep } } : {}) },
    });
    await audit(tx, { actorId: adminId, action: "admin.password_changed", entityType: "AdminUser", entityId: adminId });
  });
  return { ok: true };
}
