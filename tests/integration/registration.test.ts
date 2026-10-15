import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flutterwave/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flutterwave/client")>();
  const fake = await import("../helpers/provider-fake");
  return { ...actual, initializeTransaction: fake.fakeInitialize, verifyTransaction: fake.fakeVerify };
});

import { db } from "@/lib/db";
import { initiateRegistration } from "@/lib/services/attempts";
import { verifyAndApply } from "@/lib/services/payments";
import { getConfirmation, getFormAccess, submitRegistration } from "@/lib/services/registrations";
import {
  consumeEmailLinkToken,
  issueEmailLinkToken,
  peekEmailLinkToken,
  resolveSessionToken,
} from "@/lib/services/continuation";
import { fakeProvider } from "../helpers/provider-fake";
import { resetDb, seedEvent, validForm } from "../helpers/db";

async function checkout(email = "ada@example.com") {
  const r = await initiateRegistration({ email });
  if (r.kind !== "checkout") throw new Error(r.kind);
  return { attempt: await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } }), sessionToken: r.sessionToken };
}

async function paid(email = "ada@example.com") {
  const c = await checkout(email);
  fakeProvider.setStatus(c.attempt.paymentReference, "success");
  await verifyAndApply(c.attempt.paymentReference, "CALLBACK");
  return c;
}

beforeEach(async () => {
  await resetDb();
  fakeProvider.reset();
  await seedEvent({ capacity: 10, minimumAge: 13 });
});

describe("registration form", () => {
  it("completes a valid registration linked to the verified payment", async () => {
    const { attempt, sessionToken } = await paid();
    expect(await resolveSessionToken(sessionToken)).toBe(attempt.id);
    const res = await submitRegistration(attempt.id, validForm);
    expect(res.kind).toBe("created");
    if (res.kind !== "created") return;
    expect(res.registrationNumber).toMatch(/^GGZ26-[A-Z2-9]{6}$/);
    const reg = await db.registration.findUniqueOrThrow({ where: { id: res.registrationId }, include: { payment: true, participant: true } });
    expect(reg.status).toBe("CONFIRMED");
    expect(reg.payment.status).toBe("PAID");
    expect(reg.participant.email).toBe("ada@example.com");
    expect(reg.participant.phone).toBe("08031234567");
    const conf = await getConfirmation(attempt.id);
    expect(conf).toMatchObject({ registrationNumber: res.registrationNumber, status: "CONFIRMED" });
    expect((await getFormAccess(attempt.id)).kind).toBe("completed");
  });

  it("rejects invalid data with field errors", async () => {
    const { attempt } = await paid();
    const res = await submitRegistration(attempt.id, { ...validForm, phone: "abc", fullName: "A" });
    expect(res.kind).toBe("invalid");
    if (res.kind === "invalid") expect(Object.keys(res.fieldErrors)).toEqual(expect.arrayContaining(["phone", "fullName"]));
    expect(await db.registration.count()).toBe(0);
  });

  it("rejects missing required fields", async () => {
    const { attempt } = await paid();
    const res = await submitRegistration(attempt.id, { acceptTerms: true });
    expect(res.kind).toBe("invalid");
  });

  it("enforces guardian consent for minors and minimum age, server-side", async () => {
    const { attempt } = await paid();
    const minor = await submitRegistration(attempt.id, { ...validForm, dateOfBirth: "2011-01-01" });
    expect(minor.kind === "invalid" && minor.fieldErrors.guardianConsent).toBeTruthy();
    const tooYoung = await submitRegistration(attempt.id, { ...validForm, dateOfBirth: "2016-01-01" });
    expect(tooYoung.kind === "invalid" && tooYoung.fieldErrors.dateOfBirth).toMatch(/at least 13/);
    const ok = await submitRegistration(attempt.id, {
      ...validForm,
      dateOfBirth: "2011-01-01",
      guardianName: "Mrs Okafor",
      guardianPhone: "08035550000",
      guardianConsent: true,
    });
    expect(ok.kind).toBe("created");
    const p = await db.participant.findFirstOrThrow();
    expect(p.guardianConsentAt).not.toBeNull();
  });

  it("duplicate / concurrent submissions create exactly one registration", async () => {
    const { attempt } = await paid();
    const results = await Promise.all(Array.from({ length: 5 }, () => submitRegistration(attempt.id, validForm)));
    expect(results.filter((r) => r.kind === "created")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "already_completed")).toHaveLength(4);
    expect(await db.registration.count()).toBe(1);
    expect(await db.participant.count()).toBe(1);
  });

  it("forbids form submission without a verified payment (bypass attempts)", async () => {
    const { attempt } = await checkout();
    expect((await submitRegistration(attempt.id, validForm)).kind).toBe("forbidden");
    // Even if the status column were tampered with, there is no verified Payment record.
    await db.registrationAttempt.update({ where: { id: attempt.id }, data: { paymentStatus: "PAID", reservationStatus: "HELD" } });
    expect((await submitRegistration(attempt.id, validForm)).kind).toBe("forbidden");
    expect((await submitRegistration("nonexistent-attempt-id", validForm)).kind).toBe("forbidden");
    expect(await db.registration.count()).toBe(0);
  });

  it("unauthorised form access: no or invalid session token unlocks nothing", async () => {
    await paid();
    expect(await resolveSessionToken(undefined)).toBeNull();
    expect(await resolveSessionToken("forged-token-value-that-is-long-enough")).toBeNull();
    expect((await getFormAccess(null)).kind).toBe("no_session");
  });

  it("session tokens expire", async () => {
    const { sessionToken } = await paid();
    expect(await resolveSessionToken(sessionToken, new Date(Date.now() + 25 * 60 * 60 * 1000))).toBeNull();
  });
});

describe("secure recovery", () => {
  it("email links are single-use and exchange for a session token", async () => {
    const { attempt } = await paid();
    const link = await issueEmailLinkToken(db, attempt.id);
    expect(await peekEmailLinkToken(link)).toBe(true);
    const [a, b] = await Promise.all([consumeEmailLinkToken(link), consumeEmailLinkToken(link)]);
    const winner = a ?? b;
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await resolveSessionToken(winner!.sessionToken)).toBe(attempt.id);
    expect(await peekEmailLinkToken(link)).toBe(false);
  });

  it("expired links cannot be used", async () => {
    const { attempt } = await paid();
    const link = await issueEmailLinkToken(db, attempt.id, new Date(Date.now() - 3 * 60 * 60 * 1000));
    expect(await consumeEmailLinkToken(link)).toBeNull();
  });

  it("a session token cannot be used as an email link and vice versa", async () => {
    const { attempt, sessionToken } = await paid();
    expect(await consumeEmailLinkToken(sessionToken)).toBeNull();
    const link = await issueEmailLinkToken(db, attempt.id);
    expect(await resolveSessionToken(link)).toBeNull();
  });
});
