import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import {
  listTickets,
  RESPONSE_DEADLINE_HOURS,
  RESPONSE_TARGET_HOURS,
  TICKET_FILTERS,
  ticketCounts,
  waitingHours,
} from "@/lib/services/support";
import { categoryLabel } from "@/content/help";
import { Pagination } from "@/components/admin/pagination";
import { TicketStatusBadge, WaitBadge } from "@/components/admin/ticket-badges";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help desk" };

const filterLabels: Record<(typeof TICKET_FILTERS)[number], string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
  all: "All",
};

export default async function HelpDeskPage(props: PageProps<"/admin/help">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const [result, counts] = await Promise.all([
    listTickets({ filter: typeof sp.filter === "string" ? sp.filter : "open", q, page }),
    ticketCounts(),
  ]);
  const qs = (over: Record<string, string | number>) =>
    `/admin/help?${new URLSearchParams({ ...(q ? { q } : {}), filter: result.filter, ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Help desk</h1>
        <p className="text-ink/65">
          Requests from the Help Center. Aim to respond within {RESPONSE_TARGET_HOURS} hours; participants are promised
          a response within {RESPONSE_TARGET_HOURS}–{RESPONSE_DEADLINE_HOURS} hours.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Open", value: counts.open, tone: "bg-ink/20" },
          { label: "In progress", value: counts.inProgress, tone: "bg-lagoon" },
          { label: `Waiting > ${RESPONSE_TARGET_HOURS}h`, value: counts.overdue, tone: "bg-sun" },
          { label: `Waiting > ${RESPONSE_DEADLINE_HOURS}h`, value: counts.breached, tone: "bg-destructive" },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/5">
            <span className={`absolute inset-y-0 left-0 w-1 ${s.tone}`} aria-hidden="true" />
            <p className="text-sm font-semibold text-ink/60">{s.label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <form role="search" className="flex gap-2" action="/admin/help">
        <input type="hidden" name="filter" value={result.filter} />
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" aria-hidden="true" />
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Reference, name, email, phone or registration no."
            className="h-11 w-full rounded-full border border-input bg-white pl-9 pr-4 text-sm outline-none focus:border-sunset focus:ring-4 focus:ring-sunset/20"
          />
        </div>
        <button className="rounded-full bg-sunset px-5 text-sm font-bold text-ink">Search</button>
      </form>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {TICKET_FILTERS.map((f) => (
          <Link
            key={f}
            href={qs({ filter: f, page: 1 })}
            aria-current={result.filter === f ? "true" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${result.filter === f ? "bg-ink text-sand" : "bg-white text-ink/70 ring-1 ring-ink/10 hover:text-ink"}`}
          >
            {filterLabels[f]}
          </Link>
        ))}
      </nav>

      <ul className="space-y-2">
        {result.rows.length === 0 && (
          <li className="rounded-2xl bg-white p-8 text-center text-ink/60 ring-1 ring-ink/5">No requests here.</li>
        )}
        {result.rows.map((t) => (
          <li key={t.id}>
            <Link
              href={`/admin/help/${t.id}`}
              className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/5 transition hover:ring-ink/20 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold">{t.reference}</span>
                  <TicketStatusBadge status={t.status} />
                  {t.status === "OPEN" && <WaitBadge hours={waitingHours(t)} />}
                </p>
                <p className="mt-1 font-semibold">{categoryLabel(t.category)}</p>
                <p className="truncate text-sm text-ink/65">
                  {t.name} · {t.email}
                  {t.phone ? ` · ${t.phone}` : ""} — {t.message.slice(0, 120)}
                </p>
              </div>
              <p className="shrink-0 text-xs text-ink/55">
                {t.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} pages={result.pages} href={(n) => qs({ page: n })} />
    </div>
  );
}
