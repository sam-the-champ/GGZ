import Link from "next/link";
import { Download, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { LIST_FILTERS, searchAttempts } from "@/lib/services/admin";
import { StatusBadge, overallStatus } from "@/components/admin/status-badge";
import { Pagination } from "@/components/admin/pagination";
import { formatNaira } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registrations" };

const filterLabels: Record<(typeof LIST_FILTERS)[number], string> = {
  all: "All",
  confirmed: "Confirmed",
  paid_incomplete: "Paid · incomplete",
  overflow: "Needs place",
  pending: "Pending",
  failed: "Failed",
  abandoned: "Abandoned",
  mismatch: "Mismatch",
  cancelled: "Cancelled",
};

export default async function RegistrationsPage(props: PageProps<"/admin/registrations">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const result = await searchAttempts({ q, filter, page });
  const active = result.filter ?? "all";

  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), filter: active, ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    return `/admin/registrations?${p}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Registrations</h1>
          <p className="text-ink/65">{result.total} matching record(s)</p>
        </div>
        <a
          href={`/api/admin/export?filter=${active === "all" ? "confirmed" : active}`}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-sand hover:bg-ink-soft"
        >
          <Download className="size-4" aria-hidden="true" /> Export CSV ({filterLabels[active === "all" ? "confirmed" : active]})
        </a>
      </div>

      <form role="search" className="flex gap-2" action="/admin/registrations">
        <input type="hidden" name="filter" value={active} />
        <label htmlFor="q" className="sr-only">Search</label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" aria-hidden="true" />
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Name, email, phone, registration no. or reference"
            className="h-11 w-full rounded-full border border-input bg-white pl-9 pr-4 text-sm outline-none focus:border-sunset focus:ring-4 focus:ring-sunset/20"
          />
        </div>
        <button className="rounded-full bg-sunset px-5 text-sm font-bold text-ink">Search</button>
      </form>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {LIST_FILTERS.map((f) => (
          <Link
            key={f}
            href={qs({ filter: f, page: 1 })}
            aria-current={active === f ? "true" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${active === f ? "bg-ink text-sand" : "bg-white text-ink/70 ring-1 ring-ink/10 hover:text-ink"}`}
          >
            {filterLabels[f]}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink/5">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-wider text-ink/60">
            <tr>
              <th scope="col" className="px-4 py-3">Participant</th>
              <th scope="col" className="px-4 py-3">Reg. no.</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Payment</th>
              <th scope="col" className="px-4 py-3">Amount</th>
              <th scope="col" className="px-4 py-3">Started</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/60">No records match.</td>
              </tr>
            )}
            {result.rows.map((r) => (
              <tr key={r.id} className="hover:bg-sand/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/registrations/${r.id}`} className="font-semibold hover:underline">
                    {r.registration?.participant.fullName ?? <span className="text-ink/60">(form not completed)</span>}
                  </Link>
                  <p className="text-xs text-ink/60">{r.email}{r.registration?.participant.phone ? ` · ${r.registration.participant.phone}` : ""}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.registration?.registrationNumber ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={overallStatus(r)} /></td>
                <td className="px-4 py-3"><StatusBadge status={r.paymentStatus} /></td>
                <td className="px-4 py-3 tabular-nums">{formatNaira(r.amountKobo)}</td>
                <td className="px-4 py-3 text-ink/70">{r.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={result.page} pages={result.pages} href={(p) => qs({ page: p })} />
    </div>
  );
}
