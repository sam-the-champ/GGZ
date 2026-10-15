import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z
    .string()
    .url()
    .transform((v) => v.replace(/\/+$/, "")),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  // The "Secret hash" set in Flutterwave → Settings → Webhooks.
  FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),
  FLUTTERWAVE_API_BASE_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

/** Validated server environment. Throws a descriptive error on misconfiguration. */
export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid server environment — ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests that mutate process.env. */
export function resetEnvCache() {
  cached = null;
}

export function isSecureContext() {
  return env().APP_URL.startsWith("https://");
}

/** Placeholders shipped in .env.example — never usable values. */
export const PLACEHOLDER_SECRET_KEY = "FLWSECK_TEST-replace-me";
export const PLACEHOLDER_WEBHOOK_HASH = "replace-with-your-webhook-secret-hash";

/** Flutterwave secret keys: FLWSECK_TEST-… (test mode) or FLWSECK-… (live). */
export function paymentsConfigured() {
  const key = env().FLUTTERWAVE_SECRET_KEY;
  return Boolean(key && /^FLWSECK(_TEST)?-/.test(key) && key !== PLACEHOLDER_SECRET_KEY);
}

export function paymentsMode(): "test" | "live" | "unconfigured" {
  if (!paymentsConfigured()) return "unconfigured";
  return env().FLUTTERWAVE_SECRET_KEY!.startsWith("FLWSECK_TEST-") ? "test" : "live";
}

export function webhookHashConfigured() {
  const hash = env().FLUTTERWAVE_WEBHOOK_HASH;
  return Boolean(hash && hash.length >= 16 && hash !== PLACEHOLDER_WEBHOOK_HASH);
}

export function emailConfigured() {
  const e = env();
  return Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
}
