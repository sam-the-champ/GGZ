"use client";

import { useActionState, useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { respondToTicketAction, setTicketStatusAction, type ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

type Channel = "EMAIL" | "PHONE" | "WHATSAPP" | "NOTE";

const tabs: { value: Channel; label: string; hint: string; button: string }[] = [
  { value: "EMAIL", label: "Reply by email", hint: "Sent to the person from the site's email address and saved here.", button: "Send email reply" },
  { value: "PHONE", label: "Log a call", hint: "Call them using the button above, then summarise what was agreed.", button: "Save call log" },
  { value: "WHATSAPP", label: "Log WhatsApp", hint: "Message them using the WhatsApp button above, then summarise here.", button: "Save WhatsApp log" },
  { value: "NOTE", label: "Internal note", hint: "Only organisers can see notes. The person is not contacted.", button: "Add note" },
];

export function TicketRespond({
  ticketId,
  reference,
  name,
  phoneTel,
  whatsapp,
  status,
  emailEnabled,
}: {
  ticketId: string;
  reference: string;
  name: string;
  phoneTel: string | null;
  whatsapp: string | null;
  status: string;
  emailEnabled: boolean;
}) {
  const [channel, setChannel] = useState<Channel>(emailEnabled ? "EMAIL" : phoneTel ? "PHONE" : "NOTE");
  const [state, action, pending] = useActionState<ActionResult, FormData>(respondToTicketAction, {});
  const [statusState, statusAction, statusPending] = useActionState<ActionResult, FormData>(setTicketStatusAction, {});
  const tab = tabs.find((t) => t.value === channel)!;
  const waText = encodeURIComponent(`Hi ${name}, this is the GGZ Camp team about your help request ${reference}. `);

  return (
    <div className="space-y-4">
      {(phoneTel || whatsapp) && (
        <div className="flex flex-wrap gap-2">
          {phoneTel && (
            <a href={`tel:${phoneTel}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-bold text-sand">
              <Phone className="size-4" aria-hidden="true" /> Call
            </a>
          )}
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-palm px-4 text-sm font-bold text-white"
            >
              <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
            </a>
          )}
        </div>
      )}

      <form action={action} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
        <input type="hidden" name="ticketId" value={ticketId} />
        <input type="hidden" name="channel" value={channel} />
        <div role="tablist" aria-label="Response type" className="flex flex-wrap gap-1">
          {tabs.map((t) => {
            const disabled = t.value === "EMAIL" && !emailEnabled;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={channel === t.value}
                disabled={disabled}
                title={disabled ? "Email isn't connected — see Event settings → Email" : undefined}
                onClick={() => setChannel(t.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${channel === t.value ? "bg-ink text-sand" : "bg-ink/5 hover:bg-ink/10"}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink/60">{tab.hint}</p>
        <label htmlFor="reply-body" className="sr-only">
          Message
        </label>
        <textarea
          id="reply-body"
          name="body"
          rows={5}
          required
          key={channel}
          defaultValue={channel === "EMAIL" ? "" : undefined}
          placeholder={channel === "EMAIL" ? `Write your reply to ${name}…` : "Summary…"}
          className="w-full rounded-xl border border-input bg-white p-3 text-sm outline-none focus:border-sunset focus:ring-4 focus:ring-sunset/20"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <span className="mr-2 font-semibold">Then mark as</span>
            <select name="status" defaultValue="" className="h-9 rounded-lg border border-input bg-white px-2 text-sm">
              <option value="">{channel === "NOTE" ? "(no change)" : "In progress (default)"}</option>
              <option value="RESOLVED">Resolved</option>
              <option value="OPEN">Open</option>
            </select>
          </label>
          <Button type="submit" size="sm" disabled={pending} className="rounded-full">
            {pending ? "Saving…" : tab.button}
          </Button>
        </div>
        {state.message && (
          <p role="status" className={`rounded-xl p-3 text-sm ${state.ok === false ? "bg-destructive/10 text-destructive" : "bg-palm/10"}`}>
            {state.message}
          </p>
        )}
      </form>

      <form action={statusAction} className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="ticketId" value={ticketId} />
        <span className="font-semibold">Status:</span>
        {(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map((s) => (
          <button
            key={s}
            name="status"
            value={s}
            disabled={statusPending || s === status}
            className={`rounded-full px-3 py-1 font-semibold ring-1 ring-ink/10 disabled:cursor-default ${s === status ? "bg-ink text-sand" : "bg-white hover:bg-ink/5"}`}
          >
            {s === "IN_PROGRESS" ? "In progress" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
        {statusState.message && <span role="status" className="text-ink/70">{statusState.message}</span>}
      </form>
    </div>
  );
}
