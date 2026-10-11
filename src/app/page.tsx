import { SiteHeader } from "@/components/landing/site-header";
import { Hero, Marquee } from "@/components/landing/hero";
import { About, CampDetails, Impact, WhatToExpect } from "@/components/landing/sections";
import { RegisterSection } from "@/components/landing/register-section";
import { Faq } from "@/components/landing/faq";
import { SiteFooter } from "@/components/landing/site-footer";
import { getPublicEventInfoSafe } from "@/lib/services/public-info";
import { site } from "@/content/site";

// Public event info (fee, availability) is re-read at most once a minute and
// immediately after admins change settings (revalidatePath("/")). The
// /register page always re-checks availability on the server.
export const revalidate = 60;

export default async function HomePage() {
  const info = await getPublicEventInfoSafe();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${site.eventName} — ${site.theme}`,
    startDate: site.dates.start,
    endDate: site.dates.end,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: site.venue.name,
      address: { "@type": "PostalAddress", addressLocality: `${site.venue.area}, ${site.venue.city}`, addressCountry: "NG" },
    },
    organizer: { "@type": "Organization", name: site.organiser },
    description: site.description,
  };
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Marquee />
        <About />
        <Impact />
        <WhatToExpect />
        <CampDetails />
        <RegisterSection info={info} />
        <Faq info={info} />
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }}
      />
    </>
  );
}
