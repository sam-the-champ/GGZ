import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasRole, requireAdminPage } from "@/lib/auth/session";
import { getTicket, waitingHours, whatsappNumber } from "@/lib/services/support";
import { emailConfigured } from "@/lib/env";
import { categoryLabel } from "@/content/help";
import { StatusBadge, overallStatus } from "@/components/admin/status-badge";
import { TicketStatusBadge, WaitBadge } from "@/components/admin/ticket-badges";
import { TicketRespond } from "@/components/admin/ticket-respond";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help request" };

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }) : "—";

const channelLabel: Record<string, string> = {
  WEB: "Request",
  EMAIL: "Email reply",
  PHONE: "Phone call",
  WHATSAPP: "WhatsApp",
  NOTE: "Internal note",
};

export default async function HelpTicketPage(props: PageProps<"/admin/help/[id]">) {
  const admin = await requireAdminPage();
  const { id } = await props.params;
  const t = await getTicket(id);
  if (!t) notFound();
  const wa = t.phone ? whatsappNumber(t.phone) : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/help" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/70 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> All requests
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold">{categoryLabel(t.category)}</h1>
        <TicketStatusBadge status={t.status} />
        {t.status === "OPEN" && <WaitBadge hours={waitingHours(t)} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="thread" className="space-y-3">
          <h2 id="thread" className="font-display text-lg font-bold">Conversation</h2>
          <ol className="space-y-3">
            {t.messages.map((m) => {
              const fromPerson = m.channel === "WEB";
              return (
                <li
                  key={m.id}
                  className={`rounded-2xl p-4 ring-1 ${m.channel === "NOTE" ? "bg-sun/20 ring-sun/40" : fromPerson ? "bg-white ring-ink/10" : "bg-palm/5 ring-palm/20"}`}
                >
                  <p className="text-xs font-semibold text-ink/60">
                    {channelLabel[m.channel]} · {fromPerson ? t.name : (m.author?.name ?? "Organiser")} · {fmt(m.createdAt)}
                    {m.channel === "EMAIL" && (m.emailSent ? " · delivered to mail server" : " · not sent")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.body}</p>
                </li>
              );
            })}
          </ol>
          {hasRole(admin, "ADMIN") ? (
            <TicketRespond
              ticketId={t.id}
              reference={t.reference}
              name={t.name}
              phoneTel={t.phone}
              whatsapp={wa}
              status={t.status}
              emailEnabled={emailConfigured()}
            />
          ) : (
            <p className="text-sm text-ink/60">Viewer accounts can read requests but not respond.</p>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
            <h2 className="font-display text-lg font-bold">Contact</h2>
            <dl className="mt-2 space-y-2 text-sm">
              <div><dt className="text-ink/60">Reference</dt><dd className="font-mono font-semibold">{t.reference}</dd></div>
              <div><dt className="text-ink/60">Name</dt><dd className="font-semibold">{t.name}</dd></div>
              <div><dt className="text-ink/60">Email</dt><dd className="break-all font-semibold">{t.email}</dd></div>
              <div><dt className="text-ink/60">Phone</dt><dd className="font-semibold">{t.phone ?? "Not given"}</dd></div>
              <div><dt className="text-ink/60">Reference they gave</dt><dd className="font-semibold">{t.registrationRef ?? "—"}</dd></div>
              <div><dt className="text-ink/60">Received</dt><dd>{fmt(t.createdAt)}</dd></div>
              <div><dt className="text-ink/60">First response</dt><dd>{fmt(t.firstResponseAt)}</dd></div>
              {t.resolvedAt && <div><dt className="text-ink/60">Resolved</dt><dd>{fmt(t.resolvedAt)}</dd></div>}
            </dl>
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
            <h2 className="font-display text-lg font-bold">Linked registration</h2>
            {t.attempt ? (
              <div className="mt-2 space-y-2 text-sm">
                <p className="flex flex-wrap gap-2">
                  <StatusBadge status={overallStatus(t.attempt)} />
                  <StatusBadge status={t.attempt.paymentStatus} />
                </p>
                <p>
                  {t.attempt.registration ? (
                    <>Registration <span className="font-mono font-semibold">{t.attempt.registration.registrationNumber}</span></>
                  ) : (
                    <>Attempt <span className="font-mono font-semibold">{t.attempt.publicRef}</span></>
                  )}
                </p>
                <Link href={`/admin/registrations/${t.attempt.id}`} className="font-semibold underline">
                  Open registration →
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink/60">
                No registration matched this email or reference. Search{" "}
                <Link href={`/admin/registrations?q=${encodeURIComponent(t.email)}`} className="underline">
                  registrations
                </Link>{" "}
                if needed.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
