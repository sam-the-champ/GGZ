import { NextResponse, type NextRequest } from "next/server";
import { isValidWebhookHash } from "@/lib/flutterwave/client";
import { verifyAndApply } from "@/lib/services/payments";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/request";

export const dynamic = "force-dynamic";

/**
 * Flutterwave webhook. In the Flutterwave dashboard (Settings → Webhooks) set
 *   URL:          {APP_URL}/api/flutterwave/webhook
 *   Secret hash:  the value of FLUTTERWAVE_WEBHOOK_HASH
 *
 * - The `verif-hash` header must equal the secret hash (constant-time check).
 * - The payload is never trusted for amount/status: the tx_ref is re-verified
 *   with Flutterwave's API (verifyAndApply), which is idempotent.
 * - Returns 500 on processing errors so Flutterwave retries; 200 otherwise.
 */
export async function POST(request: NextRequest) {
  if (!isValidWebhookHash(request.headers.get("verif-hash"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (!(await rateLimit("webhook", ipFromHeaders(request.headers))).ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  let payload: { event?: unknown; "event.type"?: unknown; data?: { tx_ref?: unknown; txRef?: unknown } };
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const reference =
    typeof payload.data?.tx_ref === "string"
      ? payload.data.tx_ref
      : typeof payload.data?.txRef === "string"
        ? payload.data.txRef
        : null;
  const isCharge = payload.event === "charge.completed" || payload["event.type"] === "CARD_TRANSACTION";
  if (!isCharge || !reference) return NextResponse.json({ received: true });

  try {
    const outcome = await verifyAndApply(reference, "WEBHOOK");
    if (outcome.kind === "unknown_reference") {
      // Not one of ours (e.g. another product on the same Flutterwave account).
      return NextResponse.json({ received: true, ignored: true });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] processing failed", (err as Error).message);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
