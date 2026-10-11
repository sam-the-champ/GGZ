import "server-only";
import { emailConfigured, env } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

/**
 * Sends a transactional email through Resend's REST API. Email is optional:
 * when it is not configured this returns `{ sent: false }` and callers fall
 * back to on-screen instructions / admin-issued recovery links.
 */
export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean }> {
  if (!emailConfigured()) return { sent: false };
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[email] send failed", res.status);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send error", (err as Error).message);
    return { sent: false };
  }
}
