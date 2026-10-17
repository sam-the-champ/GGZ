import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacSha256 } from "@/lib/crypto";

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  initiate: { limit: 8, windowSeconds: 10 * 60 },
  initiateEmail: { limit: 5, windowSeconds: 60 * 60 },
  verify: { limit: 40, windowSeconds: 10 * 60 },
  formSubmit: { limit: 15, windowSeconds: 10 * 60 },
  recovery: { limit: 5, windowSeconds: 15 * 60 },
  recoveryEmail: { limit: 3, windowSeconds: 60 * 60 },
  webhook: { limit: 300, windowSeconds: 60 },
  adminLogin: { limit: 10, windowSeconds: 15 * 60 },
  adminSensitive: { limit: 60, windowSeconds: 10 * 60 },
  helpRequest: { limit: 5, windowSeconds: 60 * 60 },
  helpRequestEmail: { limit: 5, windowSeconds: 24 * 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

/**
 * Fixed-window counter stored in PostgreSQL, so limits hold across serverless
 * instances without extra infrastructure. Identifiers (IPs, emails) are
 * HMAC-ed so the table never holds raw personal data.
 */
export async function rateLimit(
  scope: keyof typeof RATE_LIMITS,
  identifier: string,
  now = new Date(),
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[scope];
  const key = `${scope}:${hmacSha256(env().APP_SECRET, identifier.toLowerCase())}`;
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);

  // Atomic upsert: reset the counter when a new window starts.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, ${windowStart}, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" = EXCLUDED."windowStart"
                     THEN "RateLimitBucket"."count" + 1 ELSE 1 END,
      "windowStart" = EXCLUDED."windowStart",
      "expiresAt" = EXCLUDED."expiresAt"
    RETURNING "count"
  `;
  const count = Number(rows[0]?.count ?? 1);
  return {
    ok: count <= rule.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}
