import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Phone } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { site } from "@/content/site";

const STEPS = ["Pay", "Verify", "Your details", "Confirmed"];

/** Focused, distraction-free layout for the registration journey. */
export function FlowShell({ step, children }: { step?: 0 | 1 | 2 | 3; children: ReactNode }) {
  return (
    <div className="grain flex min-h-dvh flex-col">
      <header className="no-print mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" aria-label="Back to the GGZ Camp home page">
          <BrandMark compact />
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/70 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden="true" /> Camp home
        </Link>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6">
        {step != null && (
          <ol aria-label="Registration progress" className="no-print mb-6 grid grid-cols-4 gap-2">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined}>
                <span className={`block h-1.5 rounded-full ${i <= step ? "bg-sunset" : "bg-ink/10"}`} />
                <span className={`mt-2 block text-xs font-semibold ${i === step ? "text-ink" : "text-ink/50"}`}>
                  {s}
                </span>
              </li>
            ))}
          </ol>
        )}
        {children}
      </main>
      <footer className="no-print mx-auto w-full max-w-3xl px-4 pb-8 text-sm text-ink/60 sm:px-6">
        Need help? {site.contact.name} ·{" "}
        <a
          className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-2"
          href={`tel:${site.contact.phoneE164}`}
        >
          <Phone className="size-3.5" aria-hidden="true" />
          {site.contact.phoneDisplay}
        </a>
      </footer>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-ink/5 sm:p-10 ${className}`}>{children}</div>;
}

export function StatusPanel({
  tone,
  title,
  children,
  art,
}: {
  tone: "success" | "warning" | "error" | "info";
  title: string;
  children: ReactNode;
  art?: ReactNode;
}) {
  const badge = {
    success: { cls: "bg-palm/15 text-palm", label: "Success" },
    warning: { cls: "bg-sun/40 text-ink", label: "Action needed" },
    error: { cls: "bg-destructive/10 text-destructive", label: "Not completed" },
    info: { cls: "bg-lagoon/15 text-ink", label: "In progress" },
  }[tone];
  return (
    <Card>
      <div role="status" aria-live="polite">
        {art && <div className="mb-6 flex justify-center">{art}</div>}
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${badge.cls}`}>
          {badge.label}
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        <div className="mt-4 space-y-4 text-lg leading-relaxed text-ink/80">{children}</div>
      </div>
    </Card>
  );
}

export const primaryButton =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-bold text-sand transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";
export const secondaryButton =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-ink/15 px-8 text-base font-bold transition hover:border-ink/40 sm:w-auto";
export const inputClass =
  "mt-2 h-13 w-full rounded-2xl border border-input bg-white px-4 text-base outline-none transition focus:border-sunset focus:ring-4 focus:ring-sunset/20 aria-[invalid=true]:border-destructive";
