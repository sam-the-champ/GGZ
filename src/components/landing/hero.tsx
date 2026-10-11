import { CalendarDays, MapPin, ArrowRight, HandHeart, Users, BookOpen, Volleyball } from "lucide-react";
import { site } from "@/content/site";
import { BeachScene } from "@/components/illustrations/beach-scene";
import { BibleReader, BallPlayer, Worshipper } from "@/components/illustrations/characters";

function Chip({
  children,
  className,
  rot = "0deg",
}: {
  children: React.ReactNode;
  className?: string;
  rot?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ "--chip-rot": rot } as React.CSSProperties}
      className={`anim-chip absolute z-20 rounded-full border border-ink/10 bg-white px-3.5 py-1.5 text-xs font-bold text-ink shadow-[0_8px_24px_-8px_rgba(14,27,38,0.35)] sm:text-sm ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 sm:pt-28" aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sunset-deep sm:text-sm">
            God&apos;s GenZ Community presents
          </p>
          <h1 id="hero-title" className="mt-4 font-display font-extrabold leading-[0.9] tracking-tight">
            <span className="block text-5xl sm:text-6xl lg:text-7xl">GGZ Camp 1.0</span>
            <span className="mt-2 block text-[4.6rem] text-sunset sm:text-[7rem] lg:text-[8.5rem]">
              IMPACT
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/80">
            Three days to grow, connect, encounter God, and discover how your life can make a difference. Come as you
            are, meet your family, and leave inspired to live with purpose.
          </p>

          <dl className="mt-7 flex flex-col gap-3 text-base font-semibold sm:flex-row sm:gap-6">
            <div className="flex items-center gap-2.5">
              <dt className="sr-only">Dates</dt>
              <span className="grid size-9 place-items-center rounded-full bg-ink text-sun">
                <CalendarDays className="size-4.5" aria-hidden="true" />
              </span>
              <dd>{site.dates.label}</dd>
            </div>
            <div className="flex items-center gap-2.5">
              <dt className="sr-only">Venue</dt>
              <span className="grid size-9 place-items-center rounded-full bg-ink text-sun">
                <MapPin className="size-4.5" aria-hidden="true" />
              </span>
              <dd>{site.venueLabel}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#register"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-bold text-sand transition hover:-translate-y-0.5 hover:bg-ink-soft"
            >
              Secure your place
              <ArrowRight className="size-5 transition group-hover:translate-x-1" aria-hidden="true" />
            </a>
            <a
              href="#impact"
              className="inline-flex h-14 items-center justify-center rounded-full border-2 border-ink/15 px-8 text-base font-bold transition hover:border-ink/40"
            >
              What is IMPACT?
            </a>
          </div>

          <figure className="mt-9 max-w-xl border-l-4 border-sun pl-4">
            <blockquote className="font-serif text-xl italic leading-snug sm:text-2xl">
              &ldquo;{site.scripture.text}&rdquo;
            </blockquote>
            <figcaption className="mt-2 text-sm text-ink/70">
              <span className="font-bold text-ink">{site.scripture.reference}</span> ({site.scripture.translation}) —
              said by critics of the early believers, whose lives and message were changing their city. Our theme asks
              what that kind of impact could look like in our generation.
            </figcaption>
          </figure>
        </div>

        {/* Animated scene */}
        <div className="relative mx-auto w-full max-w-xl">
          <div className="relative aspect-[6/5] overflow-hidden rounded-[2.25rem] shadow-[0_30px_60px_-30px_rgba(14,27,38,0.55)] ring-1 ring-ink/10">
            <BeachScene className="absolute inset-0 size-full" />
            <BibleReader className="absolute bottom-[4%] left-[2%] w-[34%]" />
            <Worshipper className="absolute bottom-[9%] left-[34%] w-[33%]" />
            <BallPlayer className="absolute bottom-[3%] right-[1%] w-[33%]" />
          </div>
          <Chip className="-left-2 top-[10%] sm:-left-6" rot="-6deg"><HandHeart className="mr-1.5 inline size-4 text-sunset" />Pray</Chip>
          <Chip className="-right-2 top-[6%] delay-1 sm:-right-5" rot="5deg"><Users className="mr-1.5 inline size-4 text-lagoon" />Connect</Chip>
          <Chip className="-left-1 bottom-[22%] delay-2 sm:-left-8" rot="4deg"><BookOpen className="mr-1.5 inline size-4 text-palm" />Grow</Chip>
          <Chip className="-right-1 bottom-[30%] delay-3 sm:-right-6" rot="-5deg"><Volleyball className="mr-1.5 inline size-4 text-sunset-deep" />Play</Chip>
        </div>
      </div>
    </section>
  );
}

export function Marquee() {
  const words = ["Grow", "Connect", "Encounter God", "Pray", "Play", "Reflect", "Make an IMPACT"];
  const row = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {words.map((w) => (
        <span key={w} className="flex items-center gap-8 whitespace-nowrap">
          <span className="font-display text-2xl font-bold sm:text-3xl">{w}</span>
          <span className="text-sun" aria-hidden="true">✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden bg-ink py-5 text-sand" aria-hidden="true">
      <div className="anim-marquee flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}
