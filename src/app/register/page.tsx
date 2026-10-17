import Link from "next/link";
import { FlowShell, Card } from "@/components/register/flow-shell";
import { StartForm } from "@/components/register/start-form";
import { BibleReader } from "@/components/illustrations/characters";
import { getPublicEventInfo } from "@/lib/services/event";
import { paymentsConfigured } from "@/lib/env";
import { formatNaira } from "@/lib/money";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const info = await getPublicEventInfo();
  const a = info.availability;
  const open = a.state === "open" && paymentsConfigured() ? a : null;

  return (
    <FlowShell step={0}>
      <Card>
        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-sunset-deep">
              {site.eventName} · {site.theme}
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight">Secure your place</h1>
            <p className="mt-2 text-ink/75">
              {site.dates.label} · {site.venueLabel}
            </p>
          </div>
          <BibleReader className="h-28 w-auto self-start" />
        </div>

        {open ? (
          <>
            <div className="mt-6 rounded-2xl bg-ink p-5 text-sand">
              <p className="text-sm font-bold uppercase tracking-widest text-sun">Registration fee</p>
              <p className="mt-1 font-display text-4xl font-extrabold">{formatNaira(open.feeKobo)}</p>
              {info.feeCovers && <p className="mt-2 whitespace-pre-line text-sand/80">{info.feeCovers}</p>}
            </div>
            <ol className="mt-6 space-y-2 text-ink/80">
              <li>
                <strong>1.</strong> Enter your email and pay securely with Flutterwave.
              </li>
              <li>
                <strong>2.</strong> We verify your payment directly with Flutterwave.
              </li>
              <li>
                <strong>3.</strong> Complete the short registration form to confirm your place.
              </li>
            </ol>
            <p className="mt-4 rounded-2xl bg-sun/30 p-4 text-sm">
              Your place is held for a short time while you pay. Registration is complete only after your payment is
              verified <strong>and</strong> the form is submitted.
            </p>
            <StartForm feeLabel={formatNaira(open.feeKobo)} />
          </>
        ) : (
          <div role="status" className="mt-8 rounded-2xl bg-sand p-6">
            <p className="font-display text-2xl font-bold">
              {a.state === "full"
                ? "Camp is fully booked"
                : a.state === "closed"
                  ? "Registration is currently closed"
                  : "Registration opens soon"}
            </p>
            <p className="mt-2 text-ink/80">
              {a.state === "full"
                ? "All places are currently taken. Places sometimes free up when unpaid checkouts expire — please check back."
                : "Payments are not being accepted right now. Please check back soon or contact the organisers."}
            </p>
            <p className="mt-4 text-ink/80">
              Questions?{" "}
              <Link href="/help" className="font-semibold underline">
                Visit the Help Center
              </Link>
              .
            </p>
          </div>
        )}

        <p className="mt-8 border-t border-ink/10 pt-6 text-sm text-ink/70">
          Already paid?{" "}
          <Link href="/register/resume" className="font-semibold text-ink underline underline-offset-2">
            Resume your registration
          </Link>{" "}
          — you won&apos;t be charged twice.
        </p>
      </Card>
    </FlowShell>
  );
}
