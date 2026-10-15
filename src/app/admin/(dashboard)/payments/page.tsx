import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { listPayments } from "@/lib/services/admin";
import { StatusBadge } from "@/components/admin/status-badge";
import { Pagination } from "@/components/admin/pagination";
import { formatNaira } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

const STATUSES = ["all", "PAID", "PENDING", "FAILED", "ABANDONED", "MISMATCH", "REVERSED"];

export default async function PaymentsPage(props: PageProps<"/admin/payments">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" ? sp.status : "all";
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const result = await listPayments({ status, page });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Payments</h1>
        <p className="text-ink/65">
          Provider records verified server-side with Flutterwave. Statuses cannot be edited by hand — use “Re-verify with
          Flutterwave” on a registration to refresh one.
        </p>
      </div>
      <nav aria-label="Filter payments" className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/payments?status=${s}`}
            aria-current={result.status === s ? "true" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${result.status === s ? "bg-ink text-sand" : "bg-white text-ink/70 ring-1 ring-ink/10"}`}
          >
            {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink/5">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-wider text-ink/60">
            <tr>
              <th scope="col" className="px-4 py-3">Reference</th>
              <th scope="col" className="px-4 py-3">Email</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Expected</th>
              <th scope="col" className="px-4 py-3">Verified</th>
              <th scope="col" className="px-4 py-3">Channel</th>
              <th scope="col" className="px-4 py-3">Verified at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink/60">No payments yet.</td>
              </tr>
            )}
            {result.rows.map((p) => (
              <tr key={p.id} className="hover:bg-sand/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/registrations/${p.attempt.id}`} className="font-mono text-xs font-semibold hover:underline">
                    {p.reference}
                  </Link>
                  <p className="text-xs text-ink/50">{p.attempt.publicRef}</p>
                </td>
                <td className="px-4 py-3">{p.attempt.email}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 tabular-nums">{formatNaira(p.expectedAmountKobo)}</td>
                <td className={`px-4 py-3 tabular-nums ${p.paidAmountKobo != null && p.paidAmountKobo !== p.expectedAmountKobo ? "font-bold text-destructive" : ""}`}>
                  {p.paidAmountKobo != null ? `${formatNaira(p.paidAmountKobo)} ${p.paidCurrency ?? ""}` : "—"}
                </td>
                <td className="px-4 py-3">{p.channel ?? "—"}</td>
                <td className="px-4 py-3 text-ink/70">
                  {p.verifiedAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}
                  <span className="block text-xs text-ink/50">via {p.verificationSource.toLowerCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={result.page} pages={result.pages} href={(n) => `/admin/payments?status=${result.status}&page=${n}`} />
    </div>
  );
}
