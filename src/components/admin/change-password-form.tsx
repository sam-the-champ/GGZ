"use client";

import { useActionState } from "react";
import { changePasswordAction, type PasswordState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const input =
  "mt-1 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-sunset focus:ring-4 focus:ring-sunset/20 aria-[invalid=true]:border-destructive";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  const err = (f: string) => (state.ok === false && state.field === f ? state.message : undefined);
  const row = (name: string, label: string, autoComplete: string, hint?: string) => (
    <div>
      <label htmlFor={name} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        required
        autoComplete={autoComplete}
        aria-invalid={Boolean(err(name))}
        aria-describedby={err(name) ? `${name}-err` : undefined}
        className={input}
      />
      {hint && !err(name) && <p className="mt-1 text-xs text-ink/60">{hint}</p>}
      {err(name) && (
        <p id={`${name}-err`} className="mt-1 text-sm font-semibold text-destructive">
          {err(name)}
        </p>
      )}
    </div>
  );
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
      <h2 className="font-display text-lg font-bold">Change password</h2>
      {row("current", "Current password", "current-password")}
      {row("next", "New password", "new-password", "At least 12 characters, mixing letters with numbers or symbols.")}
      {row("confirm", "Confirm new password", "new-password")}
      {state.message && !state.field && (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm ${state.ok ? "bg-palm/10" : "bg-destructive/10 text-destructive"}`}
        >
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11 rounded-full px-6">
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
