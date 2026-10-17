"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { requestRecoveryAction, type ResumeState } from "@/app/register/actions";
import { inputClass, primaryButton } from "@/components/register/flow-shell";

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
        {state.emailEnabled ? (
          <>
            <p className="font-display text-xl font-bold">Check your inbox</p>
            <p className="text-ink/80">
              We&apos;ve sent an email to <strong className="break-all">{state.sentTo}</strong> telling you exactly what
              to do next — a secure link to finish your form, your registration details if you&apos;re already
              registered, or how to start if no payment was found.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
              <li>It usually arrives within a minute. Check your spam or promotions folder too.</li>
              <li>
                Wrong address?{" "}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="font-semibold underline underline-offset-2"
                >
                  Try again
                </button>{" "}
                with the email you paid with.
              </li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-display text-xl font-bold">Request received</p>
            <p className="text-ink/80">
              We can&apos;t send emails right now. If you paid,{" "}
              <Link href="/help?topic=PAID_NOT_CONFIRMED" className="font-semibold underline underline-offset-2">
                send a request in the Help Center
              </Link>{" "}
              — the organisers can see your payment and will send you a secure link to finish. If you didn&apos;t pay,{" "}
              <Link href="/register" className="font-semibold underline underline-offset-2">
                start your registration
              </Link>
              .
            </p>
          </>
        )}
        <p className="text-sm text-ink/65">
          Nothing after 10 minutes?{" "}
          <Link href="/help?topic=PAID_NOT_CONFIRMED" className="font-semibold underline underline-offset-2">
            Send a request in the Help Center
          </Link>
          .
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
