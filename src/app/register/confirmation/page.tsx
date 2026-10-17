import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { FlowShell, Card, StatusPanel, primaryButton } from "@/components/register/flow-shell";
import { PrintButton } from "@/components/register/print-button";
import { Worshipper } from "@/components/illustrations/characters";
import { BrandMark } from "@/components/brand/brand-mark";
import { getSessionAttemptId } from "@/lib/registration-cookie";
import { getConfirmation } from "@/lib/services/registrations";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";

/**
 * Shown only to the browser holding the continuation cookie for this
 * registration — the URL itself contains no identifiers or personal data.
 */
export default async function ConfirmationPage() {
  const confirmation = await getConfirmation(await getSessionAttemptId());

  if (!confirmation) {
    return (
      <FlowShell>
        <StatusPanel tone="warning" title="Confirmation not available">
          <p>
            We can only show a confirmation in the browser used to register, for your privacy. If you completed
            registration, your registration number was shown on screen{" "}
            and — where email is enabled — sent to your inbox. If you need help,{" "}
            <Link href="/help?topic=NO_EMAIL" className="font-semibold underline">
              visit the Help Center
            </Link>
            .
          </p>
          <Link href="/" className={primaryButton}>Back to camp home</Link>
        </StatusPanel>
      </FlowShell>
    );
  }

  const cancelled = confirmation.status === "CANCELLED";

  return (
    <FlowShell step={3}>
      <Card className="print:shadow-none print:ring-0">
        <div className="hidden print:block">
          <BrandMark />
        </div>
        <div className="no-print flex justify-center">
          <Worshipper className="h-40 w-auto" />
        </div>
        <div className="text-center">
          <span
            className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${cancelled ? "bg-destructive/10 text-destructive" : "bg-palm/15 text-palm"}`}
          >
            {cancelled ? "Registration cancelled" : "Registration confirmed"}
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            {cancelled ? "This registration was cancelled" : `You're in, ${confirmation.fullName.split(" ")[0]}!`}
          </h1>
          {!cancelled && (
            <p className="mx-auto mt-3 max-w-md text-lg text-ink/75">
              Your place at {site.eventName} — {site.theme} is confirmed. We can&apos;t wait to see you.
            </p>
          )}
        </div>

        <dl className="mx-auto mt-8 max-w-md divide-y divide-ink/10 rounded-3xl bg-sand p-2">
          <Row label="Registration number">
            <span className="font-display text-2xl font-extrabold tracking-wider">{confirmation.registrationNumber}</span>
          </Row>
          <Row label="Name">{confirmation.fullName}</Row>
          <Row label="Status">{cancelled ? "Cancelled" : "Confirmed — payment verified"}</Row>
          <Row label="Dates">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden="true" /> {site.dates.label}
            </span>
          </Row>
          <Row label="Venue">
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-4" aria-hidden="true" /> {site.venueLabel}
            </span>
          </Row>
        </dl>

        <div className="no-print mx-auto mt-8 flex max-w-md flex-col gap-3">
          <PrintButton />
          <p className="text-center text-sm text-ink/65">
            {confirmation.emailSent
              ? `A confirmation email has been sent to ${confirmation.email}.`
              : "Save or print this page, or note your registration number."}
          </p>
        </div>
        <p className="mx-auto mt-8 max-w-md text-center text-sm text-ink/65">
          Programme and logistics details will be shared by the organisers. Questions?{" "}
          <Link href="/help" className="font-semibold underline">
            Visit the Help Center
          </Link>
        </p>
      </Card>
    </FlowShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-semibold text-ink/60">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
