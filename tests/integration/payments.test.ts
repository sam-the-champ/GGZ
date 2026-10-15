import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/flutterwave/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flutterwave/client")>();
  const fake = await import("../helpers/provider-fake");
  return { ...actual, initializeTransaction: fake.fakeInitialize, verifyTransaction: fake.fakeVerify };
});

import { db } from "@/lib/db";
import { initiateRegistration } from "@/lib/services/attempts";
import { verifyAndApply } from "@/lib/services/payments";
import { getFormAccess } from "@/lib/services/registrations";
import { requestRecovery } from "@/lib/services/recovery";
import { getDashboardStats } from "@/lib/services/admin";
import { POST as webhook } from "@/app/api/flutterwave/webhook/route";
import { fakeProvider } from "../helpers/provider-fake";
import { resetDb, seedEvent } from "../helpers/db";

async function startCheckout(email = "ada@example.com") {
  const r = await initiateRegistration({ email });
  if (r.kind !== "checkout") throw new Error(`expected checkout, got ${r.kind}`);
  const attempt = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
  return { ...r, attempt };
}

function signedWebhook(body: object, hash = process.env.FLUTTERWAVE_WEBHOOK_HASH!) {
  return new NextRequest("http://localhost:3000/api/flutterwave/webhook", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "verif-hash": hash, "content-type": "application/json", "x-forwarded-for": "52.31.139.75" },
  });
}

beforeEach(async () => {
  await resetDb();
  fakeProvider.reset();
  await seedEvent({ capacity: 10 });
});

describe("payment initiation", () => {
  it("uses the server-configured amount in kobo and a unique reference", async () => {
    const { attempt } = await startCheckout();
    expect(attempt.amountKobo).toBe(1_500_000);
    expect(attempt.currency).toBe("NGN");
    expect(attempt.paymentReference).toMatch(/^ggz_/);
    expect(attempt.paymentStatus).toBe("PENDING");
    expect(attempt.reservationStatus).toBe("ACTIVE");
    expect(fakeProvider.txs.get(attempt.paymentReference)?.amountKobo).toBe(1_500_000);
  });

  it("refuses to start when fee or capacity is not configured", async () => {
    await resetDb();
    await seedEvent({ feeKobo: null });
    expect((await initiateRegistration({ email: "a@b.co" })).kind).toBe("not_configured");
    await resetDb();
    await seedEvent({ capacity: null });
    expect((await initiateRegistration({ email: "a@b.co" })).kind).toBe("not_configured");
    await resetDb();
    await seedEvent({ registrationOpen: false });
    expect((await initiateRegistration({ email: "a@b.co" })).kind).toBe("closed");
  });

  it("releases the place if Flutterwave checkout creation fails", async () => {
    fakeProvider.failInitialize = true;
    expect((await initiateRegistration({ email: "a@b.co" })).kind).toBe("provider_error");
    const a = await db.registrationAttempt.findFirstOrThrow();
    expect(a.reservationStatus).toBe("RELEASED");
  });

  it("price changes only affect new attempts", async () => {
    const { attempt } = await startCheckout("first@example.com");
    await db.event.updateMany({ data: { feeKobo: 2_000_000 } });
    const second = await startCheckout("second@example.com");
    expect(second.attempt.amountKobo).toBe(2_000_000);
    fakeProvider.setStatus(attempt.paymentReference, "success");
    const out = await verifyAndApply(attempt.paymentReference, "CALLBACK");
    expect(out.kind === "processed" && out.attempt.paymentStatus).toBe("PAID");
  });
});

