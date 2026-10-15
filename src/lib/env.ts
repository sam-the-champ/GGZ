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
  // Email option A: any mailbox over SMTP (e.g. Gmail + App Password).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  // Gmail shows App Passwords with spaces ("abcd efgh ijkl mnop"); they're not part of it.
  SMTP_PASS: z
    .string()
    .optional()
    .transform((v) => v?.replace(/\s+/g, "")),
  // Email option B: Resend (needs a verified domain).
  RESEND_API_KEY: z.string().optional(),
  // e.g. "GGZ Camp <ggz@gmail.com>". Defaults to the SMTP account.
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

/** Trims whitespace and one pair of surrounding quotes (common when copying from .env into a dashboard). */
function clean(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const v = value.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return v === "" ? undefined : v;
}

/**
 * Normalises raw variables before validation:
 * - every value is trimmed and unquoted;
 * - APP_URL may omit the scheme ("camp.example.org" → "https://camp.example.org");
 * - on Vercel, APP_URL falls back to the project's production domain.
 */
export function normaliseEnv(raw: Record<string, string | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema.shape)) out[key] = clean(raw[key]);
  const vercelHost = clean(raw.VERCEL_PROJECT_PRODUCTION_URL) ?? clean(raw.VERCEL_URL);
  let appUrl = out.APP_URL ?? (vercelHost ? `https://${vercelHost}` : undefined);
  if (appUrl && !/^https?:\/\//i.test(appUrl)) appUrl = `https://${appUrl}`;
  out.APP_URL = appUrl;
  return out;
}

/** Problems with the environment, naming variables only — never their values. */
export function envProblems(raw: Record<string, string | undefined> = process.env): string[] {
  const parsed = schema.safeParse(normaliseEnv(raw));
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => {
    const name = String(i.path[0] ?? "environment");
    return raw[name] == null || clean(raw[name]) == null ? `${name} is not set` : `${name}: ${i.message}`;
  });
}

/** Validated server environment. Throws a descriptive error on misconfiguration. */
export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(normaliseEnv(process.env));
  if (!parsed.success) {
    throw new Error(`Invalid server environment — ${envProblems().join("; ")}`);
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

/** Which email provider is configured, preferring SMTP. */
export function emailProvider(): "smtp" | "resend" | null {
  const e = env();
  if (e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS) return "smtp";
  if (e.RESEND_API_KEY && e.EMAIL_FROM) return "resend";
  return null;
}

export function emailConfigured() {
  return emailProvider() !== null;
}
