import { describe, expect, it } from "vitest";
import {
  isValidWebhookHash,
  koboToMajor,
  majorToKobo,
  normaliseStatus,
  providerBaseUrl,
} from "@/lib/flutterwave/client";
import { evaluateTransaction } from "@/lib/services/payments";
import { paymentsConfigured, paymentsMode, resetEnvCache } from "@/lib/env";

const attempt = { id: "att_1", paymentReference: "ggz_ref_1", amountKobo: 2_000_000, currency: "NGN" };
const tx = {
  providerId: "1",
  status: "success" as const,
  reference: "ggz_ref_1",
  amountKobo: 2_000_000,
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

describe("amount units", () => {
  it("sends naira to Flutterwave and stores kobo", () => {
    expect(koboToMajor(2_000_000)).toBe(20000);
    expect(koboToMajor(1_500_050)).toBe(15000.5);
    expect(majorToKobo(20000)).toBe(2_000_000);
    expect(majorToKobo(15000.5)).toBe(1_500_050);
    expect(majorToKobo(0.1 + 0.2)).toBe(30); // no float drift
  });
});

describe("status normalisation", () => {
  it("maps Flutterwave statuses", () => {
    expect(normaliseStatus("successful")).toBe("success");
    expect(normaliseStatus("failed")).toBe("failed");
    expect(normaliseStatus("pending")).toBe("pending");
    expect(normaliseStatus("cancelled")).toBe("abandoned");
    expect(normaliseStatus("something-new")).toBe("pending");
  });
});

describe("webhook secret hash", () => {
  it("accepts the configured hash and rejects anything else", () => {
    expect(isValidWebhookHash("unit-test-webhook-secret-hash")).toBe(true);
    expect(isValidWebhookHash(null)).toBe(false);
    expect(isValidWebhookHash("")).toBe(false);
    expect(isValidWebhookHash("unit-test-webhook-secret-hasX")).toBe(false);
    expect(isValidWebhookHash("unit-test-webhook-secret-hash-longer")).toBe(false);
  });
  it("rejects every request when no hash is configured", () => {
    const saved = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    delete process.env.FLUTTERWAVE_WEBHOOK_HASH;
    resetEnvCache();
    expect(isValidWebhookHash("")).toBe(false);
    expect(isValidWebhookHash("anything")).toBe(false);
    process.env.FLUTTERWAVE_WEBHOOK_HASH = saved;
    resetEnvCache();
  });
});

describe("configuration", () => {
  it("recognises test and live keys and rejects the placeholder", () => {
    const saved = process.env.FLUTTERWAVE_SECRET_KEY;
    const set = (k: string) => {
      process.env.FLUTTERWAVE_SECRET_KEY = k;
      resetEnvCache();
    };
    set("FLWSECK_TEST-abc123-X");
    expect(paymentsMode()).toBe("test");
    set("FLWSECK-abc123-X");
    expect(paymentsMode()).toBe("live");
    set("FLWSECK_TEST-replace-me");
    expect(paymentsConfigured()).toBe(false);
    set("sk_test_paystack_style");
    expect(paymentsConfigured()).toBe(false);
    set(saved!);
  });

  it("only honours the API base URL override with a test key", () => {
    const saved = process.env.FLUTTERWAVE_SECRET_KEY;
    process.env.FLUTTERWAVE_API_BASE_URL = "http://localhost:4010";
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-x-X";
    resetEnvCache();
    expect(providerBaseUrl()).toBe("http://localhost:4010");
    process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK-live-x-X";
    resetEnvCache();
    expect(providerBaseUrl()).toBe("https://api.flutterwave.com");
    delete process.env.FLUTTERWAVE_API_BASE_URL;
    process.env.FLUTTERWAVE_SECRET_KEY = saved;
    resetEnvCache();
  });
});
