import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/services/admin";
import { formatNaira } from "@/lib/money";
import { ticketCounts } from "@/lib/services/support";
import { emailConfigured, paymentsConfigured, webhookHashConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

function Stat({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const accent = { default: "bg-ink/20", good: "bg-palm", warn: "bg-sun", bad: "bg-destructive" }[tone];
  const body = (
    <div className="relative h-full overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 transition hover:ring-ink/20">
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} aria-hidden="true" />
      <p className="text-sm font-semibold text-ink/60">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/55">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const [stats, tickets] = await Promise.all([getDashboardStats(), ticketCounts()]);
  if (!stats) {
    return (
      <p className="rounded-2xl bg-destructive/10 p-5 font-semibold text-destructive">
        The event record is missing. Run <code>npm run db:seed</code> against this database.
      </p>
    );
  }
  const { capacity: c, event } = stats;
  const open = event.registrationOpen && stats.missingSetup.length === 0 && paymentsConfigured();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{event.name} — {event.theme}</h1>
          <p className="text-ink/65">Live figures from the database.</p>
        </div>
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-bold ${open ? "bg-palm/15 text-palm" : "bg-ink/10 text-ink/70"}`}
        >
          Registration {open ? (c.available === 0 ? "open · FULL" : "OPEN") : "CLOSED"}
        </span>
      </div>

      {(stats.missingSetup.length > 0 || !paymentsConfigured() || !webhookHashConfigured() || !emailConfigured() || stats.overCommitted || c.overflow > 0 || stats.mismatchedPayments > 0) && (
        <div className="space-y-2">
          {stats.missingSetup.length > 0 && (
            <Alert>
              Registration can&apos;t open until you set: <strong>{stats.missingSetup.join(", ")}</strong>.{" "}
              <Link href="/admin/settings" className="font-semibold underline">Go to settings</Link>
            </Alert>
          )}
          {!paymentsConfigured() && <Alert>FLUTTERWAVE_SECRET_KEY is not configured — payments cannot start.</Alert>}
          {paymentsConfigured() && !webhookHashConfigured() && (
            <Alert>
              FLUTTERWAVE_WEBHOOK_HASH is not set, so Flutterwave webhooks are rejected. Payments still verify when the
              participant returns to the site, but set the webhook so payers who close their browser are confirmed too.
            </Alert>
          )}
          {!emailConfigured() && (
            <Alert>
              Email isn&apos;t connected, so participants get no confirmation or recovery emails.{" "}
              <Link href="/admin/settings" className="font-semibold underline">How to connect it</Link>
            </Alert>
          )}
          {stats.overCommitted && (
            <Alert>
              Capacity ({c.capacity}) is below current commitments ({c.committed}). New reservations are blocked.
            </Alert>
          )}
          {c.overflow > 0 && (
            <Alert>
              {c.overflow} late payment(s) are waiting for a place or refund.{" "}
              <Link href="/admin/registrations?filter=overflow" className="font-semibold underline">Review</Link>
            </Alert>
          )}
          {stats.mismatchedPayments > 0 && (
            <Alert>
              {stats.mismatchedPayments} payment(s) did not match the expected amount/currency.{" "}
              <Link href="/admin/registrations?filter=mismatch" className="font-semibold underline">Review</Link>
            </Alert>
          )}
        </div>
      )}

      {tickets.open > 0 && (
        <Link
          href="/admin/help"
          className={`flex items-center justify-between rounded-2xl p-4 text-sm font-semibold ring-1 ${tickets.overdue > 0 ? "bg-sunset/15 ring-sunset/40" : "bg-white ring-ink/10"}`}
        >
          <span>
            Help desk: {tickets.open} open request{tickets.open === 1 ? "" : "s"}
            {tickets.overdue > 0 && ` · ${tickets.overdue} waiting over 24 hours`}
          </span>
          <span className="underline">Respond →</span>
        </Link>
      )}

      <section aria-labelledby="places">
        <h2 id="places" className="mb-3 font-display text-lg font-bold">Places</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Capacity" value={c.capacity ?? "Not set"} />
          <Stat label="Confirmed registrations" value={c.confirmed} tone="good" href="/admin/registrations?filter=confirmed" />
          <Stat label="Paid, form incomplete" value={c.paidIncomplete} tone="warn" hint="Holding a place" href="/admin/registrations?filter=paid_incomplete" />
          <Stat label="Active reservations" value={c.activeReservations} hint="Unpaid checkouts, not yet expired" />
          <Stat label="Available places" value={c.available ?? "—"} hint={`${c.committed} committed`} />
        </div>
      </section>

      <section aria-labelledby="money">
        <h2 id="money" className="mb-3 font-display text-lg font-bold">Payments</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Gross verified payments" value={formatNaira(stats.grossVerifiedKobo)} hint={`${stats.verifiedPaymentCount} verified with Flutterwave`} tone="good" href="/admin/payments?status=PAID" />
          <Stat label="Reversed / refunded" value={formatNaira(stats.reversedKobo)} hint={`${stats.reversedCount} payment(s)`} href="/admin/payments?status=REVERSED" />
          <Stat label="Net verified revenue" value={formatNaira(stats.netKobo)} tone="good" />
          <Stat label="Pending payments" value={stats.pendingPayments} href="/admin/registrations?filter=pending" />
          <Stat label="Failed payments" value={stats.failedPayments} tone="bad" hint={`${stats.abandonedPayments} abandoned`} href="/admin/registrations?filter=failed" />
        </div>
        <p className="mt-3 text-xs text-ink/55">
          Revenue counts only payments verified server-side with Flutterwave. Refunds are made in the Flutterwave dashboard and
          appear here once Flutterwave reports the transaction as reversed.
        </p>
      </section>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-sun/35 p-4 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
