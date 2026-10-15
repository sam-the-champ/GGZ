"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { requestRecoveryAction, type ResumeState } from "@/app/register/actions";
import { inputClass, primaryButton } from "@/components/register/flow-shell";
import { site } from "@/content/site";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={primaryButton}>
      {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Checking…" : "Send me a secure link"}
    </button>
  );
}

export function ResumeForm() {
  const [state, action] = useActionState<ResumeState, FormData>(requestRecoveryAction, {});
  if (state.done) {
    return (
      <div role="status" className="mt-8 space-y-4 rounded-2xl bg-palm/10 p-5">
        <p className="font-display text-xl font-bold">
          {state.emailEnabled ? "Check your inbox" : "Request received"}
        </p>
        <ul className="space-y-3 text-ink/80">
          <li>
            <strong>If you paid</strong> with that email:{" "}
            {state.emailEnabled
              ? "we've emailed you a secure link to finish your registration. It works once and expires in 2 hours — check your spam folder too."
              : `please contact ${site.contact.name} on ${site.contact.phoneDisplay}. The organisers can see your payment and will send you a secure link to finish.`}
          </li>
          <li>
            <strong>If you didn&apos;t complete a payment</strong>, there&apos;s nothing to resume and no email will be
            sent. Simply{" "}
            <Link href="/register" className="font-semibold underline underline-offset-2">
              start your registration
            </Link>{" "}
            again — you haven&apos;t been charged.
          </li>
        </ul>
        <p className="text-sm text-ink/65">
          Still stuck? Contact {site.contact.name} on {site.contact.phoneDisplay}.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="font-semibold">
          Email you paid with
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "resume-error" : undefined}
          className={`${inputClass} h-14 text-lg`}
        />
      </div>
      {state.error && (
        <p id="resume-error" role="alert" className="rounded-2xl bg-destructive/10 p-4 font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Submit />
    </form>
  );
}
