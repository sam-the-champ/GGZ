"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/app/admin/actions";
import type { SettingsResult } from "@/lib/services/admin";
import { Button } from "@/components/ui/button";

type Initial = {
  feeNaira: string;
  capacity: string;
  reservationMinutes: number;
  feeCovers: string;
  refundPolicy: string;
  minimumAge: string;
  guardianConsentAge: number;
  registrationOpen: boolean;
};

const input =
  "mt-1 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-sunset focus:ring-4 focus:ring-sunset/20 disabled:bg-ink/5";

export function SettingsForm({ initial, readOnly }: { initial: Initial; readOnly: boolean }) {
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(saveSettingsAction, null);
  const errors = state && !state.ok ? state.errors : {};
  const err = (k: string) =>
    errors[k] ? <p id={`${k}-err`} className="mt-1 text-sm font-semibold text-destructive">{errors[k]}</p> : null;
  const aria = (k: string) => ({ "aria-invalid": Boolean(errors[k]), "aria-describedby": errors[k] ? `${k}-err` : undefined });

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={readOnly} className="space-y-6">
        <section className="grid gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-bold sm:col-span-2">Fee and capacity</h2>
          <div>
            <label htmlFor="feeNaira" className="text-sm font-semibold">Registration fee (₦)</label>
            <input id="feeNaira" name="feeNaira" inputMode="decimal" defaultValue={initial.feeNaira} placeholder="Not set" className={input} {...aria("feeNaira")} />
            <p className="mt-1 text-xs text-ink/60">Applies to new checkouts only. Existing attempts keep the amount they started with.</p>
            {err("feeNaira")}
          </div>
          <div>
            <label htmlFor="capacity" className="text-sm font-semibold">Maximum capacity (places)</label>
            <input id="capacity" name="capacity" inputMode="numeric" defaultValue={initial.capacity} placeholder="Not set" className={input} {...aria("capacity")} />
            <p className="mt-1 text-xs text-ink/60">Lowering it below current commitments blocks new reservations; nobody is removed.</p>
            {err("capacity")}
          </div>
          <div>
            <label htmlFor="reservationMinutes" className="text-sm font-semibold">Checkout reservation (minutes)</label>
            <input id="reservationMinutes" name="reservationMinutes" type="number" min={10} max={120} defaultValue={initial.reservationMinutes} className={input} {...aria("reservationMinutes")} />
            <p className="mt-1 text-xs text-ink/60">How long an unpaid checkout holds a place (10–120).</p>
            {err("reservationMinutes")}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="feeCovers" className="text-sm font-semibold">What the fee covers (shown publicly)</label>
            <textarea id="feeCovers" name="feeCovers" rows={3} defaultValue={initial.feeCovers} className={`${input} h-auto py-2`} {...aria("feeCovers")} />
            {err("feeCovers")}
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-bold sm:col-span-2">Policies</h2>
          <div className="sm:col-span-2">
            <label htmlFor="refundPolicy" className="text-sm font-semibold">Refund &amp; cancellation policy (required to open registration)</label>
            <textarea id="refundPolicy" name="refundPolicy" rows={5} defaultValue={initial.refundPolicy} placeholder="Paste the organiser-approved policy" className={`${input} h-auto py-2`} {...aria("refundPolicy")} />
            <p className="mt-1 text-xs text-ink/60">Shown before payment and on the registration terms page.</p>
            {err("refundPolicy")}
          </div>
          <div>
            <label htmlFor="minimumAge" className="text-sm font-semibold">Minimum age (optional)</label>
            <input id="minimumAge" name="minimumAge" inputMode="numeric" defaultValue={initial.minimumAge} placeholder="No minimum set" className={input} {...aria("minimumAge")} />
            {err("minimumAge")}
          </div>
          <div>
            <label htmlFor="guardianConsentAge" className="text-sm font-semibold">Guardian consent required under age</label>
            <input id="guardianConsentAge" name="guardianConsentAge" type="number" min={13} max={21} defaultValue={initial.guardianConsentAge} className={input} {...aria("guardianConsentAge")} />
            {err("guardianConsentAge")}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="registrationOpen" defaultChecked={initial.registrationOpen} className="mt-1 size-5 accent-[#f26b1d]" />
            <span>
              <span className="font-display text-lg font-bold">Registration open</span>
              <span className="block text-sm text-ink/65">Requires a fee, capacity and refund policy. Unchecking stops new checkouts immediately; paid participants can still finish their forms.</span>
            </span>
          </label>
          {err("registrationOpen")}
        </section>
      </fieldset>

      {errors.form && <p role="alert" className="font-semibold text-destructive">{errors.form}</p>}
      {state?.ok && <p role="status" className="rounded-xl bg-palm/10 p-3 text-sm font-semibold">{state.message}</p>}
      {readOnly ? (
        <p className="text-sm text-ink/60">Viewer accounts cannot change settings.</p>
      ) : (
        <Button type="submit" disabled={pending} className="h-11 rounded-full px-6">
          {pending ? "Saving…" : "Save settings"}
        </Button>
      )}
    </form>
  );
}
