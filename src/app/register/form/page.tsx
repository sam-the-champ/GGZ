import Link from "next/link";
import { redirect } from "next/navigation";
import { FlowShell, Card, StatusPanel, primaryButton, secondaryButton } from "@/components/register/flow-shell";
import { RegistrationForm } from "@/components/register/registration-form";
import { getSessionAttemptId } from "@/lib/registration-cookie";
import { getFormAccess } from "@/lib/services/registrations";
import { getEvent } from "@/lib/services/event";
import { recheckPaymentAction } from "@/app/register/actions";

export const dynamic = "force-dynamic";

export default async function RegistrationFormPage() {
  const access = await getFormAccess(await getSessionAttemptId());

  if (access.kind === "completed") redirect("/register/confirmation");

  if (access.kind === "no_session") {
    return (
      <FlowShell step={2}>
        <StatusPanel tone="warning" title="Let's find your registration">
          <p>
            We couldn&apos;t find an active registration session in this browser. If you&apos;ve already paid, we can
            send a secure link to the email you paid with — you won&apos;t be charged again.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/register/resume" className={primaryButton}>Resume registration</Link>
            <Link href="/register" className={secondaryButton}>Start a new registration</Link>
          </div>
        </StatusPanel>
      </FlowShell>
    );
  }

  if (access.kind === "awaiting_payment") {
    return (
      <FlowShell step={1}>
        <StatusPanel tone="info" title="We haven't confirmed your payment yet">
          <p>
            The form unlocks as soon as Flutterwave confirms your payment. <strong>Please don&apos;t pay again.</strong>
          </p>
          <form action={recheckPaymentAction}>
            <button className={primaryButton}>Check payment status</button>
          </form>
        </StatusPanel>
      </FlowShell>
    );
  }

  if (access.kind === "overflow") {
    return (
      <FlowShell step={1}>
        <StatusPanel tone="warning" title="Payment received — organisers will be in touch">
          <p>
            Your payment arrived after your reserved place expired and camp is currently full. Your payment is safely
            recorded (reference <strong>{access.publicRef}</strong>). The organisers will contact you about a place or a
            refund — or you can{" "}
            <Link href="/help?topic=PAID_NOT_CONFIRMED" className="font-semibold underline">
              send a request in the Help Center
            </Link>
            .
          </p>
        </StatusPanel>
      </FlowShell>
    );
  }

  if (access.kind === "payment_problem") {
    return (
      <FlowShell step={1}>
        <StatusPanel tone="error" title="This payment can't be used to register">
          <p>
            The payment for reference <strong>{access.publicRef}</strong> was not completed successfully. You can start
            a new registration, or{" "}
            <Link href="/help?topic=PAYMENT_FAILED" className="font-semibold underline">
              send a request in the Help Center
            </Link>{" "}
            if you believe this is a mistake.
          </p>
          <Link href="/register" className={primaryButton}>Start again</Link>
        </StatusPanel>
      </FlowShell>
    );
  }

  const event = await getEvent();
  if (!event) redirect("/");

  return (
    <FlowShell step={2}>
      <Card>
        <span className="inline-flex rounded-full bg-palm/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-palm">
          Payment verified
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          Almost there — tell us about you
        </h1>
        <p className="mt-3 text-ink/75">
          Your payment is confirmed. <strong>Your place is confirmed once you submit this form.</strong> If you need to
          stop, you can come back later with the same browser or via “Resume registration”.
        </p>
        <RegistrationForm
          email={access.email}
          eventStart={event.startDate.toISOString().slice(0, 10)}
          minimumAge={event.minimumAge}
          guardianConsentAge={event.guardianConsentAge}
        />
      </Card>
    </FlowShell>
  );
}
