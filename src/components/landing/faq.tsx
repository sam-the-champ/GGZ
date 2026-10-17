import Link from "next/link";
import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Reveal } from "@/components/landing/reveal";
import { site } from "@/content/site";
import { formatNaira } from "@/lib/money";
import type { PublicEventInfo } from "@/lib/services/event";

export function Faq({ info }: { info: PublicEventInfo }) {
  const fee =
    info.feeKobo != null
      ? `The registration fee is ${formatNaira(info.feeKobo)}.${info.feeCovers ? ` It covers: ${info.feeCovers}` : ""}`
      : "The registration fee hasn't been announced yet. It will appear on this page as soon as the organisers confirm it.";

  const faqs: { q: string; a: ReactNode }[] = [
    {
      q: "What is GGZ Camp 1.0?",
      a: `GGZ Camp 1.0 is a three-day camp organised by God's GenZ Community for young people. It's a time of fellowship, prayer, inspiring talks, games, sports and talent showcases at ${site.venueLabel}.`,
    },
    {
      q: "What does IMPACT mean?",
      a: "IMPACT is this year's theme, inspired by Acts 17:6, where the early believers were described as people who had \"turned the world upside down\". It's about growing in our relationship with God and living in a way that makes a positive difference in our generation.",
    },
    {
      q: "Who can attend?",
      a: `Camp is for young people from any background or denomination.${info.minimumAge != null ? ` Participants must be at least ${info.minimumAge} at the start of camp.` : " The organisers will confirm the exact age range."} Participants under ${info.guardianConsentAge} need consent from a parent or guardian.`,
    },
    {
      q: "Do I need to belong to GGZ already?",
      a: "No. Camp is open to young people both inside and outside the GGZ community. Come as you are — you'll be welcomed as family.",
    },
    { q: "When and where is the camp?", a: `${site.dates.label}, at ${site.venueLabel}, Nigeria.` },
    { q: "How much does registration cost?", a: fee },
    {
      q: "How do I register?",
      a: (
        <>
          Click <strong>Secure your place</strong>, enter your email and pay the registration fee securely through
          Flutterwave. Once we&apos;ve verified your payment, you&apos;ll fill in a short registration form. Your place is
          confirmed when the form is submitted and you receive a registration number.
        </>
      ),
    },
    {
      q: "How do I know my payment was successful?",
      a: "After checkout, our server checks your transaction directly with Flutterwave. If it was successful, you'll be taken straight to the registration form, and — if email is set up — you'll receive an email too. We never treat a payment as successful just because you were redirected back to our site.",
    },
    {
      q: "What if I paid but could not complete the form?",
      a: (
        <>
          Don&apos;t pay again. Go to{" "}
          <Link href="/register/resume" className="font-semibold underline underline-offset-2">
            Resume registration
          </Link>{" "}
          and enter the email you paid with. We&apos;ll re-check your payment and send you a secure link to finish. If you
          have any trouble,{" "}
          <Link href="/help?topic=PAID_NOT_CONFIRMED" className="font-semibold underline underline-offset-2">
            send us a request in the Help Center
          </Link>{" "}
          — the organisers can see paid registrations and help you complete yours.
        </>
      ),
    },
    {
      q: "How do I contact the organisers?",
      a: (
        <>
          Use the{" "}
          <Link href="/help" className="font-semibold underline underline-offset-2">
            Help Center
          </Link>{" "}
          — pick your topic for a quick answer or send a request, and the team will respond within 24–48 hours. For
          emergencies only, call {site.contact.name} on{" "}
          <a href={`tel:${site.contact.phoneE164}`} className="font-semibold underline underline-offset-2">
            {site.contact.phoneDisplay}
          </a>
          .
        </>
      ),
    },
  ];

  return (
    <section id="faq" className="grain scroll-mt-20 py-20 sm:py-28" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sunset-deep">FAQ</p>
          <h2 id="faq-title" className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
            Questions, answered.
          </h2>
          <p className="mt-5 text-lg text-ink/75">
            Can&apos;t find what you need?{" "}
            <Link href="/help" className="font-semibold underline underline-offset-2">
              Visit the Help Center
            </Link>
            .
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <Accordion type="single" collapsible className="rounded-3xl bg-white px-5 shadow-sm ring-1 ring-ink/5 sm:px-7">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`} className="border-ink/10">
                <AccordionTrigger className="py-5 text-left font-display text-lg font-bold hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-base leading-relaxed text-ink/80">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
