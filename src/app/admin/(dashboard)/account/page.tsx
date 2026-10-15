import { requireAdminPage } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account" };

export default async function AccountPage() {
  const admin = await requireAdminPage();
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">My account</h1>
        <p className="text-ink/65">
          {admin.name} · {admin.email} · {admin.role === "ADMIN" ? "Admin" : "Viewer"}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
