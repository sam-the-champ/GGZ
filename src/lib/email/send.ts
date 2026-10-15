import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { emailProvider, env } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

/**
 * Sends a transactional email. Two providers are supported:
 *
 * - SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS) — any mailbox, e.g. a Gmail account
 *   with an App Password. Works without owning a domain.
 * - Resend (RESEND_API_KEY) — needs a verified sending domain.
 *
 * Email is optional: when neither is configured this returns `{ sent: false }`
 * and callers fall back to on-screen instructions / admin-issued links.
 * Failures are logged and never thrown, so a mail outage can't break payments.
 */
export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean; error?: string }> {
  const provider = emailProvider();
  if (!provider) return { sent: false, error: "Email is not configured" };
  try {
    if (provider === "smtp") await sendViaSmtp(message);
    else await sendViaResend(message);
    return { sent: true };
  } catch (err) {
    const error = (err as Error).message.slice(0, 300);
    console.error(`[email] ${provider} send failed:`, error);
    return { sent: false, error };
  }
}

export function senderAddress(): string {
  const e = env();
  return e.EMAIL_FROM ?? `GGZ Camp <${e.SMTP_USER}>`;
}

let transporter: Transporter | null = null;

function smtp(): Transporter {
  if (transporter) return transporter;
  const e = env();
  const port = e.SMTP_PORT ?? 465;
  transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 upgrades with STARTTLS
    requireTLS: port !== 465,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

async function sendViaSmtp(message: EmailMessage) {
  await smtp().sendMail({ from: senderAddress(), ...message });
}

async function sendViaResend(message: EmailMessage) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: senderAddress(), ...message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Resend ${res.status}: ${body?.message ?? res.statusText}`);
  }
}
