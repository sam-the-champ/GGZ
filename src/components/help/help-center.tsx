"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, CircleCheck, Clock, LoaderCircle, Phone } from "lucide-react";
import { submitHelpRequestAction, type HelpState } from "@/app/help/actions";
import { helpCategories, RESPONSE_WINDOW, type HelpCategory } from "@/content/help";
import { site } from "@/content/site";

const input =
  "mt-1.5 h-12 w-full rounded-2xl border border-input bg-white px-4 text-base outline-none transition focus:border-sunset focus:ring-4 focus:ring-sunset/20 aria-[invalid=true]:border-destructive";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 font-bold text-sand transition hover:bg-ink-soft disabled:opacity-60 sm:w-auto"
    >
      {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Sending…" : "Send request"}
    </button>
  );
}

export function HelpCenter({ initialTopic }: { initialTopic?: HelpCategory }) {
  const [topic, setTopic] = useState<HelpCategory | undefined>(initialTopic);
  const [showForm, setShowForm] = useState(Boolean(initialTopic && !helpCategories.find((c) => c.value === initialTopic)?.answer));
  const [state, action] = useActionState<HelpState, FormData>(submitHelpRequestAction, {});
  const selected = helpCategories.find((c) => c.value === topic);
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};

  if (state.done) {
    return (
      <div role="status" className="rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-ink/5 sm:p-10">
        <CircleCheck className="size-12 text-palm" aria-hidden="true" />
        <h2 className="mt-4 font-display text-3xl font-extrabold">Request received</h2>
        <p className="mt-3 text-lg text-ink/80">
          Your reference is <strong className="font-display tracking-wider">{state.done.reference}</strong>. Please keep
          it.
        </p>
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-sun/30 p-4 text-ink">
          <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            The organising team will respond within <strong>{RESPONSE_WINDOW}</strong> by email or phone.
            {state.done.emailSent ? " We've also sent a copy of your request to your email." : ""}
          </span>
        </p>
        <p className="mt-6 text-sm text-ink/65">
          Emergencies only: call {site.contact.name} on{" "}
          <a href={`tel:${site.contact.phoneE164}`} className="font-semibold underline">
            {site.contact.phoneDisplay}
          </a>
          .
        </p>
        <Link href="/" className="mt-6 inline-flex font-semibold underline underline-offset-2">
          Back to camp home
        </Link>
      </div>
    );
  }

  const field = (
    name: string,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { optional?: boolean; hint?: string } = {},
  ) => {
    const { optional, hint, ...rest } = props;
    return (
      <div>
        <label htmlFor={`help-${name}`} className="font-semibold">
          {label} {optional && <span className="font-normal text-ink/55">(optional)</span>}
        </label>
        <input
          id={`help-${name}`}
          name={name}
          defaultValue={v[name]}
          aria-invalid={Boolean(fe[name])}
          aria-describedby={fe[name] ? `help-${name}-err` : hint ? `help-${name}-hint` : undefined}
          className={input}
          {...rest}
        />
        {hint && !fe[name] && (
          <p id={`help-${name}-hint`} className="mt-1 text-sm text-ink/60">
            {hint}
          </p>
        )}
        {fe[name] && (
          <p id={`help-${name}-err`} className="mt-1 text-sm font-semibold text-destructive">
            {fe[name]}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="topics-title">
        <h2 id="topics-title" className="font-display text-2xl font-bold">
          What do you need help with?
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {helpCategories.map((c) => (
            <li key={c.value}>
              <button
                type="button"
                onClick={() => {
                  setTopic(c.value);
                  setShowForm(!c.answer);
                }}
                aria-pressed={topic === c.value}
                className={`flex h-full w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left font-semibold ring-1 transition ${
                  topic === c.value ? "bg-ink text-sand ring-ink" : "bg-white ring-ink/10 hover:ring-ink/30"
                }`}
              >
                {c.label}
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selected?.answer && (
        <section aria-live="polite" className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-ink/5 sm:p-8">
          <h3 className="font-display text-xl font-bold">{selected.label}</h3>
          <p className="mt-3 text-lg leading-relaxed text-ink/80">{selected.answer}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {selected.action && (
              <Link
                href={selected.action.href}
                className="inline-flex h-12 items-center justify-center rounded-full bg-sunset px-6 font-bold text-ink hover:bg-sun"
              >
                {selected.action.label}
              </Link>
            )}
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="inline-flex h-12 items-center justify-center rounded-full border-2 border-ink/15 px-6 font-bold hover:border-ink/40"
              >
                That didn&apos;t help — send a request
              </button>
            )}
          </div>
        </section>
      )}

      {(showForm || state.fieldErrors || state.error) && (
        <section aria-labelledby="form-title" className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-ink/5 sm:p-8">
          <h2 id="form-title" className="font-display text-2xl font-bold">
            Send us a request
          </h2>
          <p className="mt-1 text-ink/70">We respond within {RESPONSE_WINDOW}.</p>
          <form action={action} className="mt-6 space-y-5" noValidate>
            {/* Honeypot for bots — hidden from people and screen readers. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <div>
              <label htmlFor="help-category" className="font-semibold">
                Topic
              </label>
              <select
                id="help-category"
                name="category"
                defaultValue={v.category ?? topic ?? ""}
                key={topic}
                aria-invalid={Boolean(fe.category)}
                className={input}
              >
                <option value="" disabled>
                  Choose a topic
                </option>
                {helpCategories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {fe.category && <p className="mt-1 text-sm font-semibold text-destructive">{fe.category}</p>}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {field("name", "Your name", { autoComplete: "name", required: true })}
              {field("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", required: true })}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {field("phone", "Phone number", {
                type: "tel",
                inputMode: "tel",
                autoComplete: "tel",
                optional: true,
                hint: "So we can call or WhatsApp you if needed.",
              })}
              {field("registrationRef", "Registration or payment reference", {
                optional: true,
                hint: "e.g. GGZ26-ABC123, if you have one.",
              })}
            </div>
            <div>
              <label htmlFor="help-message" className="font-semibold">
                What happened?
              </label>
              <textarea
                id="help-message"
                name="message"
                rows={5}
                defaultValue={v.message}
                aria-invalid={Boolean(fe.message)}
                aria-describedby={fe.message ? "help-message-err" : "help-message-hint"}
                className={`${input} h-auto py-3`}
              />
              {fe.message ? (
                <p id="help-message-err" className="mt-1 text-sm font-semibold text-destructive">
                  {fe.message}
                </p>
              ) : (
                <p id="help-message-hint" className="mt-1 text-sm text-ink/60">
                  Include dates, amounts and what you saw on screen. Never share card numbers, PINs or passwords.
                </p>
              )}
            </div>
            {state.error && (
              <p role="alert" className="rounded-2xl bg-destructive/10 p-4 font-semibold text-destructive">
                {state.error}
              </p>
            )}
            <Submit />
            <p className="text-xs text-ink/55">
              Your details are used only to respond to this request. See our{" "}
              <Link href="/privacy" className="underline">
                privacy policy
              </Link>
              .
            </p>
          </form>
        </section>
      )}

      <aside aria-labelledby="emergency-title" className="rounded-[2rem] border-2 border-sunset/40 bg-sunset/10 p-6 sm:p-8">
        <h2 id="emergency-title" className="font-display text-xl font-bold">
          Emergency or urgent safety concern?
        </h2>
        <p className="mt-2 text-ink/80">
          For critical or emergency situations only — for example during camp, or a safety issue — call{" "}
          {site.contact.name} directly. For everything else, please use the form above so your request is tracked.
        </p>
        <a
          href={`tel:${site.contact.phoneE164}`}
          className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-sunset px-6 font-bold text-ink hover:bg-sun"
        >
          <Phone className="size-4" aria-hidden="true" /> Call {site.contact.name}: {site.contact.phoneDisplay}
        </a>
      </aside>
    </div>
  );
}
