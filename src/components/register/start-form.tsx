"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle, Lock } from "lucide-react";
import { startRegistrationAction, type StartState } from "@/app/register/actions";
import { inputClass, primaryButton } from "@/components/register/flow-shell";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={primaryButton}>
      {pending ? (
        <>
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> Opening secure checkout…
        </>
      ) : (
        <>
          {label} <ArrowRight className="size-5" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

export function StartForm({ feeLabel }: { feeLabel: string }) {
  const [state, action] = useActionState<StartState, FormData>(startRegistrationAction, {});
  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="block font-semibold">
          Email address
        </label>
        <p id="email-hint" className="text-sm text-ink/65">
          Used for your Paystack receipt and to send your secure registration link.
        </p>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-describedby={state.error ? "email-hint start-error" : "email-hint"}
          aria-invalid={Boolean(state.error)}
          className={`${inputClass} h-14 text-lg`}
          placeholder="you@example.com"
        />
      </div>
      <label className="flex gap-3 rounded-2xl bg-sand p-4 text-sm leading-relaxed">
        <input type="checkbox" name="acceptPolicies" required className="mt-0.5 size-5 shrink-0 accent-[#f26b1d]" />
        <span>
          I have read the{" "}
          <Link href="/terms" target="_blank" className="font-semibold underline underline-offset-2">
            registration terms &amp; refund policy
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" target="_blank" className="font-semibold underline underline-offset-2">
            privacy notice
          </Link>
          .
        </span>
      </label>

      {state.error && (
        <p id="start-error" role="alert" className="rounded-2xl bg-destructive/10 p-4 font-semibold text-destructive">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="rounded-2xl bg-palm/15 p-4 font-semibold text-palm">
          {state.notice}
        </p>
      )}

      <SubmitButton label={`Pay ${feeLabel} securely`} />
      <p className="flex items-center gap-1.5 text-xs text-ink/60">
        <Lock className="size-3.5 shrink-0" aria-hidden="true" /> You&apos;ll be taken to Paystack&apos;s secure
        checkout. We never see or store your card details.
      </p>
    </form>
  );
}
