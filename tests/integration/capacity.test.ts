import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/paystack/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/paystack/client")>();
  const fake = await import("../helpers/paystack-fake");
  return { ...actual, initializeTransaction: fake.fakeInitialize, verifyTransaction: fake.fakeVerify };
});

import { db } from "@/lib/db";
import { initiateRegistration } from "@/lib/services/attempts";
import { verifyAndApply } from "@/lib/services/payments";
import { getCapacitySnapshot, getEvent, getPublicEventInfo } from "@/lib/services/event";
import { allocateOverflowPlace, cancelRegistration, updateSettings } from "@/lib/services/admin";
import { submitRegistration } from "@/lib/services/registrations";
import { fakePaystack } from "../helpers/paystack-fake";
import { resetDb, seedEvent, validForm } from "../helpers/db";

const admin = { id: "", email: "admin@example.com", name: "Admin", role: "ADMIN" as const };

async function paidAttempt(email: string) {
  const r = await initiateRegistration({ email });
  if (r.kind !== "checkout") throw new Error(r.kind);
  const a = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
  fakePaystack.setStatus(a.paymentReference, "success");
  await verifyAndApply(a.paymentReference, "WEBHOOK");
  return a;
}

beforeEach(async () => {
  await resetDb();
  fakePaystack.reset();
  const u = await db.adminUser.create({ data: { email: "admin@example.com", name: "Admin", passwordHash: "x", role: "ADMIN" } });
  admin.id = u.id;
});

describe("capacity", () => {
  it("reports available places and opens registration", async () => {
    await seedEvent({ capacity: 3 });
    const info = await getPublicEventInfo();
    expect(info.availability).toMatchObject({ state: "open", spacesLeft: 3 });
  });

  it("refuses new checkouts when full", async () => {
    await seedEvent({ capacity: 2 });
    expect((await initiateRegistration({ email: "a@x.co" })).kind).toBe("checkout");
    expect((await initiateRegistration({ email: "b@x.co" })).kind).toBe("checkout");
    expect((await initiateRegistration({ email: "c@x.co" })).kind).toBe("full");
    expect((await getPublicEventInfo()).availability.state).toBe("full");
  });

  it("never oversells under simultaneous registration attempts", async () => {
    await seedEvent({ capacity: 3 });
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => initiateRegistration({ email: `p${i}@example.com` })),
    );
    expect(results.filter((r) => r.kind === "checkout")).toHaveLength(3);
    expect(results.filter((r) => r.kind === "full")).toHaveLength(9);
    const event = (await getEvent())!;
    const snap = await getCapacitySnapshot(db, event);
    expect(snap.activeReservations).toBe(3);
    expect(snap.available).toBe(0);
  });

  it("expired reservations free their places without a background job", async () => {
    await seedEvent({ capacity: 1 });
    expect((await initiateRegistration({ email: "a@x.co" })).kind).toBe("checkout");
    expect((await initiateRegistration({ email: "b@x.co" })).kind).toBe("full");
    await db.registrationAttempt.updateMany({ data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    expect((await initiateRegistration({ email: "b@x.co" })).kind).toBe("checkout");
  });

  it("cancelled checkouts release their place", async () => {
    await seedEvent({ capacity: 1 });
    const r = await initiateRegistration({ email: "a@x.co" });
    if (r.kind !== "checkout") throw new Error();
    const a = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    await verifyAndApply(a.paymentReference, "CALLBACK", { cancelled: true });
    expect((await initiateRegistration({ email: "b@x.co" })).kind).toBe("checkout");
  });

  it("a late payment when the event filled up becomes OVERFLOW, never an oversell", async () => {
    await seedEvent({ capacity: 1 });
    const r = await initiateRegistration({ email: "late@x.co" });
    if (r.kind !== "checkout") throw new Error();
    const late = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    await db.registrationAttempt.update({ where: { id: late.id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await paidAttempt("ontime@x.co"); // takes the only place
    fakePaystack.setStatus(late.paymentReference, "success");
    const out = await verifyAndApply(late.paymentReference, "WEBHOOK");
    expect(out.kind === "processed" && out.attempt).toMatchObject({ paymentStatus: "PAID", reservationStatus: "OVERFLOW" });
    const snap = await getCapacitySnapshot(db, (await getEvent())!);
    expect(snap.held).toBe(1);
    expect(snap.overflow).toBe(1);

    // Admin can only allocate once a place is free.
    expect((await allocateOverflowPlace(admin, late.id)).ok).toBe(false);
    await db.event.updateMany({ data: { capacity: 2 } });
    expect((await allocateOverflowPlace(admin, late.id)).ok).toBe(true);
  });

  it("admin capacity changes are validated, audited and enforced", async () => {
    await seedEvent({ capacity: 5 });
    await paidAttempt("a@x.co");
    await paidAttempt("b@x.co");
    const base = {
      feeNaira: "15000",
      reservationMinutes: 30,
      feeCovers: "",
      refundPolicy: "Policy",
      minimumAge: "",
      guardianConsentAge: 18,
      registrationOpen: true,
    };
    expect((await updateSettings(admin, { ...base, capacity: "0" })).ok).toBe(false);
    const reduced = await updateSettings(admin, { ...base, capacity: "1" });
    expect(reduced.ok && reduced.message).toMatch(/below current commitments/);
    expect((await initiateRegistration({ email: "c@x.co" })).kind).toBe("full");
    expect(await db.auditLog.count({ where: { action: "settings.update" } })).toBe(1);
    await updateSettings(admin, { ...base, capacity: "3" });
    expect((await initiateRegistration({ email: "c@x.co" })).kind).toBe("checkout");
  });

  it("cancelling a confirmed registration releases its place", async () => {
    await seedEvent({ capacity: 1 });
    const a = await paidAttempt("a@x.co");
    await submitRegistration(a.id, validForm);
    expect((await initiateRegistration({ email: "b@x.co" })).kind).toBe("full");
    expect((await cancelRegistration(admin, a.id, "Requested refund")).ok).toBe(true);
    expect((await initiateRegistration({ email: "b@x.co" })).kind).toBe("checkout");
  });
});
