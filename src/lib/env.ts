import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z
    .string()
    .url()
    .transform((v) => v.replace(/\/+$/, "")),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_API_BASE_URL: z.string().url().optional(),
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

/** The placeholder shipped in .env.example — never a usable key. */
export const PLACEHOLDER_PAYSTACK_KEY = "sk_test_replace_me";

export function paystackConfigured() {
  const key = env().PAYSTACK_SECRET_KEY;
  return Boolean(key && /^sk_(test|live)_/.test(key) && key !== PLACEHOLDER_PAYSTACK_KEY);
}

export function paystackMode(): "test" | "live" | "unconfigured" {
  if (!paystackConfigured()) return "unconfigured";
  const key = env().PAYSTACK_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return "unconfigured";
}

export function emailConfigured() {
  const e = env();
  return Boolean(e.RESEND_API_KEY && e.EMAIL_FROM);
}
