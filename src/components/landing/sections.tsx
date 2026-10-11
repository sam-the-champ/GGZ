import { CalendarDays, Clock, HeartHandshake, Info, MapPin, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/landing/reveal";
import { logistics, site } from "@/content/site";
import {
  BallPlayer,
  BibleReader,
  Campfire,
  Friends,
  Guitarist,
  Praying,
  Worshipper,
} from "@/components/illustrations/characters";

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-[0.28em] ${light ? "text-sun" : "text-sunset-deep"}`}>
      {children}
    </p>
  );
}

// ─── About ──────────────────────────────────────────────────────────────────

export function About() {
  const values = [
    {
      icon: Sparkles,
      title: "Christ at the centre",
      body: "Jesus is the heart of everything we do. We want young people to build a genuine, everyday relationship with God — not one reserved only for when we need help.",
    },
    {
      icon: Users,
      title: "Non-denominational",
      body: "We come from different churches, backgrounds and upbringings. GGZ is a shared space to fellowship around Jesus, while each person stays rooted in their own church family and convictions.",
    },
    {
      icon: HeartHandshake,
      title: "A family, not a crowd",
      body: "GGZ is a place to be known. We fellowship, learn, pray and grow together, building friendships that last beyond any single event.",
    },
  ];
  return (
    <section id="about" className="grain scroll-mt-20 py-20 sm:py-28" aria-labelledby="about-title">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <Reveal>
          <Eyebrow>About God&apos;s GenZ Community</Eyebrow>
          <h2 id="about-title" className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
            Young people, different backgrounds, one family in Christ.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink/80">
            God&apos;s GenZ Community (GGZ) is a non-denominational, Christ-centred community for young people. We bring
            people together as a family — to fellowship, connect, learn, pray, grow spiritually and build meaningful
            relationships.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-ink/80">
            We believe faith, fellowship and personal growth should shape how we live — and spill over into a positive
            difference in the world around us.
          </p>
          <div className="mt-8 max-w-sm rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-ink/5">
            <Friends className="w-full" />
          </div>
        </Reveal>
        <ul className="grid gap-4">
          {values.map((v, i) => (
            <li key={v.title}>
              <Reveal delay={i * 0.08}>
                <div className="group flex gap-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/5 transition hover:-translate-y-1 hover:shadow-lg sm:p-7">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sun/40 text-ink transition group-hover:bg-sun">
                    <v.icon className="size-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold">{v.title}</h3>
                    <p className="mt-2 leading-relaxed text-ink/75">{v.body}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
          <li>
            <Reveal delay={0.25}>
              <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-ink/80">
                <strong className="text-ink">Everyone is welcome.</strong> You don&apos;t need to be part of GGZ already —
                camp is open to young people inside and outside the community.
              </p>
            </Reveal>
          </li>
        </ul>
      </div>
    </section>
  );
}

// ─── IMPACT ─────────────────────────────────────────────────────────────────

export function Impact() {
  const pillars = [
    {
      n: "01",
      title: "Encounter God",
      body: "Time in worship, prayer and the Word to deepen a real, personal relationship with God.",
      art: <Worshipper className="h-36 w-auto" />,
    },
    {
      n: "02",
      title: "Build real relationships",
      body: "Meet people who become family — conversations, laughter and friendships that continue after camp.",
      art: <Guitarist className="h-36 w-auto" />,
    },
    {
      n: "03",
      title: "Reflect and grow",
      body: "Space to slow down, think honestly about where you are, and take next steps in faith and character.",
      art: <Praying className="h-36 w-auto" />,
    },
    {
      n: "04",
      title: "Carry it home",
      body: "IMPACT isn't just three days. It's about living with purpose in your home, school, work and city.",
      art: <BibleReader className="h-36 w-auto" />,
    },
  ];
  return (
    <section id="impact" className="relative scroll-mt-20 overflow-hidden bg-ink py-20 text-sand sm:py-28" aria-labelledby="impact-title">
      <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-sunset/20 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-3xl">
          <Eyebrow light>The meaning of IMPACT</Eyebrow>
          <h2 id="impact-title" className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            More than an event. <span className="text-sun">A life that makes a difference.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-sand/80">
            In Acts 17:6, people in Thessalonica complained that the early believers had &ldquo;turned the world upside
            down.&rdquo; Their faith wasn&apos;t private — it shaped how they lived, and people noticed. IMPACT invites us
            to grow in our relationship with God and to carry positive change into everyday life.
          </p>
        </Reveal>
        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <li key={p.n}>
              <Reveal delay={i * 0.08} className="h-full">
                <div className="flex h-full flex-col rounded-3xl bg-ink-soft p-6 ring-1 ring-white/10 transition hover:-translate-y-1 hover:ring-sun/50">
                  <div className="flex items-start justify-between">
                    <span className="font-display text-sm font-bold text-sun">{p.n}</span>
                  </div>
                  <div className="my-4 flex justify-center rounded-2xl bg-sand/95 py-3">{p.art}</div>
                  <h3 className="font-display text-xl font-bold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-sand/75">{p.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-2xl text-sm text-sand/60">
          We can&apos;t promise any particular outcome — growth looks different for everyone. We can promise a
          welcoming space to seek God together.
        </p>
      </div>
    </section>
  );
}

// ─── What to expect ─────────────────────────────────────────────────────────

export function WhatToExpect() {
  const items = [
    { title: "Fellowship & community bonding", body: "Meet new people, reconnect with friends and experience being part of a family.", art: <Friends className="h-28 w-auto" />, tint: "bg-sun/35" },
    { title: "Prayer sessions", body: "Time set apart to pray — individually and together.", art: <Praying className="h-28 w-auto" />, tint: "bg-lagoon/25" },
    { title: "Inspiring talks & real conversations", body: "Teaching and honest discussion about faith, purpose and everyday life.", art: <BibleReader className="h-28 w-auto" />, tint: "bg-sunset/20" },
    { title: "Games & sports", body: "Beach games, sports and plenty of fun in the open air.", art: <BallPlayer className="h-28 w-auto" />, tint: "bg-palm/20" },
    { title: "Talent showcases", body: "A stage to share your gifts — music, spoken word, drama and more.", art: <Guitarist className="h-28 w-auto" />, tint: "bg-sun/35" },
    { title: "More camp moments", body: "Additional activities will be shared as the programme is finalised.", art: <Campfire className="h-28 w-auto" />, tint: "bg-sand-deep" },
  ];
  return (
    <section id="expect" className="scroll-mt-20 py-20 sm:py-28" aria-labelledby="expect-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <Eyebrow>What to expect</Eyebrow>
            <h2 id="expect-title" className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
              Three days of faith, friendship and fun by the sea.
            </h2>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-palm/15 px-4 py-2 text-sm font-semibold text-palm">
            <span className="size-2 rounded-full bg-palm" aria-hidden="true" /> Confirmed activities
          </span>
        </Reveal>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <li key={it.title}>
              <Reveal delay={(i % 3) * 0.08} className="h-full">
                <div className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/5 transition hover:-translate-y-1 hover:shadow-lg">
                  <div className={`flex h-36 items-end justify-center ${it.tint}`}>{it.art}</div>
                  <div className="p-6">
                    <h3 className="font-display text-xl font-bold">{it.title}</h3>
                    <p className="mt-2 leading-relaxed text-ink/75">{it.body}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
        <p className="mt-8 flex items-start gap-2 rounded-2xl bg-sand-deep/60 p-4 text-sm text-ink/80">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          The detailed programme, sessions and timetable will be announced by the organisers closer to camp.
        </p>
      </div>
    </section>
  );
}

// ─── Camp details ───────────────────────────────────────────────────────────

export function CampDetails() {
  const confirmed = logistics.filter((l) => l.value);
  const pending = logistics.filter((l) => !l.value);
  return (
    <section id="details" className="grain scroll-mt-20 py-20 sm:py-28" aria-labelledby="details-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Eyebrow>Camp details</Eyebrow>
          <h2 id="details-title" className="mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
            Save the dates.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <Reveal className="lg:col-span-1">
            <div className="h-full rounded-3xl bg-sunset p-7 text-ink">
              <CalendarDays className="size-7" aria-hidden="true" />
              <p className="mt-6 text-sm font-bold uppercase tracking-widest">When</p>
              <p className="mt-1 font-display text-3xl font-extrabold leading-tight">8–10 December 2026</p>
              <p className="mt-2 font-semibold">Tuesday to Thursday · three days</p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-1">
            <div className="h-full rounded-3xl bg-ink p-7 text-sand">
              <MapPin className="size-7 text-sun" aria-hidden="true" />
              <p className="mt-6 text-sm font-bold uppercase tracking-widest text-sun">Where</p>
              <p className="mt-1 font-display text-3xl font-extrabold leading-tight">{site.venue.name}</p>
              <p className="mt-2 font-semibold text-sand/80">
                {site.venue.area}, {site.venue.city}, {site.venue.country}
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.16} className="lg:col-span-1">
            <div className="h-full rounded-3xl bg-white p-7 ring-1 ring-ink/5">
              <Clock className="size-7 text-sunset-deep" aria-hidden="true" />
              <p className="mt-6 text-sm font-bold uppercase tracking-widest text-ink/60">Logistics</p>
              {confirmed.length > 0 && (
                <dl className="mt-3 space-y-2">
                  {confirmed.map((l) => (
                    <div key={l.label}>
                      <dt className="text-sm font-bold">{l.label}</dt>
                      <dd className="text-ink/75">{l.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {pending.length > 0 && (
                <>
                  <p className="mt-2 text-ink/80">To be announced by the organisers:</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {pending.map((l) => (
                      <li key={l.label} className="rounded-full bg-sand-deep px-3 py-1 text-sm font-semibold">
                        {l.label}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-8">
          <div className="rounded-3xl bg-white p-7 ring-1 ring-ink/5 sm:p-9">
            <h3 className="font-display text-2xl font-bold">Before you register</h3>
            <ul className="mt-5 grid gap-4 text-ink/80 sm:grid-cols-2">
              <li className="flex gap-3"><Check /><span>Registration happens in two steps: pay the registration fee securely through Paystack, then complete a short registration form.</span></li>
              <li className="flex gap-3"><Check /><span>Your place is only confirmed once your payment is verified <em>and</em> your form is submitted.</span></li>
              <li className="flex gap-3"><Check /><span>Have your phone number, date of birth and an emergency contact ready.</span></li>
              <li className="flex gap-3"><Check /><span>Under-18s will need a parent or guardian&apos;s details and consent.</span></li>
              <li className="flex gap-3"><Check /><span>Spaces are limited, so register early once registration opens.</span></li>
              <li className="flex gap-3"><Check /><span>Questions? Call or WhatsApp {site.contact.name} on {site.contact.phoneDisplay}.</span></li>
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Check() {
  return (
    <span aria-hidden="true" className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-palm text-[0.65rem] font-bold text-white">
      ✓
    </span>
  );
}
