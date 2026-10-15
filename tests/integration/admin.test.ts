import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// In-memory cookie jar standing in for the request cookies.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
    has: (name: string) => jar.has(name),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/flutterwave/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flutterwave/client")>();
  const fake = await import("../helpers/provider-fake");
  return { ...actual, initializeTransaction: fake.fakeInitialize, verifyTransaction: fake.fakeVerify };
});

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { authenticate, adminCookieName, resolveAdminSession } from "@/lib/auth/session";
import { saveSettingsAction, cancelAction } from "@/app/admin/actions";
import { GET as exportCsv } from "@/app/api/admin/export/route";
import { buildRegistrationsCsv, getDashboardStats, searchAttempts } from "@/lib/services/admin";
import { initiateRegistration } from "@/lib/services/attempts";
import { verifyAndApply } from "@/lib/services/payments";
import { submitRegistration } from "@/lib/services/registrations";
import { fakeProvider } from "../helpers/provider-fake";
import { resetDb, seedEvent, validForm } from "../helpers/db";

const PASSWORD = "correct horse battery 9";

async function makeAdmin(email: string, role: "ADMIN" | "VIEWER") {
  return db.adminUser.create({ data: { email, name: email.split("@")[0]!, role, passwordHash: await hashPassword(PASSWORD) } });
}

async function signIn(email: string) {
  const r = await authenticate(email, PASSWORD);
  if (!r.ok) throw new Error("login failed");
  jar.set(adminCookieName(), r.token);
}

function settingsForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values = {
    feeNaira: "25000",
    capacity: "150",
    reservationMinutes: "30",
    feeCovers: "Accommodation and meals",
    refundPolicy: "Organiser-approved policy",
    minimumAge: "",
    guardianConsentAge: "18",
    registrationOpen: "on",
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) if (v !== "") fd.set(k, v);
  return fd;
}

async function register(email: string, name: string, phone = "08030000001") {
  const r = await initiateRegistration({ email });
  if (r.kind !== "checkout") throw new Error(r.kind);
  const a = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
  fakeProvider.setStatus(a.paymentReference, "success");
  await verifyAndApply(a.paymentReference, "WEBHOOK");
  await submitRegistration(a.id, { ...validForm, fullName: name, phone });
  return a;
}

beforeEach(async () => {
  await resetDb();
  fakeProvider.reset();
  jar.clear();
});

describe("admin authentication", () => {
  it("rejects wrong passwords and locks the account after repeated failures", async () => {
    await makeAdmin("admin@example.com", "ADMIN");
    expect((await authenticate("admin@example.com", "wrong")).ok).toBe(false);
    for (let i = 0; i < 4; i++) await authenticate("admin@example.com", "wrong");
    const locked = await authenticate("admin@example.com", PASSWORD);
    expect(locked).toEqual({ ok: false, reason: "locked" });
  });

  it("unknown accounts fail the same way", async () => {
    expect(await authenticate("ghost@example.com", PASSWORD)).toEqual({ ok: false, reason: "invalid" });
  });

  it("sessions are validated against the database", async () => {
    await makeAdmin("admin@example.com", "ADMIN");
    const r = await authenticate("admin@example.com", PASSWORD);
    if (!r.ok) throw new Error();
    expect((await resolveAdminSession(r.token))?.email).toBe("admin@example.com");
    expect(await resolveAdminSession("forged")).toBeNull();
    await db.adminUser.updateMany({ data: { isActive: false } });
    expect(await resolveAdminSession(r.token)).toBeNull();
  });
});

describe("admin authorisation", () => {
  it("unauthenticated users cannot change settings or export data", async () => {
    await seedEvent();
    const res = await saveSettingsAction(null, settingsForm());
    expect(res.ok).toBe(false);
    const csv = await exportCsv(new NextRequest("http://localhost:3000/api/admin/export"));
    expect(csv.status).toBe(401);
    expect((await db.event.findFirstOrThrow()).feeKobo).toBe(1_500_000);
  });

  it("viewers cannot perform admin mutations", async () => {
    await seedEvent();
    await makeAdmin("viewer@example.com", "VIEWER");
    await signIn("viewer@example.com");
    const res = await saveSettingsAction(null, settingsForm());
    expect(res.ok).toBe(false);
    const cancel = await cancelAction({}, (() => { const f = new FormData(); f.set("attemptId", "x".repeat(20)); f.set("reason", "test"); return f; })());
    expect(cancel.ok).toBe(false);
    expect(cancel.message).toMatch(/permission/);
    // …but can export.
    const csv = await exportCsv(new NextRequest("http://localhost:3000/api/admin/export"));
    expect(csv.status).toBe(200);
  });
});

