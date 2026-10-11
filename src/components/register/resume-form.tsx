"use client";

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
      <div role="status" className="mt-8 rounded-2xl bg-palm/10 p-5">
        <p className="font-display text-xl font-bold">Check your inbox</p>
        <p className="mt-2 text-ink/80">
          {state.emailEnabled
            ? "If we found a verified payment for that email, we've sent a secure link to finish your registration. It works once and expires in 2 hours. Check your spam folder too."
            : `If we found a verified payment for that email, the organisers can send you a secure link. Please contact ${site.contact.name} on ${site.contact.phoneDisplay}.`}
        </p>
        <p className="mt-3 text-sm text-ink/65">
          Didn&apos;t get anything after a few minutes? Contact {site.contact.name} on {site.contact.phoneDisplay}.
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
