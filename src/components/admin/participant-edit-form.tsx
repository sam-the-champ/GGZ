"use client";

import { useActionState, useState } from "react";
import {
  resendConfirmationAction,
  updateParticipantAction,
  type ActionResult,
  type FormActionResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

type Values = {
  fullName: string;
  phone: string;
  cityOrState: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  supportNeeds: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
};

const input =
  "mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-sunset focus:ring-4 focus:ring-sunset/20 aria-[invalid=true]:border-destructive";

export function ParticipantEditForm({
  attemptId,
  values,
  hasGuardian,
}: {
  attemptId: string;
  values: Values;
  hasGuardian: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormActionResult, FormData>(updateParticipantAction, {});
  const errors = state.errors ?? {};

  if (!open) {
    return (
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
        <p className="text-sm text-ink/70">Correct a typo in the participant&apos;s details. Changes are audited.</p>
        <Button type="button" size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => setOpen(true)}>
          Edit details
        </Button>
        {state.message && <p role="status" className="mt-2 rounded-xl bg-palm/10 p-3 text-sm">{state.message}</p>}
      </div>
    );
  }

  const field = (name: keyof Values, label: string, opts: { textarea?: boolean } = {}) => (
    <div>
      <label htmlFor={`edit-${name}`} className="text-sm font-semibold">
        {label}
      </label>
      {opts.textarea ? (
        <textarea
          id={`edit-${name}`}
          name={name}
          rows={2}
          defaultValue={values[name]}
          aria-invalid={Boolean(errors[name])}
          className={`${input} h-auto py-2`}
        />
      ) : (
        <input
          id={`edit-${name}`}
          name={name}
          defaultValue={values[name]}
          aria-invalid={Boolean(errors[name])}
          className={input}
        />
      )}
      {errors[name] && <p className="mt-1 text-xs font-semibold text-destructive">{errors[name]}</p>}
    </div>
  );

  return (
    <form action={action} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
      <input type="hidden" name="attemptId" value={attemptId} />
      {field("fullName", "Full name")}
      {field("phone", "Phone")}
      {field("cityOrState", "City/State")}
      {field("emergencyContactName", "Emergency contact name")}
      {field("emergencyContactPhone", "Emergency contact phone")}
      {field("supportNeeds", "Support needs", { textarea: true })}
      {hasGuardian && (
        <>
          {field("guardianName", "Guardian name")}
          {field("guardianPhone", "Guardian phone")}
          {field("guardianEmail", "Guardian email")}
        </>
      )}
      <p className="text-xs text-ink/60">Email, date of birth and consent records can&apos;t be changed here.</p>
      {state.message && (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${state.ok === false ? "bg-destructive/10 text-destructive" : "bg-palm/10"}`}
        >
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending} className="rounded-full">
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}

export function ResendConfirmationButton({ attemptId }: { attemptId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(resendConfirmationAction, {});
  return (
    <form action={action} className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
      <input type="hidden" name="attemptId" value={attemptId} />
      <p className="text-sm text-ink/70">Email the participant their confirmation and registration number again.</p>
      <Button type="submit" size="sm" variant="outline" disabled={pending} className="mt-3 rounded-full">
        {pending ? "Sending…" : "Resend confirmation email"}
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
  );
}
