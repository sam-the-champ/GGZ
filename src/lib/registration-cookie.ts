import "server-only";
import { cookies } from "next/headers";
import { isSecureContext } from "@/lib/env";
import { resolveSessionToken, SESSION_TOKEN_TTL_MS } from "@/lib/services/continuation";

const NAME = "ggz_reg";

/**
 * httpOnly continuation cookie. SameSite=Lax so it is sent on the top-level
 * redirect back from Paystack's checkout page.
 */
export async function setRegistrationCookie(token: string) {
  (await cookies()).set(NAME, token, {
    httpOnly: true,
    secure: isSecureContext(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TOKEN_TTL_MS / 1000,
  });
}

/** Attempt ID proven by this browser's cookie (validated server-side), or null. */
export async function getSessionAttemptId(): Promise<string | null> {
  const raw = (await cookies()).get(NAME)?.value;
  return resolveSessionToken(raw);
}
