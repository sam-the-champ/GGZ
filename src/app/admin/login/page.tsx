import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/session";
import { envProblems } from "@/lib/env";
import { LoginForm } from "@/components/admin/login-form";
import { BrandMark } from "@/components/brand/brand-mark";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function AdminLoginPage() {
  // A misconfigured deployment would otherwise surface only as a generic error
  // with a digest. Show which variables need fixing — names only, never values.
  const problems = envProblems();
  if (problems.length > 0) {
    console.error("[admin] server environment misconfigured:", problems.join("; "));
    return (
      <main id="main" className="grid min-h-dvh place-items-center px-4">
        <div className="w-full max-w-md">
          <BrandMark />
          <div role="alert" className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-destructive/30">
            <h1 className="font-display text-2xl font-extrabold">Server setup incomplete</h1>
            <p className="mt-2 text-sm text-ink/70">
              Fix these environment variables in your hosting settings (Vercel → Project → Settings → Environment
              Variables), then redeploy:
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm font-semibold">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink/55">
              Paste values without surrounding quotes. See the README section “Environment configuration”.
            </p>
          </div>
        </div>
      </main>
    );
  }

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
