import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting. On Vercel, x-forwarded-for is set
 * by the platform edge; the left-most entry is the client.
 */
export function ipFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers());
}
