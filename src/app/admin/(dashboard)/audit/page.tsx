import { requireAdminPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Pagination } from "@/components/admin/pagination";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

const PAGE = 50;

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const [total, rows] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-extrabold">Audit log</h1>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink/5">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-wider text-ink/60">
            <tr>
              <th scope="col" className="px-4 py-3">When</th>
              <th scope="col" className="px-4 py-3">Who</th>
              <th scope="col" className="px-4 py-3">Action</th>
              <th scope="col" className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                  {r.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}
                </td>
                <td className="px-4 py-3">{r.actor?.name ?? "system"}</td>
                <td className="px-4 py-3 font-semibold">{r.action}</td>
                <td className="max-w-md px-4 py-3">
                  {r.details ? <code className="block whitespace-pre-wrap break-words text-xs text-ink/70">{JSON.stringify(r.details)}</code> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} href={(n) => `/admin/audit?page=${n}`} />
    </div>
  );
}
