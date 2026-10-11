/**
 * Local mock of the Paystack API for automated end-to-end tests ONLY.
 * No real money moves. The app accepts this base URL only when
 * PAYSTACK_SECRET_KEY starts with sk_test_ (see src/lib/paystack/client.ts).
 *
 *   MOCK_PAYSTACK_PORT=4010 PAYSTACK_SECRET_KEY=sk_test_e2e APP_URL=http://localhost:3100 tsx scripts/mock-paystack.ts
 *
 * Implements: POST /transaction/initialize, GET /transaction/verify/:ref,
 * a hosted "checkout" page with Pay / Fail / Cancel buttons, and signed
 * charge.success webhooks to {APP_URL}/api/paystack/webhook.
 */
import { createHmac, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.MOCK_PAYSTACK_PORT ?? 4010);
const SECRET = process.env.PAYSTACK_SECRET_KEY ?? "";
const APP_URL = (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
if (!SECRET.startsWith("sk_test_")) {
  console.error("mock-paystack refuses to run without a sk_test_ key");
  process.exit(1);
}

type Tx = {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  email: string;
  callback_url: string;
  metadata: Record<string, string>;
  status: "abandoned" | "success" | "failed";
  paid_at: string | null;
};
const byRef = new Map<string, Tx>();
const byCode = new Map<string, Tx>();
let nextId = 1000;

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const body = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });
const authed = (req: IncomingMessage) => req.headers.authorization === `Bearer ${SECRET}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

async function sendWebhook(tx: Tx) {
  const payload = JSON.stringify({
    event: "charge.success",
    data: { id: tx.id, reference: tx.reference, amount: tx.amount, currency: tx.currency, status: "success" },
  });
  const signature = createHmac("sha512", SECRET).update(payload).digest("hex");
  try {
    await fetch(`${APP_URL}/api/paystack/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
      body: payload,
    });
  } catch (e) {
    console.error("[mock-paystack] webhook delivery failed", (e as Error).message);
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });

  if (req.method === "POST" && url.pathname === "/transaction/initialize") {
    if (!authed(req)) return json(res, 401, { status: false, message: "Invalid key" });
    const input = JSON.parse(await body(req));
    if (byRef.has(input.reference)) return json(res, 400, { status: false, message: "Duplicate Transaction Reference" });
    const code = randomBytes(8).toString("hex");
    const tx: Tx = {
      id: nextId++,
      reference: input.reference,
      amount: Number(input.amount),
      currency: input.currency ?? "NGN",
      email: input.email,
      callback_url: input.callback_url,
      metadata: input.metadata ?? {},
      status: "abandoned",
      paid_at: null,
    };
    byRef.set(tx.reference, tx);
    byCode.set(code, tx);
    return json(res, 200, {
      status: true,
      message: "Authorization URL created",
      data: { authorization_url: `http://localhost:${PORT}/checkout/${code}`, access_code: code, reference: tx.reference },
    });
  }

  if (req.method === "GET" && parts[0] === "transaction" && parts[1] === "verify" && parts[2]) {
    if (!authed(req)) return json(res, 401, { status: false, message: "Invalid key" });
    const tx = byRef.get(decodeURIComponent(parts[2]));
    if (!tx) return json(res, 404, { status: false, message: "Transaction reference not found" });
    return json(res, 200, {
      status: true,
      message: "Verification successful",
      data: {
        id: tx.id,
        status: tx.status,
        reference: tx.reference,
        amount: tx.amount,
        currency: tx.currency,
        channel: "card",
        gateway_response: tx.status === "success" ? "Successful" : "Declined",
        paid_at: tx.paid_at,
        customer: { email: tx.email },
        metadata: tx.metadata,
      },
    });
  }

  if (parts[0] === "checkout" && parts[1]) {
    const tx = byCode.get(parts[1]);
    if (!tx) return json(res, 404, { message: "Unknown checkout" });
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Mock Paystack checkout</title></head>
<body style="font-family:sans-serif;max-width:420px;margin:40px auto;padding:0 16px">
<p style="background:#ffc83d;padding:8px;border-radius:8px"><strong>TEST MODE</strong> — mock Paystack. No real payment.</p>
<h1>Pay NGN ${(tx.amount / 100).toFixed(2)}</h1><p>${esc(tx.email)}</p>
<form method="post" action="/checkout/${parts[1]}/pay"><button style="padding:12px 24px">Pay now</button></form><br>
<form method="post" action="/checkout/${parts[1]}/fail"><button>Simulate failed payment</button></form><br>
<form method="post" action="/checkout/${parts[1]}/cancel"><button>Cancel payment</button></form>
</body></html>`);
    }
    if (req.method === "POST") {
      const action = parts[2];
      if (action === "pay") {
        tx.status = "success";
        tx.paid_at = new Date().toISOString();
        await sendWebhook(tx);
      } else if (action === "fail") {
        tx.status = "failed";
      } else if (action === "cancel") {
        res.writeHead(302, { Location: tx.metadata.cancel_action ?? tx.callback_url });
        return res.end();
      }
      const cb = new URL(tx.callback_url);
      cb.searchParams.set("trxref", tx.reference);
      cb.searchParams.set("reference", tx.reference);
      res.writeHead(302, { Location: cb.toString() });
      return res.end();
    }
  }

  json(res, 404, { status: false, message: "Not found" });
}).listen(PORT, () => console.log(`[mock-paystack] listening on http://localhost:${PORT}`));
