import { FlowShell, Card } from "@/components/register/flow-shell";
import { ResumeForm } from "@/components/register/resume-form";
import { Praying } from "@/components/illustrations/characters";

export const dynamic = "force-dynamic";

export default async function ResumePage(props: PageProps<"/register/resume">) {
  const sp = await props.searchParams;
  const error =
    sp.error === "expired"
      ? "That link has expired or was already used. Request a new one below."
      : sp.error === "rate"
        ? "Too many attempts. Please wait a few minutes."
        : null;
  return (
    <FlowShell>
      <Card>
        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-tight">Resume your registration</h1>
            <p className="mt-3 text-lg text-ink/75">
              Paid but couldn&apos;t finish the form? Enter the email you paid with. We&apos;ll re-check your payment with
              Flutterwave and send you a secure link. <strong>You won&apos;t be charged again.</strong>
            </p>
          </div>
          <Praying className="h-28 w-auto self-start" />
        </div>
        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-sun/30 p-4 font-semibold">
            {error}
          </p>
        )}
        <ResumeForm />
      </Card>
    </FlowShell>
  );
}
