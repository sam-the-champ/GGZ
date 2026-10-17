import type { ReactNode } from "react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-2 text-sm text-ink/60">Last updated: {updated}</p>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-ink/85 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2 [&_a]:font-semibold [&_a]:underline">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
