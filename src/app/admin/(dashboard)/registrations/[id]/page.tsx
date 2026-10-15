import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasRole, requireAdminPage } from "@/lib/auth/session";
import { getAttemptDetail } from "@/lib/services/admin";
import { StatusBadge, overallStatus } from "@/components/admin/status-badge";
import { AttemptActions } from "@/components/admin/attempt-actions";
import { formatNaira } from "@/lib/money";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration detail" };

const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }) : "—";

export default async function RegistrationDetailPage(props: PageProps<"/admin/registrations/[id]">) {
  const admin = await requireAdminPage();
  const { id } = await props.params;
  const a = await getAttemptDetail(id);
  if (!a) notFound();
  const r = a.registration;
  const p = r?.participant;
  const history = await db.auditLog.findMany({
    where: { entityId: { in: [a.id, ...(r ? [r.id] : [])] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: { select: { name: true } } },
  });
  const isAdmin = hasRole(admin, "ADMIN");
  const status = overallStatus(a);

  return (
    <div className="space-y-6">
      <Link href="/admin/registrations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/70 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> All registrations
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold">{p?.fullName ?? a.email}</h1>
        <StatusBadge status={status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Registration">
            <Field label="Registration number" value={r?.registrationNumber ?? "Not yet completed"} mono />
            <Field label="Status" value={r?.status ?? (a.paymentStatus === "PAID" ? "Paid — form incomplete" : "Not registered")} />
            <Field label="Form completed" value={fmt(r?.formCompletedAt)} />
            <Field label="Confirmed" value={fmt(r?.confirmedAt)} />
            {r?.cancelledAt && <Field label="Cancelled" value={fmt(r.cancelledAt)} />}
            <Field label="Confirmation email" value={r?.confirmationEmailSentAt ? `Sent ${fmt(r.confirmationEmailSentAt)}` : "Not sent"} />
          </Panel>

          {p && (
            <Panel title="Participant">
              {p.erasedAt ? (
                <p className="text-sm text-ink/70">Personal data erased on {fmt(p.erasedAt)}.</p>
              ) : (
                <>
                  <Field label="Full name" value={p.fullName} />
                  <Field label="Email" value={p.email} />
                  <Field label="Phone" value={p.phone} />
                  <Field label="Date of birth" value={p.dateOfBirth.toISOString().slice(0, 10)} />
                  <Field label="City/State" value={p.cityOrState} />
                  <Field label="Emergency contact" value={`${p.emergencyContactName} · ${p.emergencyContactPhone}`} />
                  {p.guardianName && (
                    <Field
                      label="Guardian"
                      value={`${p.guardianName} · ${p.guardianPhone ?? ""}${p.guardianEmail ? ` · ${p.guardianEmail}` : ""} (consent ${fmt(p.guardianConsentAt)})`}
                    />
                  )}
                  <Field label="Support needs" value={p.supportNeeds ?? "None given"} />
                  <Field label="Terms accepted" value={`${fmt(p.termsAcceptedAt)} (version ${p.termsVersion})`} />
                </>
              )}
            </Panel>
          )}

          <Panel title="Payment">
            <Field label="Attempt reference" value={a.publicRef} mono />
            <Field label="Flutterwave reference" value={a.paymentReference} mono />
            <Field label="Checkout email" value={a.email} />
            <Field label="Expected amount" value={`${formatNaira(a.amountKobo)} ${a.currency}`} />
            <div className="flex flex-wrap gap-2 py-2">
              <StatusBadge status={a.paymentStatus} />
              <StatusBadge status={a.reservationStatus} />
            </div>
            <Field label="Reservation expiry" value={fmt(a.reservationExpiresAt)} />
            {a.payment ? (
              <>
                <Field label="Verified amount" value={a.payment.paidAmountKobo != null ? `${formatNaira(a.payment.paidAmountKobo)} ${a.payment.paidCurrency ?? ""}` : "—"} />
                <Field label="Provider transaction ID" value={a.payment.providerTransactionId ?? "—"} mono />
                <Field label="Channel" value={a.payment.channel ?? "—"} />
                <Field label="Gateway response" value={a.payment.gatewayResponse ?? "—"} />
                <Field label="Paid at" value={fmt(a.payment.paidAt)} />
                <Field label="Last verified" value={`${fmt(a.payment.verifiedAt)} via ${a.payment.verificationSource.toLowerCase()}`} />
              </>
            ) : (
              <p className="py-2 text-sm text-ink/60">No verified provider record yet.</p>
            )}
            <Field label="Started" value={fmt(a.createdAt)} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Actions">
            {isAdmin ? (
              <AttemptActions
                attemptId={a.id}
                canReverify={!["PAID", "MISMATCH", "REVERSED"].includes(a.paymentStatus)}
                canRecover={a.paymentStatus === "PAID" && a.reservationStatus === "HELD" && !r}
                canAllocate={a.paymentStatus === "PAID" && a.reservationStatus === "OVERFLOW"}
                canCancel={r?.status === "CONFIRMED"}
                canErase={Boolean(r && !p?.erasedAt)}
              />
            ) : (
              <p className="text-sm text-ink/60">Viewer accounts are read-only.</p>
            )}
          </Panel>
          <Panel title="History">
            {history.length === 0 ? (
              <p className="text-sm text-ink/60">No admin actions recorded.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="font-semibold">{h.action}</span> · {h.actor?.name ?? "system"} ·{" "}
                    <span className="text-ink/60">{fmt(h.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
      <h2 className="mb-2 font-display text-lg font-bold">{title}</h2>
      <dl className="divide-y divide-ink/5">{children}</dl>
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]">
      <dt className="text-sm text-ink/60">{label}</dt>
      <dd className={`break-words text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
