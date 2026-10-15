import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env, paymentsConfigured, webhookHashConfigured } from "@/lib/env";

/**
 * Server-only Flutterwave (v3) integration.
 *
 * - Checkout:  POST /v3/payments → hosted payment link (Flutterwave Standard)
 * - Verify:    GET  /v3/transactions/verify_by_reference?tx_ref=…
 * - Webhooks:  `verif-hash` header must equal the dashboard "secret hash"
 *
 * Flutterwave amounts are in MAJOR units (naira). The app stores kobo, so
 * conversion happens only in this file.
 */
const LIVE_BASE_URL = "https://api.flutterwave.com";

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

function secretKey(): string {
  const key = env().FLUTTERWAVE_SECRET_KEY;
  if (!key || !paymentsConfigured()) {
    throw new PaymentProviderError("Flutterwave secret key is not configured");
  }
  return key;
}

/**
 * The API base URL may only be overridden (to the local mock server used by
 * automated tests) with a *test* secret key, so a misconfigured production
 * deployment can never be pointed at a fake payment provider.
 */
export function providerBaseUrl(): string {
  const override = env().FLUTTERWAVE_API_BASE_URL;
  if (override && secretKey().startsWith("FLWSECK_TEST-")) return override.replace(/\/+$/, "");
  return LIVE_BASE_URL;
}

export const koboToMajor = (kobo: number) => kobo / 100;
export const majorToKobo = (amount: number) => Math.round(amount * 100);

async function call<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${providerBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new PaymentProviderError(`Network error contacting Flutterwave: ${(err as Error).message}`);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (json as { message?: string } | null)?.message ?? res.statusText;
    throw new PaymentProviderError(`Flutterwave ${path.split("?")[0]} failed: ${msg}`, res.status);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new PaymentProviderError(`Unexpected Flutterwave response for ${path.split("?")[0]}`);
  return parsed.data;
}

// ─── Create checkout ────────────────────────────────────────────────────────

const paymentResponse = z.object({
  status: z.literal("success"),
  data: z.object({ link: z.string().url() }),
});

export type InitializeInput = {
  email: string;
  amountKobo: number;
  currency: string;
  reference: string;
  redirectUrl: string;
  meta: Record<string, string>;
  title: string;
  description: string;
};

export async function initializeTransaction(input: InitializeInput) {
  const res = await call(
    "/v3/payments",
    {
      method: "POST",
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: koboToMajor(input.amountKobo),
        currency: input.currency,
        redirect_url: input.redirectUrl,
        customer: { email: input.email },
        meta: input.meta,
        customizations: { title: input.title, description: input.description },
      }),
    },
    paymentResponse,
  );

  // Only ever send participants to Flutterwave's own checkout domain (or the
  // local mock, which is only reachable with a test key).
  const checkout = new URL(res.data.link);
  const usingMock = providerBaseUrl() !== LIVE_BASE_URL;
  const trusted =
    (checkout.protocol === "https:" &&
      (checkout.hostname === "flutterwave.com" || checkout.hostname.endsWith(".flutterwave.com"))) ||
    (usingMock && checkout.origin === new URL(providerBaseUrl()).origin);
  if (!trusted) throw new PaymentProviderError("Untrusted checkout URL returned");

  return { authorizationUrl: res.data.link };
}

// ─── Verify ─────────────────────────────────────────────────────────────────

const verifyResponse = z.object({
  status: z.string(),
  data: z
    .object({
      id: z.union([z.number(), z.string()]).transform(String),
      tx_ref: z.string(),
      amount: z.union([z.number(), z.string()]).transform(Number),
      currency: z.string(),
      status: z.string(),
      payment_type: z.string().nullish(),
      processor_response: z.string().nullish(),
      created_at: z.string().nullish(),
      customer: z.object({ email: z.string().nullish() }).partial().nullish(),
      meta: z.unknown().optional(),
    })
    .nullable(),
});

/** Provider status normalised to the vocabulary used by the payment service. */
export type NormalisedStatus = "success" | "failed" | "pending" | "abandoned" | "reversed";

export type VerifiedTransaction = {
  providerId: string;
  status: NormalisedStatus;
  reference: string;
  amountKobo: number;
  currency: string;
  channel: string | null;
  gatewayResponse: string | null;
  paidAt: Date | null;
  customerEmail: string | null;
  metadataAttemptId: string | null;
};

export function normaliseStatus(raw: string): NormalisedStatus {
  switch (raw.toLowerCase()) {
    case "successful":
    case "success":
    case "completed":
      return "success";
    case "failed":
    case "error":
      return "failed";
    case "cancelled":
    case "canceled":
      return "abandoned";
    case "reversed":
    case "refunded":
      return "reversed";
    default:
      // "pending" and anything unrecognised: keep waiting, never grant value.
      return "pending";
  }
}

/**
 * Returns null when Flutterwave has no transaction for this reference
 * (e.g. the checkout page was opened and closed without an attempt).
 */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction | null> {
  let res: z.infer<typeof verifyResponse>;
  try {
    res = await call(
      `/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { method: "GET" },
      verifyResponse,
    );
  } catch (err) {
    if (err instanceof PaymentProviderError && (err.httpStatus === 404 || err.httpStatus === 400)) {
      return null;
    }
    throw err;
  }
  const d = res.data;
  if (!d) return null;
  const status = normaliseStatus(d.status);
  return {
    providerId: d.id,
    status,
    reference: d.tx_ref,
    amountKobo: majorToKobo(d.amount),
    currency: d.currency.toUpperCase(),
    channel: d.payment_type ?? null,
    gatewayResponse: d.processor_response?.slice(0, 200) ?? null,
    paidAt: status === "success" && d.created_at ? new Date(d.created_at) : null,
    customerEmail: d.customer?.email ?? null,
    metadataAttemptId: extractAttemptId(d.meta),
  };
}

function extractAttemptId(meta: unknown): string | null {
  if (meta && typeof meta === "object" && "attempt_id" in meta) {
    const v = (meta as { attempt_id: unknown }).attempt_id;
    return typeof v === "string" ? v : null;
  }
  return null;
}

// ─── Webhook authenticity ───────────────────────────────────────────────────

/**
 * Flutterwave sends the "secret hash" configured in the dashboard in the
 * `verif-hash` header. Compare in constant time. Payload contents are still
 * never trusted — the transaction is re-verified through the API.
 */
export function isValidWebhookHash(header: string | null): boolean {
  if (!header || !webhookHashConfigured()) return false;
  const expected = Buffer.from(env().FLUTTERWAVE_WEBHOOK_HASH!, "utf8");
  const received = Buffer.from(header, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
