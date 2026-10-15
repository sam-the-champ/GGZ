/**
 * Local mock of the Flutterwave v3 API for automated end-to-end tests ONLY.
 * No real money moves. The app accepts this base URL only when
 * FLUTTERWAVE_SECRET_KEY starts with FLWSECK_TEST- (see src/lib/flutterwave/client.ts).
 *
 * Implements: POST /v3/payments, GET /v3/transactions/verify_by_reference,
 * a hosted checkout page with Pay / Fail / Cancel buttons, and charge.completed
 * webhooks (with the `verif-hash` header) to {APP_URL}/api/flutterwave/webhook.
 */
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.MOCK_PAYMENTS_PORT ?? 4010);
const SECRET = process.env.FLUTTERWAVE_SECRET_KEY ?? "";
const WEBHOOK_HASH = process.env.FLUTTERWAVE_WEBHOOK_HASH ?? "";
const APP_URL = (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
if (!SECRET.startsWith("FLWSECK_TEST-")) {
  console.error("mock-flutterwave refuses to run without a FLWSECK_TEST- key");
  process.exit(1);
}

type Tx = {
  id: number;
  tx_ref: string;
  amount: number;
  currency: string;
  email: string;
  redirect_url: string;
  meta: Record<string, string>;
  /** null until the customer attempts payment — like Flutterwave. */
  status: "successful" | "failed" | null;
  created_at: string | null;
};
const byRef = new Map<string, Tx>();
const byCode = new Map<string, Tx>();
let nextId = 5_000_000;

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });
const authed = (req: IncomingMessage) => req.headers.authorization === `Bearer ${SECRET}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function redirectBack(res: ServerResponse, tx: Tx, status: string) {
  const u = new URL(tx.redirect_url);
  u.searchParams.set("status", status);
  u.searchParams.set("tx_ref", tx.tx_ref);
  if (status !== "cancelled") u.searchParams.set("transaction_id", String(tx.id));
  res.writeHead(302, { Location: u.toString() });
  res.end();
}

async function sendWebhook(tx: Tx) {
  try {
    await fetch(`${APP_URL}/api/flutterwave/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "verif-hash": WEBHOOK_HASH },
      body: JSON.stringify({
        event: "charge.completed",
        data: { id: tx.id, tx_ref: tx.tx_ref, amount: tx.amount, currency: tx.currency, status: tx.status },
      }),
    });
  } catch (e) {
    console.error("[mock-flutterwave] webhook delivery failed", (e as Error).message);
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });

  if (req.method === "POST" && url.pathname === "/v3/payments") {
    if (!authed(req)) return json(res, 401, { status: "error", message: "Invalid authorization key" });
    const input = JSON.parse(await readBody(req));
    if (byRef.has(input.tx_ref)) return json(res, 400, { status: "error", message: "Duplicate tx_ref" });
    const code = randomBytes(8).toString("hex");
    const tx: Tx = {
      id: nextId++,
      tx_ref: input.tx_ref,
      amount: Number(input.amount),
      currency: input.currency ?? "NGN",
      email: input.customer?.email,
      redirect_url: input.redirect_url,
      meta: input.meta ?? {},
      status: null,
      created_at: null,
    };
    byRef.set(tx.tx_ref, tx);
    byCode.set(code, tx);
    return json(res, 200, {
      status: "success",
      message: "Hosted Link",
      data: { link: `http://localhost:${PORT}/v3/hosted/pay/${code}` },
    });
  }

  if (req.method === "GET" && url.pathname === "/v3/transactions/verify_by_reference") {
    if (!authed(req)) return json(res, 401, { status: "error", message: "Invalid authorization key" });
    const tx = byRef.get(url.searchParams.get("tx_ref") ?? "");
    if (!tx || !tx.status) {
      return json(res, 400, { status: "error", message: "No transaction was found for this id", data: null });
    }
    return json(res, 200, {
      status: "success",
      message: "Transaction fetched successfully",
      data: {
        id: tx.id,
        tx_ref: tx.tx_ref,
        flw_ref: `FLW-MOCK-${tx.id}`,
        amount: tx.amount,
        currency: tx.currency,
        charged_amount: tx.amount,
        status: tx.status,
        payment_type: "card",
        processor_response: tx.status === "successful" ? "Approved" : "Declined",
        created_at: tx.created_at,
        customer: { email: tx.email },
        meta: tx.meta,
      },
    });
  }

  if (parts[0] === "v3" && parts[1] === "hosted" && parts[2] === "pay" && parts[3]) {
    const code = parts[3];
    const tx = byCode.get(code);
    if (!tx) return json(res, 404, { message: "Unknown checkout" });
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Mock Flutterwave checkout</title></head>
<body style="font-family:sans-serif;max-width:420px;margin:40px auto;padding:0 16px">
<p style="background:#ffc83d;padding:8px;border-radius:8px"><strong>TEST MODE</strong> — mock Flutterwave. No real payment.</p>
<h1>Pay ${esc(tx.currency)} ${tx.amount.toLocaleString("en-NG")}</h1><p>${esc(tx.email)}</p>
<form method="post" action="/v3/hosted/pay/${code}/pay"><button style="padding:12px 24px">Pay now</button></form><br>
<form method="post" action="/v3/hosted/pay/${code}/fail"><button>Simulate failed payment</button></form><br>
<form method="post" action="/v3/hosted/pay/${code}/cancel"><button>Cancel payment</button></form>
</body></html>`);
    }
    if (req.method === "POST") {
      const action = parts[4];
      if (action === "pay") {
        tx.status = "successful";
        tx.created_at = new Date().toISOString();
        await sendWebhook(tx);
        return redirectBack(res, tx, "successful");
      }
      if (action === "fail") {
        tx.status = "failed";
        tx.created_at = new Date().toISOString();
        return redirectBack(res, tx, "failed");
      }
      if (action === "cancel") return redirectBack(res, tx, "cancelled");
    }
  }

  json(res, 404, { status: "error", message: "Not found" });
}).listen(PORT, () => console.log(`[mock-flutterwave] listening on http://localhost:${PORT}`));
