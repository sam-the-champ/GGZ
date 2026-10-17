import { hasRole, requireAdminPage } from "@/lib/auth/session";
import { getEvent } from "@/lib/services/event";
import { SettingsForm } from "@/components/admin/settings-form";
import { koboToNairaInput } from "@/lib/money";
import { EmailPanel } from "@/components/admin/email-panel";
import { emailProvider } from "@/lib/env";
import { senderAddress } from "@/lib/email/send";
import { countPendingConfirmations } from "@/lib/services/registrations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Event settings" };

export default async function SettingsPage() {
  const admin = await requireAdminPage();
  const event = await getEvent();
  if (!event) return <p>Event record missing — run the database seed.</p>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Event settings</h1>
        <p className="text-ink/65">All changes are validated on the server and recorded in the audit log.</p>
      </div>
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
        <h2 className="font-display text-lg font-bold">Confirmed event details</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-ink/60">Event</dt><dd className="font-semibold">{event.name} — {event.theme}</dd></div>
          <div><dt className="text-ink/60">Dates</dt><dd className="font-semibold">{event.startDate.toISOString().slice(0, 10)} → {event.endDate.toISOString().slice(0, 10)}</dd></div>
          <div><dt className="text-ink/60">Venue</dt><dd className="font-semibold">{event.venue}</dd></div>
        </dl>
      </section>
      <EmailPanel
        provider={emailProvider()}
        sender={emailProvider() ? senderAddress() : null}
        canTest={hasRole(admin, "ADMIN")}
        pendingConfirmations={await countPendingConfirmations()}
      />
      <SettingsForm
        readOnly={!hasRole(admin, "ADMIN")}
        initial={{
          feeNaira: koboToNairaInput(event.feeKobo),
          capacity: event.capacity?.toString() ?? "",
          reservationMinutes: event.reservationMinutes,
          feeCovers: event.feeCovers ?? "",
          refundPolicy: event.refundPolicy ?? "",
          minimumAge: event.minimumAge?.toString() ?? "",
          guardianConsentAge: event.guardianConsentAge,
          registrationOpen: event.registrationOpen,
        }}
      />
    </div>
  );
}
