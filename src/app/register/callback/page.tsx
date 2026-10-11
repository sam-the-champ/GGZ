import Link from "next/link";
import { redirect } from "next/navigation";
import { FlowShell, StatusPanel, primaryButton, secondaryButton } from "@/components/register/flow-shell";
import { Praying } from "@/components/illustrations/characters";
import { getSessionAttemptId } from "@/lib/registration-cookie";
import { verifyAndApply } from "@/lib/services/payments";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { recheckPaymentAction } from "@/app/register/actions";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";

/**
 * Paystack redirects here after checkout (or on cancel). Arriving here proves
 * nothing: the reference is verified server-side with Paystack's API, and the
 * form only unlocks if this browser's continuation cookie belongs to the
 * same attempt.
 */
export default async function CallbackPage(props: PageProps<"/register/callback">) {
  const sp = await props.searchParams;
  const reference = typeof sp.reference === "string" ? sp.reference : typeof sp.trxref === "string" ? sp.trxref : "";
  const cancelled = sp.cancelled === "1";

  if (!/^ggz_[A-Za-z0-9_-]{10,60}$/.test(reference)) {
    return (
      <FlowShell step={1}>
        <StatusPanel tone="error" title="We couldn't find that payment">
          <p>This link doesn&apos;t contain a valid payment reference.</p>
          <Link href="/register" className={primaryButton}>
            Start registration
          </Link>
        </StatusPanel>
      </FlowShell>
    );
  }

  if (!(await rateLimit("verify", await clientIp())).ok) {
    return (
      <FlowShell step={1}>
        <StatusPanel tone="warning" title="Please wait a moment">
          <p>Too many checks from your connection. Wait a few minutes, then refresh this page.</p>
        </StatusPanel>
      </FlowShell>
    );
  }

  let outcome: Awaited<ReturnType<typeof verifyAndApply>> | null = null;
  try {
    outcome = await verifyAndApply(reference, "CALLBACK", { cancelled });
  } catch (err) {
    console.error("[callback] verification error", (err as Error).message);
  }

  if (!outcome) {
    return (
      <FlowShell step={1}>
        <StatusPanel tone="warning" title="We're still confirming your payment">
          <p>
            We couldn&apos;t reach Paystack to confirm your payment just now. <strong>Please don&apos;t pay again.</strong>{" "}
            Try again in a minute.
          </p>
          <form action={recheckPaymentAction}>
            <button className={primaryButton}>Check again</button>
          </form>
        </StatusPanel>
      </FlowShell>
    );
  }

  if (outcome.kind === "unknown_reference") {
    return (
      <FlowShell step={1}>
        <StatusPanel tone="error" title="We couldn't find that payment">
          <p>
            If you were charged, contact {site.contact.name} on {site.contact.phoneDisplay} with your Paystack receipt.
          </p>
        </StatusPanel>
      </FlowShell>
    );
  }

  const attempt = outcome.attempt;
  const ownsAttempt = (await getSessionAttemptId()) === attempt.id;
  const status = outcome.kind === "not_found_at_provider" ? "PENDING" : attempt.paymentStatus;

  if (status === "PAID" && attempt.reservationStatus === "HELD") {
    if (ownsAttempt) redirect("/register/form");
    return (
      <FlowShell step={1}>
        <StatusPanel tone="success" title="Payment received" art={<Praying className="h-32 w-auto" />}>
          <p>Your payment has been verified. For your security, please continue in the browser where you started — or:</p>
          <p>
            Go to <strong>Resume registration</strong> and enter the email you paid with. We&apos;ll send you a secure
            link. You won&apos;t be charged again.
          </p>
          <Link href="/register/resume" className={primaryButton}>
            Resume registration
          </Link>
        </StatusPanel>
      </FlowShell>
    );
  }

  if (status === "PAID" && attempt.reservationStatus === "OVERFLOW") {
    return (
      <FlowShell step={1}>
        <StatusPanel tone="warning" title="Payment received — organisers will be in touch">
          <p>
            Your payment was verified, but it completed after your reserved place expired and camp is now full. Your
            payment is safely recorded (reference <strong>{attempt.publicRef}</strong>).
          </p>
          <p>
            The organisers will contact you about a place or a refund. You can also reach {site.contact.name} on{" "}
            {site.contact.phoneDisplay}.
          </p>
        </StatusPanel>
      </FlowShell>
    );
  }

  if (status === "PENDING" || status === "INITIATED") {
    return (
      <FlowShell step={1}>
        <StatusPanel tone="info" title="Your payment is still processing">
          <p>
            Paystack hasn&apos;t confirmed your payment yet. This can take a few minutes for bank transfers and USSD.{" "}
            <strong>Please don&apos;t pay again.</strong>
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {ownsAttempt && (
              <form action={recheckPaymentAction}>
                <button className={primaryButton}>Check payment status</button>
              </form>
            )}
            <Link href="/register/resume" className={secondaryButton}>
              Resume later
            </Link>
          </div>
        </StatusPanel>
      </FlowShell>
    );
  }

  const title =
    status === "ABANDONED"
      ? "Checkout cancelled"
      : status === "FAILED"
        ? "Your payment didn't go through"
        : status === "MISMATCH"
          ? "We need to check this payment"
          : "This payment can't be used";
  return (
    <FlowShell step={1}>
      <StatusPanel tone="error" title={title}>
        {status === "MISMATCH" ? (
          <p>
            Paystack reported a payment that doesn&apos;t match the expected amount. The organisers have been flagged to
            review it — please contact {site.contact.name} on {site.contact.phoneDisplay} with reference{" "}
            <strong>{attempt.publicRef}</strong>.
          </p>
        ) : (
          <p>
            You have not been charged for this attempt{status === "REVERSED" ? " (it was reversed)" : ""}. Your held
            place has been released. You can try again whenever you&apos;re ready.
          </p>
        )}
        {status !== "MISMATCH" && (
          <Link href="/register" className={primaryButton}>
            Try again
          </Link>
        )}
      </StatusPanel>
    </FlowShell>
  );
}
