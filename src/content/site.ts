/**
 * Confirmed, organiser-supplied facts about the camp. Anything that is not yet
 * confirmed (fee, capacity, refund policy, age policy) lives in the database
 * and is edited from /admin/settings — never hard-code it here.
 */
export const EVENT_SLUG = "ggz-camp-1";

export const site = {
  organiser: "God's GenZ Community",
  organiserShort: "GGZ",
  eventName: "GGZ Camp 1.0",
  theme: "IMPACT",
  dates: { start: "2026-12-08", end: "2026-12-10", label: "8–10 December 2026" },
  venue: { name: "Royal Beach", area: "Orimedu", city: "Lagos", country: "Nigeria" },
  venueLabel: "Royal Beach, Orimedu, Lagos",
  scripture: {
    reference: "Acts 17:6",
    // King James Version (public domain).
    text: "These that have turned the world upside down are come hither also.",
    translation: "KJV",
  },
  contact: {
    name: "GenZ Uncle",
    phoneDisplay: "0706 673 9789",
    phoneE164: "+2347066739789",
    whatsapp: "https://wa.me/2347066739789",
  },
  description:
    "GGZ Camp 1.0 — IMPACT. Three days by the beach to grow, connect, encounter God and discover how your life can make a difference. 8–10 December 2026 at Royal Beach, Orimedu, Lagos.",
} as const;

/**
 * Logistics that organisers have not confirmed yet. Add an entry's `value`
 * once confirmed and it will appear in the Camp Details section.
 */
export const logistics: { label: string; value: string | null }[] = [
  { label: "Accommodation", value: null },
  { label: "Meals", value: null },
  { label: "Transport", value: null },
  { label: "Check-in time", value: null },
  { label: "What to pack", value: null },
];
