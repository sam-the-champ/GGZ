import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How God's GenZ Community collects, uses and protects information for GGZ Camp 1.0 registration.",
};

/*
 * EDITABLE DRAFT — organisers should review this notice (ideally with someone
 * familiar with the Nigeria Data Protection Act 2023) before registration
 * opens, then update the "Last updated" date.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="Draft for organiser review — 2026">
      <p>
        This notice explains how {site.organiser} (&ldquo;GGZ&rdquo;, &ldquo;we&rdquo;) handles personal information
        collected when you register for {site.eventName}. We collect only what we need to organise a safe camp.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your email address, used for payment and to send registration links and confirmations.</li>
        <li>Your full name, phone number, date of birth and city/state of residence.</li>
        <li>An emergency contact&apos;s name and phone number.</li>
        <li>For participants under the guardian-consent age: a parent or guardian&apos;s name, phone, optional email and their consent.</li>
        <li>Optional information you choose to share about dietary, accessibility or medical needs.</li>
        <li>Payment records from Flutterwave: reference, amount, currency, status, payment channel and time. We never receive or store card numbers, CVVs or bank login details — Flutterwave processes these.</li>
        <li>Technical data needed for security, such as a hashed form of your IP address for rate limiting.</li>
      </ul>
      <p>We do not ask for your church, denomination or membership.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>To process your registration and verify your payment.</li>
        <li>To plan the camp, contact you about it and keep participants safe.</li>
        <li>To contact your emergency contact or guardian if necessary.</li>
        <li>To prevent fraud and abuse of the registration system.</li>
      </ul>
      <p>We do not sell your information or use it for unrelated marketing.</p>

      <h2>Who can access it</h2>
      <p>
        Only authorised members of the GGZ organising team, through a password-protected admin area. Our service
        providers process data on our behalf: Flutterwave (payments), our hosting and database providers, and our email
        provider (if email is enabled).
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Participant registration details: until 6 months after the camp ends, then deleted or anonymised.</li>
        <li>Payment records: kept as long as needed for financial and accounting obligations, without unnecessary personal details.</li>
        <li>Unpaid or abandoned checkout records: deleted after 90 days.</li>
        <li>Security records (rate-limit counters, expired links): removed automatically within days.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct or delete your personal information, or withdraw consent where we rely on it. Send a
        request through the <Link href="/help">Help Center</Link>. We may need to confirm your identity first. Deleting
        your data before camp may mean we cannot keep your registration.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, access is restricted to authorised organisers, and administrative actions are logged.
      </p>
    </LegalPage>
  );
}
