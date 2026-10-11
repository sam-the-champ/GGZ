import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { LoginForm } from "@/components/admin/login-form";
import { BrandMark } from "@/components/brand/brand-mark";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <BrandMark />
        <div className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-ink/5">
          <h1 className="font-display text-2xl font-extrabold">Organiser sign in</h1>
          <p className="mt-1 text-sm text-ink/65">GGZ Camp 1.0 administration</p>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-ink/50">
          Accounts are created by the technical team. There is no public sign-up.
        </p>
      </div>
    </main>
  );
}
