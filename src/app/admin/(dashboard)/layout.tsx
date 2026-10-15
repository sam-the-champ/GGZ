import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";
import { logoutAction } from "@/app/admin/actions";
import { BrandMark } from "@/components/brand/brand-mark";
import { AdminNav } from "@/components/admin/admin-nav";
import { paymentsMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdminPage();
  const mode = paymentsMode();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" aria-label="Admin dashboard">
              <BrandMark compact />
            </Link>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${mode === "live" ? "bg-palm/15 text-palm" : mode === "test" ? "bg-sun/50 text-ink" : "bg-destructive/10 text-destructive"}`}
            >
              Flutterwave: {mode === "live" ? "LIVE" : mode === "test" ? "TEST MODE" : "NOT CONFIGURED"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink/70 sm:inline">
              {admin.name} · <span className="font-semibold">{admin.role === "ADMIN" ? "Admin" : "Viewer"}</span>
            </span>
            <form action={logoutAction}>
              <button className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 font-semibold hover:bg-ink/5">
                <LogOut className="size-4" aria-hidden="true" /> Sign out
              </button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
