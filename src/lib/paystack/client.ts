import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";

const LIVE_BASE_URL = "https://api.paystack.co";

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

function secretKey(): string {
  const key = env().PAYSTACK_SECRET_KEY;
  if (!key || !/^sk_(test|live)_/.test(key)) {
    throw new PaystackError("Paystack secret key is not configured");
  }
  return key;
}

/**
 * The API base URL may only be overridden (to the local mock server used by
 * automated tests) when running with a *test* secret key, so a misconfigured
 * production deployment can never be pointed at a fake payment provider.
 */
export function paystackBaseUrl(): string {
  const override = env().PAYSTACK_API_BASE_URL;
  if (override && secretKey().startsWith("sk_test_")) return override.replace(/\/+$/, "");
  return LIVE_BASE_URL;
}

async function call<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${paystackBaseUrl()}${path}`, {
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
    throw new PaystackError(`Network error contacting Paystack: ${(err as Error).message}`);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (json as { message?: string } | null)?.message ?? res.statusText;
    throw new PaystackError(`Paystack ${path} failed: ${msg}`, res.status);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new PaystackError(`Unexpected Paystack response for ${path}`);
  return parsed.data;
}

// ─── Initialize ─────────────────────────────────────────────────────────────

const initializeResponse = z.object({
  status: z.literal(true),
  data: z.object({
    authorization_url: z.string().url(),
    access_code: z.string(),
    reference: z.string(),
  }),
});

export type InitializeInput = {
  email: string;
  amountKobo: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
};

export async function initializeTransaction(input: InitializeInput) {
  const res = await call(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: String(input.amountKobo),
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    },
    initializeResponse,
  );
  if (res.data.reference !== input.reference) {
    throw new PaystackError("Paystack returned a different reference");
  }
  // Only ever redirect participants to Paystack's own checkout domain
  // (or the local mock, which is only reachable with a test key).
  const checkout = new URL(res.data.authorization_url);
  const usingMock = paystackBaseUrl() !== LIVE_BASE_URL;
  const trusted =
    (checkout.protocol === "https:" && (checkout.hostname === "paystack.com" || checkout.hostname.endsWith(".paystack.com"))) ||
    (usingMock && checkout.origin === new URL(paystackBaseUrl()).origin);
  if (!trusted) throw new PaystackError("Untrusted checkout URL returned");
  return { authorizationUrl: res.data.authorization_url, accessCode: res.data.access_code };
}

// ─── Verify ─────────────────────────────────────────────────────────────────

const verifyResponse = z.object({
  status: z.boolean(),
  data: z.object({
    id: z.union([z.number(), z.string()]).transform(String),
    status: z.string(),
    reference: z.string(),
    amount: z.number().int(),
    currency: z.string(),
    channel: z.string().nullish(),
    gateway_response: z.string().nullish(),
    paid_at: z.string().nullish(),
    customer: z.object({ email: z.string().nullish() }).partial().nullish(),
    metadata: z.unknown().optional(),
  }),
});

export type VerifiedTransaction = {
  providerId: string;
  /** Raw Paystack status: success | failed | abandoned | ongoing | pending | processing | queued | reversed */
  status: string;
  reference: string;
  amountKobo: number;
  currency: string;
  channel: string | null;
  gatewayResponse: string | null;
  paidAt: Date | null;
  customerEmail: string | null;
  metadataAttemptId: string | null;
};

/**
 * Returns null when Paystack has no transaction for this reference
 * (e.g. checkout was never opened).
 */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction | null> {
  let res: z.infer<typeof verifyResponse>;
  try {
    res = await call(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: "GET" },
      verifyResponse,
    );
  } catch (err) {
    if (err instanceof PaystackError && (err.httpStatus === 404 || err.httpStatus === 400)) {
      return null;
    }
    throw err;
  }
  const d = res.data;
  return {
    providerId: d.id,
    status: d.status.toLowerCase(),
    reference: d.reference,
    amountKobo: d.amount,
    currency: d.currency.toUpperCase(),
    channel: d.channel ?? null,
    gatewayResponse: d.gateway_response?.slice(0, 200) ?? null,
    paidAt: d.paid_at ? new Date(d.paid_at) : null,
    customerEmail: d.customer?.email ?? null,
    metadataAttemptId: extractAttemptId(d.metadata),
  };
}

function extractAttemptId(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "attempt_id" in metadata) {
    const v = (metadata as { attempt_id: unknown }).attempt_id;
    return typeof v === "string" ? v : null;
  }
  // Paystack sometimes returns metadata as a JSON string.
  if (typeof metadata === "string") {
    try {
      return extractAttemptId(JSON.parse(metadata));
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Webhook signature ──────────────────────────────────────────────────────

/**
 * Paystack signs the *raw* request body with HMAC-SHA512 using the secret key
 * and sends the hex digest in the `x-paystack-signature` header.
 */
export function isValidWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}
