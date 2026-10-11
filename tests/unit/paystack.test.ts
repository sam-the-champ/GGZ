import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidWebhookSignature, paystackBaseUrl } from "@/lib/paystack/client";
import { evaluateTransaction } from "@/lib/services/payments";
import { resetEnvCache } from "@/lib/env";

const attempt = { id: "att_1", paymentReference: "ggz_ref_1", amountKobo: 1_500_000, currency: "NGN" };
const tx = {
  providerId: "1",
  status: "success",
  reference: "ggz_ref_1",
  amountKobo: 1_500_000,
  currency: "NGN",
  channel: "card",
  gatewayResponse: "Approved",
  paidAt: new Date(),
  customerEmail: "a@b.co",
  metadataAttemptId: "att_1",
};

describe("evaluateTransaction", () => {
  it("accepts a matching transaction", () => {
    expect(evaluateTransaction(attempt, tx)).toEqual({ ok: true });
  });
  it("rejects wrong amount, currency, reference and ownership", () => {
    expect(evaluateTransaction(attempt, { ...tx, amountKobo: 100 })).toMatchObject({ ok: false, reason: "amount mismatch" });
    expect(evaluateTransaction(attempt, { ...tx, currency: "USD" })).toMatchObject({ ok: false, reason: "currency mismatch" });
    expect(evaluateTransaction(attempt, { ...tx, reference: "other" })).toMatchObject({ ok: false });
    expect(evaluateTransaction(attempt, { ...tx, metadataAttemptId: "att_2" })).toMatchObject({ ok: false });
  });
});

describe("webhook signatures", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "ggz_x" } });
  const sign = (b: string, key = process.env.PAYSTACK_SECRET_KEY!) => createHmac("sha512", key).update(b).digest("hex");

  it("accepts a correct HMAC-SHA512 signature of the raw body", () => {
    expect(isValidWebhookSignature(body, sign(body))).toBe(true);
  });
  it("rejects missing, wrong-key and tampered signatures", () => {
    expect(isValidWebhookSignature(body, null)).toBe(false);
    expect(isValidWebhookSignature(body, sign(body, "sk_test_other"))).toBe(false);
    expect(isValidWebhookSignature(body + " ", sign(body))).toBe(false);
    expect(isValidWebhookSignature(body, "not-hex")).toBe(false);
  });
});

describe("Paystack base URL override", () => {
  it("is only honoured with a test secret key", () => {
    process.env.PAYSTACK_API_BASE_URL = "http://localhost:4010";
    process.env.PAYSTACK_SECRET_KEY = "sk_test_x";
    resetEnvCache();
    expect(paystackBaseUrl()).toBe("http://localhost:4010");
    process.env.PAYSTACK_SECRET_KEY = "sk_live_x";
    resetEnvCache();
    expect(paystackBaseUrl()).toBe("https://api.paystack.co");
    delete process.env.PAYSTACK_API_BASE_URL;
    process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_tests_only";
    resetEnvCache();
  });
});
