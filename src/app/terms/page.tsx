import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getPublicEventInfoSafe } from "@/lib/services/public-info";
import { formatNaira } from "@/lib/money";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Registration terms & payments",
  description: "Registration terms, payment information and refund policy for GGZ Camp 1.0.",
};

export const revalidate = 60;

/*
 * EDITABLE DRAFT — organisers must approve these terms, the age policy and
 * safeguarding arrangements before registration opens. The fee, refund policy
 * and age policy below come from /admin/settings.
 */
export default async function TermsPage() {
  const info = await getPublicEventInfoSafe();
  return (
    <LegalPage title="Registration terms & payments" updated="Draft for organiser review — 2026">
      <h2>Registration</h2>
      <ul>
        <li>{site.eventName} takes place {site.dates.label} at {site.venueLabel}.</li>
        <li>Registration is complete only when your payment has been verified <strong>and</strong> your registration form has been submitted. You will then receive a registration number.</li>
        <li>Places are limited and allocated in the order registrations are secured. Starting checkout holds a place for a limited time; if you don&apos;t complete payment in that time the place is released.</li>
        <li>Each payment covers one participant.</li>
        <li>You must give accurate information. Participants under {info.guardianConsentAge} need a parent or guardian&apos;s consent{info.minimumAge != null ? `, and participants must be at least ${info.minimumAge} at the start of camp` : ""}.</li>
        <li>Participants are expected to respect others, follow the organisers&apos; reasonable instructions and the venue&apos;s rules.</li>
      </ul>

      <h2>Fee &amp; payment</h2>
      <ul>
        <li>
          Registration fee:{" "}
          <strong>{info.feeKobo != null ? formatNaira(info.feeKobo) : "to be announced"}</strong>.
          {info.feeCovers ? ` It covers: ${info.feeCovers}` : ""}
        </li>
        <li>Payments are processed securely by Paystack. We never see or store your card details.</li>
        <li>The amount you pay is fixed when you start checkout, even if the fee changes later.</li>
        <li>If you paid but could not finish your form, use “Resume registration” — never pay twice. If you believe you were charged twice, contact us and we will investigate with Paystack.</li>
      </ul>

      <h2>Refunds &amp; cancellations</h2>
      {info.refundPolicy ? (
        <p className="whitespace-pre-line">{info.refundPolicy}</p>
      ) : (
        <p>
          The refund and cancellation policy has not been published yet. Registration will not open until it is. Contact{" "}
          {site.contact.name} on {site.contact.phoneDisplay} with any questions.
        </p>
      )}
      <p>If a late payment arrives after camp is full, the organisers will contact you to offer a place if one becomes available or arrange a refund.</p>

      <h2>Programme &amp; logistics</h2>
      <p>The detailed programme, accommodation, meals, transport and check-in arrangements will be communicated by the organisers. Activities may change for safety or practical reasons.</p>

      <h2>Contact</h2>
      <p>{site.contact.name} · {site.contact.phoneDisplay}</p>
    </LegalPage>
  );
}
