import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/flutterwave/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flutterwave/client")>();
  const fake = await import("../helpers/provider-fake");
  return { ...actual, initializeTransaction: fake.fakeInitialize, verifyTransaction: fake.fakeVerify };
});

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { authenticate, resolveAdminSession } from "@/lib/auth/session";
import { changePassword } from "@/lib/auth/account";
import { resendConfirmation, updateParticipant } from "@/lib/services/admin";
import { initiateRegistration } from "@/lib/services/attempts";
import { verifyAndApply } from "@/lib/services/payments";
import { submitRegistration } from "@/lib/services/registrations";
import { GET as cron } from "@/app/api/cron/reconcile/route";
import { fakeProvider } from "../helpers/provider-fake";
import { resetDb, seedEvent, validForm } from "../helpers/db";

const PASSWORD = "correct horse battery 9";
let admin = { id: "", email: "admin@example.com", name: "Admin", role: "ADMIN" as const };

async function registered(email = "ada@example.com") {
  const r = await initiateRegistration({ email });
  if (r.kind !== "checkout") throw new Error(r.kind);
  const a = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
  fakeProvider.setStatus(a.paymentReference, "success");
  await verifyAndApply(a.paymentReference, "WEBHOOK");
  await submitRegistration(a.id, validForm);
  return a;
}

beforeEach(async () => {
  await resetDb();
  fakeProvider.reset();
  await seedEvent({ capacity: 10 });
  const u = await db.adminUser.create({
    data: { email: "admin@example.com", name: "Admin", role: "ADMIN", passwordHash: await hashPassword(PASSWORD) },
  });
  admin = { ...admin, id: u.id };
});

describe("participant corrections", () => {
  it("updates allowed fields and audits field names only", async () => {
    const a = await registered();
    const res = await updateParticipant(admin, a.id, {
      ...validForm,
      fullName: "Adaeze Okafor",
      phone: "0803 999 0000",
    });
    expect(res.ok).toBe(true);
    const p = await db.participant.findFirstOrThrow();
    expect(p).toMatchObject({ fullName: "Adaeze Okafor", phone: "08039990000", email: "ada@example.com" });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "participant.update" } });
    expect(log.details).toEqual({ fields: ["fullName", "phone"] });
    expect(JSON.stringify(log.details)).not.toContain("Adaeze");
  });

  it("rejects invalid values and leaves the record unchanged", async () => {
    const a = await registered();
    const res = await updateParticipant(admin, a.id, { ...validForm, phone: "123" });
    expect(res.ok).toBe(false);
    expect((await db.participant.findFirstOrThrow()).phone).toBe("08031234567");
  });
});

describe("resend confirmation", () => {
  it("reports clearly when email is not configured", async () => {
    const a = await registered();
    const res = await resendConfirmation(admin, a.id);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/not configured/);
    expect(await db.auditLog.count({ where: { action: "registration.confirmation_resent" } })).toBe(1);
  });
});

describe("change password", () => {
  it("requires the current password and the policy", async () => {
    expect(await changePassword(admin.id, { current: "wrong", next: "brand new pass 42", confirm: "brand new pass 42" }, undefined))
      .toMatchObject({ ok: false, field: "current" });
    expect(await changePassword(admin.id, { current: PASSWORD, next: "short", confirm: "short" }, undefined))
      .toMatchObject({ ok: false, field: "next" });
    expect(await changePassword(admin.id, { current: PASSWORD, next: "brand new pass 42", confirm: "different 42 pass" }, undefined))
      .toMatchObject({ ok: false, field: "confirm" });
  });

  it("changes the password and signs out other sessions only", async () => {
    const current = await authenticate(admin.email, PASSWORD);
    const other = await authenticate(admin.email, PASSWORD);
    if (!current.ok || !other.ok) throw new Error("login failed");
    const res = await changePassword(admin.id, { current: PASSWORD, next: "brand new pass 42", confirm: "brand new pass 42" }, current.token);
    expect(res.ok).toBe(true);
    expect(await resolveAdminSession(current.token)).not.toBeNull();
    expect(await resolveAdminSession(other.token)).toBeNull();
    expect((await authenticate(admin.email, PASSWORD)).ok).toBe(false);
    expect((await authenticate(admin.email, "brand new pass 42")).ok).toBe(true);
  });
});

describe("daily maintenance job", () => {
  const call = (secret?: string) =>
    cron(new NextRequest("http://localhost:3000/api/cron/reconcile", {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    }));

  it("rejects calls without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("wrong")).status).toBe(401);
  });

  it("purges unpaid checkouts older than 90 days and keeps paid ones", async () => {
    const paid = await registered("paid@example.com");
    const r = await initiateRegistration({ email: "old@example.com" });
    if (r.kind !== "checkout") throw new Error();
    const recent = await initiateRegistration({ email: "recent@example.com" });
    if (recent.kind !== "checkout") throw new Error();
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await db.registrationAttempt.update({ where: { id: r.attemptId }, data: { createdAt: old } });
    await db.registrationAttempt.update({ where: { id: paid.id }, data: { createdAt: old } });

    const res = await call(process.env.CRON_SECRET);
    expect(res.status).toBe(200);
    expect((await res.json()).purgedUnpaidAttempts).toBe(1);
    expect(await db.registrationAttempt.findUnique({ where: { id: r.attemptId } })).toBeNull();
    expect(await db.registrationAttempt.findUnique({ where: { id: recent.attemptId } })).not.toBeNull();
    expect(await db.registration.count()).toBe(1);
  });
});
