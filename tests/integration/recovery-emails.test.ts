import { beforeEach, describe, expect, it, vi } from "vitest";

const outbox = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
vi.mock("@/lib/email/send", () => ({
  sendEmail: async (m: { to: string; subject: string; text: string }) => {
    outbox.push(m);
    return { sent: true };
  },
  senderAddress: () => "GGZ Camp <camp@example.org>",
}));
vi.mock("@/lib/flutterwave/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flutterwave/client")>();
  const fake = await import("../helpers/provider-fake");
  return { ...actual, initializeTransaction: fake.fakeInitialize, verifyTransaction: fake.fakeVerify };
});

import { db } from "@/lib/db";
import { requestRecovery } from "@/lib/services/recovery";
import { initiateRegistration } from "@/lib/services/attempts";
import { verifyAndApply } from "@/lib/services/payments";
import { submitRegistration } from "@/lib/services/registrations";
import { fakeProvider } from "../helpers/provider-fake";
import { resetDb, seedEvent, validForm } from "../helpers/db";

async function pay(email: string) {
  const r = await initiateRegistration({ email });
  if (r.kind !== "checkout") throw new Error(r.kind);
  const a = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
  fakeProvider.setStatus(a.paymentReference, "success");
  await verifyAndApply(a.paymentReference, "WEBHOOK");
  return a;
}

beforeEach(async () => {
  await resetDb();
  fakeProvider.reset();
  await seedEvent({ capacity: 10 });
  outbox.length = 0;
});

describe("Resume page always emails the inbox owner the right next step", () => {
  it("paid, form not finished → secure link", async () => {
    await pay("ada@example.com");
    outbox.length = 0; // ignore the payment-received email
    const res = await requestRecovery("ADA@example.com");
    expect(res.outcome).toBe("link");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.subject).toMatch(/Continue your registration/);
    expect(outbox[0]!.text).toMatch(/\/register\/resume\//);
  });

  it("already registered → registration number, no link", async () => {
    const a = await pay("ada@example.com");
    const done = await submitRegistration(a.id, validForm);
    if (done.kind !== "created") throw new Error();
    outbox.length = 0;
    const res = await requestRecovery("ada@example.com");
    expect(res.outcome).toBe("already_registered");
    expect(outbox[0]!.subject).toMatch(/already registered/);
    expect(outbox[0]!.text).toContain(done.registrationNumber);
    expect(outbox[0]!.text).not.toMatch(/\/register\/resume\//);
  });

  it("never paid → explains, with a link to start", async () => {
    await initiateRegistration({ email: "tobi@example.com" }); // abandoned checkout
    const res = await requestRecovery("tobi@example.com");
    expect(res.outcome).toBe("no_payment");
    expect(outbox[0]!.subject).toMatch(/about your registration request/);
    expect(outbox[0]!.text).toMatch(/\/register\b/);
    expect(await db.continuationToken.count({ where: { purpose: "EMAIL_LINK" } })).toBe(0);
  });

  it("unknown email → same explanation, no link", async () => {
    const res = await requestRecovery("nobody@example.com");
    expect(res.outcome).toBe("no_payment");
    expect(outbox).toHaveLength(1);
  });

  it("paid after the event filled → reassurance", async () => {
    const a = await pay("late@example.com");
    await db.registrationAttempt.update({ where: { id: a.id }, data: { reservationStatus: "OVERFLOW" } });
    outbox.length = 0;
    const res = await requestRecovery("late@example.com");
    expect(res.outcome).toBe("on_hold");
    expect(outbox[0]!.text).toContain(a.publicRef);
  });

  it("payment the webhook missed is confirmed and gets the payment-received link", async () => {
    const r = await initiateRegistration({ email: "zee@example.com" });
    if (r.kind !== "checkout") throw new Error();
    const a = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    fakeProvider.setStatus(a.paymentReference, "success"); // paid, but no webhook arrived
    const res = await requestRecovery("zee@example.com");
    expect(res.outcome).toBe("payment_received");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.subject).toMatch(/Payment received/);
  });
});

describe("confirmation email on completing registration", () => {
  it("is sent immediately and recorded", async () => {
    const a = await pay("ada@example.com");
    outbox.length = 0;
    const done = await submitRegistration(a.id, validForm);
    if (done.kind !== "created") throw new Error();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe("ada@example.com");
    expect(outbox[0]!.subject).toMatch(/registration confirmed/);
    expect(outbox[0]!.text).toContain(done.registrationNumber);
    const reg = await db.registration.findUniqueOrThrow({ where: { id: done.registrationId } });
    expect(reg.confirmationEmailSentAt).not.toBeNull();
  });

  it("catch-up sends only confirmations that never went out", async () => {
    const { sendPendingConfirmations } = await import("@/lib/services/registrations");
    const a = await pay("ada@example.com");
    const b = await pay("tobi@example.com");
    await submitRegistration(a.id, validForm);
    await submitRegistration(b.id, validForm);
    // Simulate one registration made before email was connected.
    await db.registration.updateMany({ where: { attemptId: b.id }, data: { confirmationEmailSentAt: null } });
    outbox.length = 0;
    const res = await sendPendingConfirmations();
    expect(res).toEqual({ attempted: 1, sent: 1, failed: 0 });
    expect(outbox.map((m) => m.to)).toEqual(["tobi@example.com"]);
    expect((await sendPendingConfirmations()).attempted).toBe(0);
  });
});
