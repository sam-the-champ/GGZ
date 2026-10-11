import Link from "next/link";
import { FlowShell, StatusPanel, primaryButton } from "@/components/register/flow-shell";
import { peekEmailLinkToken } from "@/lib/services/continuation";
import { consumeRecoveryLinkAction } from "@/app/register/actions";

export const dynamic = "force-dynamic";

/**
 * Recovery links are single-use, so opening one only *shows* a button —
 * email security scanners that pre-fetch links cannot consume the token.
 * The token is exchanged for a session cookie by a POST (server action).
 */
export default async function ResumeTokenPage(props: PageProps<"/register/resume/[token]">) {
  const { token } = await props.params;
  const valid = await peekEmailLinkToken(token);

  if (!valid) {
    return (
      <FlowShell>
        <StatusPanel tone="warning" title="This link has expired">
          <p>Recovery links work once and expire after 2 hours. Request a fresh link — you won&apos;t be charged again.</p>
          <Link href="/register/resume" className={primaryButton}>
            Get a new link
          </Link>
        </StatusPanel>
      </FlowShell>
    );
  }

  return (
    <FlowShell step={2}>
      <StatusPanel tone="success" title="Welcome back">
        <p>Your payment is verified. Continue to complete your registration form.</p>
        <form action={consumeRecoveryLinkAction}>
          <input type="hidden" name="token" value={token} />
          <button className={primaryButton}>Continue my registration</button>
        </form>
      </StatusPanel>
    </FlowShell>
  );
}
