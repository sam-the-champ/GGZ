"use client";

import { useActionState, useState } from "react";
import {
  allocateAction,
  cancelAction,
  eraseAction,
  recoveryLinkAction,
  reverifyAction,
  type ActionResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

function Result({ state }: { state: ActionResult }) {
  if (!state.message && !state.url) return null;
  return (
    <div role="status" className={`mt-2 rounded-xl p-3 text-sm ${state.ok === false ? "bg-destructive/10 text-destructive" : "bg-palm/10 text-ink"}`}>
      {state.message}
      {state.url && <RecoveryUrl url={state.url} />}
    </div>
  );
}

function RecoveryUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <p className="font-semibold">One-time link (works once, expires in 2 hours). Send it only to the participant:</p>
      <code className="block break-all rounded-lg bg-white p-2 text-xs">{url}</code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

function ActionForm({
  action,
  attemptId,
  label,
  description,
  variant = "outline",
  children,
}: {
  action: (s: ActionResult, f: FormData) => Promise<ActionResult>;
  attemptId: string;
  label: string;
  description: string;
  variant?: "outline" | "destructive" | "default";
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});
  return (
    <form action={formAction} className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
      <input type="hidden" name="attemptId" value={attemptId} />
      <p className="text-sm text-ink/70">{description}</p>
      {children}
      <Button type="submit" variant={variant} size="sm" disabled={pending} className="mt-3 rounded-full">
        {pending ? "Working…" : label}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function AttemptActions({
  attemptId,
  canRecover,
  canAllocate,
  canCancel,
  canErase,
  canReverify,
}: {
  attemptId: string;
  canRecover: boolean;
  canAllocate: boolean;
  canCancel: boolean;
  canErase: boolean;
  canReverify: boolean;
}) {
  return (
    <div className="grid gap-3">
      {canReverify && (
        <ActionForm
          action={reverifyAction}
          attemptId={attemptId}
          label="Re-verify with Flutterwave"
          description="Fetches the transaction from Flutterwave and applies the verified result. It never marks a payment as paid without Flutterwave confirming it."
        />
      )}
      {canRecover && (
        <ActionForm
          action={recoveryLinkAction}
          attemptId={attemptId}
          label="Create recovery link"
          description="Paid but form not completed. Generate a one-time link to send to the participant (e.g. by WhatsApp)."
        />
      )}
      {canAllocate && (
        <ActionForm
          action={allocateAction}
          attemptId={attemptId}
          label="Allocate a place"
          description="This payment arrived after its reservation expired while camp was full. Allocate a place only if one is available."
        />
      )}
      {canCancel && (
        <ActionForm
          action={cancelAction}
          attemptId={attemptId}
          label="Cancel registration"
          variant="destructive"
          description="Cancels the registration and releases the place. Refunds must be processed in the Flutterwave dashboard."
        >
          <label className="mt-2 block text-sm font-semibold" htmlFor={`reason-${attemptId}`}>Reason</label>
          <input id={`reason-${attemptId}`} name="reason" required minLength={3} maxLength={300} className="mt-1 h-10 w-full rounded-lg border border-input px-3 text-sm" />
        </ActionForm>
      )}
      {canErase && (
        <ActionForm
          action={eraseAction}
          attemptId={attemptId}
          label="Erase personal data"
          variant="destructive"
          description="Permanently anonymises this participant's personal details (for deletion requests). Payment records are kept."
        >
          <label className="mt-2 block text-sm font-semibold" htmlFor={`confirm-${attemptId}`}>Type ERASE to confirm</label>
          <input id={`confirm-${attemptId}`} name="confirm" required className="mt-1 h-10 w-full rounded-lg border border-input px-3 text-sm" />
        </ActionForm>
      )}
    </div>
  );
}
