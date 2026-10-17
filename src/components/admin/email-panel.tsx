"use client";

import { useActionState } from "react";
import { sendPendingConfirmationsAction, sendTestEmailAction, type ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function EmailPanel({
  provider,
  sender,
  canTest,
  pendingConfirmations = 0,
}: {
  provider: "smtp" | "resend" | null;
  sender: string | null;
  canTest: boolean;
  pendingConfirmations?: number;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(sendTestEmailAction, {});
  const [catchUp, catchUpAction, catchingUp] = useActionState<ActionResult, FormData>(sendPendingConfirmationsAction, {});
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Email</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${provider ? "bg-palm/15 text-palm" : "bg-sun/50 text-ink"}`}
        >
          {provider ? `Connected (${provider === "smtp" ? "SMTP mailbox" : "Resend"})` : "Not connected"}
        </span>
      </div>
      {provider ? (
        <p className="mt-2 text-sm text-ink/70">
          Sending as <span className="font-semibold">{sender}</span>. Participants receive confirmations, “payment
          received” links and recovery links.
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink/70">
          No emails are being sent. Participants who pay but lose the page must contact you, and you send them a
          recovery link from their registration page. Connect email by adding <code>SMTP_HOST</code>,{" "}
          <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> and <code>EMAIL_FROM</code> in Vercel,
          then redeploy.
        </p>
      )}
      {canTest && provider && (
        <form action={action} className="mt-4">
          <Button type="submit" variant="outline" size="sm" disabled={pending} className="rounded-full">
            {pending ? "Sending…" : "Send me a test email"}
          </Button>
          {state.message && (
            <p
              role="status"
              className={`mt-2 rounded-xl p-3 text-sm ${state.ok === false ? "bg-destructive/10 text-destructive" : "bg-palm/10"}`}
            >
              {state.message}
            </p>
          )}
        </form>
      )}
      {canTest && provider && pendingConfirmations > 0 && (
        <form action={catchUpAction} className="mt-4 rounded-xl bg-sun/25 p-3">
          <p className="text-sm">
            <strong>{pendingConfirmations}</strong> registered participant{pendingConfirmations === 1 ? " hasn't" : "s haven't"}{" "}
            received a confirmation email (registered before email was connected, or sending failed). The daily job
            retries automatically, or send them now:
          </p>
          <Button type="submit" size="sm" disabled={catchingUp} className="mt-2 rounded-full">
            {catchingUp
              ? "Sending…"
              : `Send ${pendingConfirmations} confirmation email${pendingConfirmations === 1 ? "" : "s"}`}
          </Button>
          {catchUp.message && (
            <p
              role="status"
              className={`mt-2 rounded-xl p-2 text-sm ${catchUp.ok === false ? "bg-destructive/10 text-destructive" : "bg-palm/10"}`}
            >
              {catchUp.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