describe("payment verification", () => {
  it("marks a verified successful payment as PAID and unlocks the form", async () => {
    const { attempt } = await startCheckout();
    fakeProvider.setStatus(attempt.paymentReference, "success");
    const out = await verifyAndApply(attempt.paymentReference, "CALLBACK");
    expect(out.kind).toBe("processed");
    if (out.kind !== "processed") return;
    expect(out.becamePaid).toBe(true);
    expect(out.attempt.reservationStatus).toBe("HELD");
    const payment = await db.payment.findUniqueOrThrow({ where: { attemptId: attempt.id } });
    expect(payment).toMatchObject({ status: "PAID", paidAmountKobo: 1_500_000, paidCurrency: "NGN" });
    expect((await getFormAccess(attempt.id)).kind).toBe("ready");
  });

  it("handles a failed payment and releases the reservation", async () => {
    const { attempt } = await startCheckout();
    fakeProvider.setStatus(attempt.paymentReference, "failed");
    const out = await verifyAndApply(attempt.paymentReference, "CALLBACK");
    expect(out.kind === "processed" && out.attempt).toMatchObject({ paymentStatus: "FAILED", reservationStatus: "RELEASED" });
    expect((await getFormAccess(attempt.id)).kind).toBe("payment_problem");
  });

  it("a cancel hint never overrides a payment that is still pending at Flutterwave", async () => {
    const { attempt } = await startCheckout();
    fakeProvider.setStatus(attempt.paymentReference, "pending");
    const out = await verifyAndApply(attempt.paymentReference, "CALLBACK", { cancelled: true });
    expect(out.kind === "processed" && out.attempt).toMatchObject({ paymentStatus: "PENDING", reservationStatus: "ACTIVE" });
  });

  it("keeps a pending payment pending and the form locked", async () => {
    const { attempt } = await startCheckout();
    fakeProvider.setStatus(attempt.paymentReference, "pending");
    const out = await verifyAndApply(attempt.paymentReference, "CALLBACK");
    expect(out.kind === "processed" && out.attempt).toMatchObject({ paymentStatus: "PENDING", reservationStatus: "ACTIVE" });
    expect((await getFormAccess(attempt.id)).kind).toBe("awaiting_payment");
  });

  it("flags a wrong amount as MISMATCH and does not unlock the form", async () => {
    const { attempt } = await startCheckout();
    fakeProvider.setStatus(attempt.paymentReference, "success", { amountKobo: 100 });
    const out = await verifyAndApply(attempt.paymentReference, "WEBHOOK");
    expect(out.kind === "processed" && out.attempt.paymentStatus).toBe("MISMATCH");
    expect((await getFormAccess(attempt.id)).kind).toBe("payment_problem");
  });

  it("flags a wrong currency as MISMATCH", async () => {
    const { attempt } = await startCheckout();
    fakeProvider.setStatus(attempt.paymentReference, "success", { currency: "USD" });
    const out = await verifyAndApply(attempt.paymentReference, "WEBHOOK");
    expect(out.kind === "processed" && out.attempt.paymentStatus).toBe("MISMATCH");
  });

  it("ignores unknown / invalid references", async () => {
    expect((await verifyAndApply("ggz_does_not_exist", "CALLBACK")).kind).toBe("unknown_reference");
  });

  it("a browser redirect without a successful transaction does not mark payment as paid", async () => {
    const { attempt } = await startCheckout();
    // Customer navigates straight to the callback URL (even with ?status=successful) without paying:
    // Flutterwave has no transaction for the reference, so nothing changes.
    const out = await verifyAndApply(attempt.paymentReference, "CALLBACK");
    expect(out.kind).toBe("not_found_at_provider");
    expect((await db.registrationAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).paymentStatus).toBe("PENDING");
    expect(await db.payment.count({ where: { status: "PAID" } })).toBe(0);
    // A cancelled/failed redirect with no provider transaction releases the place.
    const cancelled = await verifyAndApply(attempt.paymentReference, "CALLBACK", { cancelled: true });
    expect(cancelled.kind === "processed" && cancelled.attempt).toMatchObject({ paymentStatus: "ABANDONED", reservationStatus: "RELEASED" });
  });

  it("duplicate / concurrent verification requests create exactly one payment", async () => {
    const { attempt } = await startCheckout();
    fakeProvider.setStatus(attempt.paymentReference, "success");
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => verifyAndApply(attempt.paymentReference, i % 2 ? "WEBHOOK" : "CALLBACK")),
    );
    expect(results.filter((r) => r.kind === "processed" && r.becamePaid)).toHaveLength(1);
    expect(await db.payment.count()).toBe(1);
    // A settled payment is not re-fetched from Flutterwave again.
    const before = fakeProvider.verifyCalls;
    await verifyAndApply(attempt.paymentReference, "CALLBACK");
    expect(fakeProvider.verifyCalls).toBe(before);
  });

  it("reconciles a payment that succeeds after its reservation expired, if space remains", async () => {
    const { attempt } = await startCheckout();
    await db.registrationAttempt.update({ where: { id: attempt.id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    fakeProvider.setStatus(attempt.paymentReference, "success");
    const out = await verifyAndApply(attempt.paymentReference, "WEBHOOK");
    expect(out.kind === "processed" && out.attempt.reservationStatus).toBe("HELD");
  });
});

describe("webhook endpoint", () => {
  it("rejects an invalid signature", async () => {
    const res = await webhook(signedWebhook({ event: "charge.completed", data: { tx_ref: "x" } }, "wrong-hash-wrong-hash"));
    expect(res.status).toBe(401);
  });

  it("processes an authentic charge.completed by re-verifying with Flutterwave", async () => {
    const { attempt } = await startCheckout();
    fakeProvider.setStatus(attempt.paymentReference, "success");
    const res = await webhook(signedWebhook({ event: "charge.completed", data: { tx_ref: attempt.paymentReference, amount: 1, status: "successful" } }));
    expect(res.status).toBe(200);
    const a = await db.registrationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(a.paymentStatus).toBe("PAID");
  });

  it("is idempotent for duplicate deliveries", async () => {
    const { attempt } = await startCheckout();
    fakeProvider.setStatus(attempt.paymentReference, "success");
    const body = { event: "charge.completed", data: { tx_ref: attempt.paymentReference } };
    const statuses = await Promise.all([webhook(signedWebhook(body)), webhook(signedWebhook(body)), webhook(signedWebhook(body))]);
    expect(statuses.map((s) => s.status)).toEqual([200, 200, 200]);
    expect(await db.payment.count()).toBe(1);
  });

  it("does not trust webhook payload status: unverified charge stays unpaid", async () => {
    const { attempt } = await startCheckout();
    // Flutterwave API still says not paid, even though the payload claims success.
    const res = await webhook(signedWebhook({ event: "charge.completed", data: { tx_ref: attempt.paymentReference, status: "successful" } }));
    expect(res.status).toBe(200);
    expect((await db.registrationAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).paymentStatus).not.toBe("PAID");
  });

  it("acknowledges references that are not ours", async () => {
    const res = await webhook(signedWebhook({ event: "charge.completed", data: { tx_ref: "someone_else" } }));
    expect(res.status).toBe(200);
  });
});

describe("paid but form never completed", () => {
  it("is visible to admins and recoverable without paying again", async () => {
    const { attempt } = await startCheckout("ada@example.com");
    fakeProvider.setStatus(attempt.paymentReference, "success");
    await verifyAndApply(attempt.paymentReference, "WEBHOOK");

    const stats = await getDashboardStats();
    expect(stats?.capacity.paidIncomplete).toBe(1);
    expect(stats?.grossVerifiedKobo).toBe(1_500_000);

    // Starting again with the same email never creates a second charge.
    const again = await initiateRegistration({ email: "ADA@example.com" });
    expect(again.kind).toBe("already_paid");
    expect(fakeProvider.initializeCalls).toBe(1);
    expect(await db.registrationAttempt.count()).toBe(1);
    // A recovery link token was issued for that attempt.
    expect(await db.continuationToken.count({ where: { attemptId: attempt.id, purpose: "EMAIL_LINK" } })).toBeGreaterThan(0);
  });

  it("recovery re-verifies a payment the webhook never delivered", async () => {
    const { attempt } = await startCheckout("tobi@example.com");
    fakeProvider.setStatus(attempt.paymentReference, "success"); // paid, browser closed, no webhook
    await requestRecovery("tobi@example.com");
    const a = await db.registrationAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(a.paymentStatus).toBe("PAID");
    expect(await db.continuationToken.count({ where: { attemptId: attempt.id, purpose: "EMAIL_LINK" } })).toBe(1);
  });

  it("recovery for an unknown email issues nothing", async () => {
    await requestRecovery("nobody@example.com");
    expect(await db.continuationToken.count({ where: { purpose: "EMAIL_LINK" } })).toBe(0);
  });
});
