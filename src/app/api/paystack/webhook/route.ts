import { NextResponse, type NextRequest } from "next/server";
import { isValidWebhookSignature } from "@/lib/paystack/client";
import { verifyAndApply } from "@/lib/services/payments";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/request";

export const dynamic = "force-dynamic";

/**
 * Paystack webhook. Configure in the Paystack dashboard as
 *   {APP_URL}/api/paystack/webhook
 *
 * - The signature is checked against the *raw* body before parsing.
 * - The event payload is never trusted for amounts/status: the reference is
 *   re-verified with Paystack's API (verifyAndApply), which is idempotent.
 * - Returns 500 on processing errors so Paystack retries; 200 otherwise.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!isValidWebhookSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (!(await rateLimit("webhook", ipFromHeaders(request.headers))).ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let event: { event?: unknown; data?: { reference?: unknown } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const reference = typeof event.data?.reference === "string" ? event.data.reference : null;
  const handled = event.event === "charge.success" || event.event === "refund.processed";
  if (!handled || !reference) return NextResponse.json({ received: true });

  try {
    const outcome = await verifyAndApply(reference, "WEBHOOK");
    if (outcome.kind === "unknown_reference") {
      // Not one of ours (e.g. another product on the same Paystack account).
      return NextResponse.json({ received: true, ignored: true });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] processing failed", (err as Error).message);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