describe("event settings", () => {
  it("admins can update fee and capacity; the change is audited", async () => {
    await seedEvent({ feeKobo: null, capacity: null, registrationOpen: false, refundPolicy: null });
    await makeAdmin("admin@example.com", "ADMIN");
    await signIn("admin@example.com");
    const res = await saveSettingsAction(null, settingsForm());
    expect(res.ok).toBe(true);
    const ev = await db.event.findFirstOrThrow();
    expect(ev).toMatchObject({ feeKobo: 2_500_000, capacity: 150, registrationOpen: true });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "settings.update" } });
    expect(log.details).toMatchObject({ feeKobo: { from: null, to: 2_500_000 }, capacity: { from: null, to: 150 } });
  });

  it("cannot open registration without fee, capacity and refund policy", async () => {
    await seedEvent({ registrationOpen: false });
    await makeAdmin("admin@example.com", "ADMIN");
    await signIn("admin@example.com");
    const res = await saveSettingsAction(null, settingsForm({ refundPolicy: "" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.registrationOpen).toMatch(/refund policy/);
    const bad = await saveSettingsAction(null, settingsForm({ feeNaira: "-5", capacity: "abc" }));
    if (!bad.ok) expect(Object.keys(bad.errors)).toEqual(expect.arrayContaining(["feeNaira", "capacity"]));
    expect((await db.event.findFirstOrThrow()).registrationOpen).toBe(false);
  });
});

describe("dashboard, search and export", () => {
  it("computes totals from real records", async () => {
    await seedEvent({ capacity: 10 });
    await register("a@example.com", "Ada Okafor");
    await register("b@example.com", "Tobi Bello");
    // paid but incomplete
    const r = await initiateRegistration({ email: "c@example.com" });
    if (r.kind !== "checkout") throw new Error();
    const c = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    fakeProvider.setStatus(c.paymentReference, "success");
    await verifyAndApply(c.paymentReference, "WEBHOOK");
    // failed
    const f = await initiateRegistration({ email: "d@example.com" });
    if (f.kind !== "checkout") throw new Error();
    const d = await db.registrationAttempt.findUniqueOrThrow({ where: { id: f.attemptId } });
    fakeProvider.setStatus(d.paymentReference, "failed");
    await verifyAndApply(d.paymentReference, "CALLBACK");
    // pending
    await initiateRegistration({ email: "e@example.com" });

    const s = (await getDashboardStats())!;
    expect(s.capacity.confirmed).toBe(2);
    expect(s.capacity.paidIncomplete).toBe(1);
    expect(s.capacity.activeReservations).toBe(1);
    expect(s.capacity.available).toBe(10 - 3 - 1);
    expect(s.grossVerifiedKobo).toBe(3 * 1_500_000);
    expect(s.netKobo).toBe(3 * 1_500_000);
    expect(s.failedPayments).toBe(1);
    expect(s.pendingPayments).toBe(1);
  });

  it("searches by name, email, phone and registration number, and filters by status", async () => {
    await seedEvent({ capacity: 10 });
    await register("ada@example.com", "Ada Okafor", "08031234567");
    await register("tobi@example.com", "Tobi Bello", "08039876543");
    expect((await searchAttempts({ q: "okafor" })).total).toBe(1);
    expect((await searchAttempts({ q: "TOBI@" })).total).toBe(1);
    expect((await searchAttempts({ q: "0803 987" })).total).toBe(1);
    const reg = await db.registration.findFirstOrThrow({ include: { participant: true }, where: { participant: { fullName: "Ada Okafor" } } });
    expect((await searchAttempts({ q: reg.registrationNumber })).rows[0]?.id).toBe(reg.attemptId);
    expect((await searchAttempts({ filter: "confirmed" })).total).toBe(2);
    expect((await searchAttempts({ filter: "paid_incomplete" })).total).toBe(0);
  });

  it("exports CSV with safe values", async () => {
    await seedEvent({ capacity: 10 });
    await register("ada@example.com", "Ada Okafor");
    const a = await db.registrationAttempt.findFirstOrThrow();
    await db.participant.updateMany({ data: { cityOrState: "=HYPERLINK(\"http://evil\")" } });
    const csv = await buildRegistrationsCsv("confirmed");
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Ada Okafor"');
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(lines[1]).toContain(a.paymentReference);
  });
});
