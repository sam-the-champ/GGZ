import Link from "next/link";
import { ArrowRight, Lock, Phone, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { site } from "@/content/site";
import { formatNaira } from "@/lib/money";
import type { PublicEventInfo } from "@/lib/services/event";

const steps = [
  { title: "Pay the fee", body: "Secure checkout with Paystack — card, bank transfer or USSD." },
  { title: "We verify", body: "Our server confirms your payment directly with Paystack." },
  { title: "Fill the form", body: "A short form with your details and an emergency contact." },
  { title: "You're in", body: "Get your registration number and confirmation." },
];

export function RegisterSection({ info }: { info: PublicEventInfo }) {
  const a = info.availability;
  return (
    <section id="register" className="scroll-mt-20 py-20 sm:py-28" aria-labelledby="register-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[2.5rem] bg-ink text-sand shadow-[0_40px_80px_-40px_rgba(14,27,38,0.7)]">
          <div className="grid gap-10 p-7 sm:p-12 lg:grid-cols-[1.1fr_1fr]">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sun">Registration</p>
              <h2 id="register-title" className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
                Secure your place at GGZ Camp 1.0.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-sand/80">
                Camp is open to young people — whether or not you&apos;re already part of GGZ.
                {info.minimumAge != null && ` Participants must be at least ${info.minimumAge} years old at the start of camp.`}{" "}
                Under-{info.guardianConsentAge}s need a parent or guardian&apos;s consent. Spaces are limited.
              </p>

              <ol className="mt-8 grid gap-3 sm:grid-cols-2">
                {steps.map((s, i) => (
                  <li key={s.title} className="flex gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sun font-display text-sm font-extrabold text-ink">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold">{s.title}</p>
                      <p className="text-sm text-sand/70">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-5 flex gap-2 text-sm text-sand/70">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sun" aria-hidden="true" />
                <span>
                  Registration is complete only after your payment is verified{" "}
                  <strong className="text-sand">and</strong> your form is submitted.
                </span>
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-3xl bg-sand p-6 text-ink sm:p-8">
                {a.state === "open" ? (
                  <>
                    <p className="text-sm font-bold uppercase tracking-widest text-ink/60">Registration fee</p>
                    <p className="mt-1 font-display text-5xl font-extrabold">{formatNaira(a.feeKobo)}</p>
                    {info.feeCovers && (
                      <div className="mt-4">
                        <p className="text-sm font-bold">What it covers</p>
                        <p className="mt-1 whitespace-pre-line text-ink/80">{info.feeCovers}</p>
                      </div>
                    )}
                    <Link
                      href="/register"
                      className="group mt-6 flex h-14 items-center justify-center gap-2 rounded-full bg-sunset text-base font-bold text-ink transition hover:-translate-y-0.5 hover:bg-sun"
                    >
                      Secure your place
                      <ArrowRight className="size-5 transition group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink/60">
                      <Lock className="size-3.5" aria-hidden="true" /> Payments processed securely by Paystack
                    </p>
                  </>
                ) : (
                  <Unavailable state={a.state} feeKobo={info.feeKobo} />
                )}
                {info.refundPolicy && (
                  <details className="mt-6 rounded-2xl bg-white p-4 text-sm">
                    <summary className="cursor-pointer font-bold">Refund &amp; cancellation policy</summary>
                    <p className="mt-2 whitespace-pre-line text-ink/80">{info.refundPolicy}</p>
                  </details>
                )}
                <div className="mt-6 border-t border-ink/10 pt-5 text-sm">
                  <p className="font-bold">Need help registering?</p>
                  <p className="mt-1 text-ink/75">
                    Contact {site.contact.name}:{" "}
                    <a className="font-semibold underline underline-offset-2" href={`tel:${site.contact.phoneE164}`}>
                      {site.contact.phoneDisplay}
                    </a>{" "}
                    ·{" "}
                    <a className="font-semibold underline underline-offset-2" href={site.contact.whatsapp} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  </p>
                  <p className="mt-2 text-ink/75">
                    Paid but couldn&apos;t finish?{" "}
                    <Link href="/register/resume" className="font-semibold underline underline-offset-2">
                      Resume your registration
                    </Link>
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Unavailable({ state, feeKobo }: { state: "full" | "closed" | "not_configured"; feeKobo: number | null }) {
  const copy = {
    not_configured: {
      title: "Registration opens soon",
      body: "The organisers are finalising the registration fee and number of places. Check back soon, or contact us to be told when registration opens.",
    },
    closed: {
      title: "Registration is currently closed",
      body: "Registration is not open right now. Please check back or contact the organisers for updates.",
    },
    full: {
      title: "Camp is fully booked",
      body: "All available places are currently taken. Places can occasionally become available again if a checkout expires — check back later or contact the organisers.",
    },
  }[state];
  return (
    <div role="status">
      <span className="inline-flex items-center gap-2 rounded-full bg-sand-deep px-3 py-1 text-xs font-bold uppercase tracking-widest">
        <span className="size-2 rounded-full bg-sunset" aria-hidden="true" /> Not open
      </span>
      <p className="mt-4 font-display text-3xl font-extrabold">{copy.title}</p>
      <p className="mt-3 text-ink/80">{copy.body}</p>
      {state !== "not_configured" && feeKobo != null && (
        <p className="mt-4 text-sm text-ink/70">Registration fee: {formatNaira(feeKobo)}</p>
      )}
      <a
        href={`tel:${site.contact.phoneE164}`}
        className="mt-6 flex h-13 items-center justify-center gap-2 rounded-full border-2 border-ink/15 font-bold transition hover:border-ink/40"
      >
        <Phone className="size-4" aria-hidden="true" /> Call {site.contact.name}
      </a>
    </div>
  );
}
