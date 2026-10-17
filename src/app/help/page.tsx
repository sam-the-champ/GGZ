import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { HelpCenter } from "@/components/help/help-center";
import { Praying } from "@/components/illustrations/characters";
import { HELP_CATEGORY_VALUES } from "@/lib/validation/registration";
import { RESPONSE_WINDOW, type HelpCategory } from "@/content/help";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Get help with GGZ Camp 1.0 registration and payments. We respond within 24–48 hours.",
};

export default async function HelpPage(props: PageProps<"/help">) {
  const sp = await props.searchParams;
  const topic = typeof sp.topic === "string" && (HELP_CATEGORY_VALUES as readonly string[]).includes(sp.topic)
    ? (sp.topic as HelpCategory)
    : undefined;
  return (
    <>
      <SiteHeader />
      <main id="main" className="grain min-h-dvh pb-20 pt-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sunset-deep">Help Center</p>
              <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight sm:text-5xl">How can we help?</h1>
              <p className="mt-3 text-lg text-ink/75">
                Pick a topic for a quick answer, or send us a request. We respond within {RESPONSE_WINDOW}.
              </p>
            </div>
            <Praying className="h-28 w-auto self-start sm:self-auto" />
          </div>
          <div className="mt-10">
            <HelpCenter initialTopic={topic} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
