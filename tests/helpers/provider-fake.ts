import type { NormalisedStatus, VerifiedTransaction } from "@/lib/flutterwave/client";

/**
 * In-memory stand-in for Flutterwave's API, installed with vi.mock in each
 * test file. Tests decide what the provider "reports" for each reference.
 */
type Tx = {
  reference: string;
  amountKobo: number;
  currency: string;
  email: string;
  attemptId: string;
  status: NormalisedStatus | "not_attempted";
};

export const fakeProvider = {
  txs: new Map<string, Tx>(),
  initializeCalls: 0,
  verifyCalls: 0,
  failInitialize: false,
  reset() {
    this.txs.clear();
    this.initializeCalls = 0;
    this.verifyCalls = 0;
    this.failInitialize = false;
  },
  /** Simulate the customer finishing checkout with a given outcome. */
  setStatus(reference: string, status: NormalisedStatus, patch: Partial<Tx> = {}) {
    const tx = this.txs.get(reference);
    if (!tx) throw new Error(`no fake tx ${reference}`);
    Object.assign(tx, { status, ...patch });
  },
};

export async function fakeInitialize(input: {
  email: string;
  amountKobo: number;
  currency: string;
  reference: string;
  meta: Record<string, string>;
}) {
  fakeProvider.initializeCalls++;
  if (fakeProvider.failInitialize) throw new Error("Flutterwave unavailable");
  fakeProvider.txs.set(input.reference, {
    reference: input.reference,
    amountKobo: input.amountKobo,
    currency: input.currency,
    email: input.email,
    attemptId: input.meta.attempt_id!,
    status: "not_attempted",
  });
  return { authorizationUrl: `https://checkout.flutterwave.com/v3/hosted/pay/${input.reference}` };
}

/** Like Flutterwave: no transaction exists until the customer attempts payment. */
export async function fakeVerify(reference: string): Promise<VerifiedTransaction | null> {
  fakeProvider.verifyCalls++;
  const tx = fakeProvider.txs.get(reference);
  if (!tx || tx.status === "not_attempted") return null;
  return {
    providerId: `${100000 + fakeProvider.verifyCalls}`,
    status: tx.status,
    reference: tx.reference,
    amountKobo: tx.amountKobo,
    currency: tx.currency,
    channel: "card",
    gatewayResponse: tx.status === "success" ? "Approved" : "Declined",
    paidAt: tx.status === "success" ? new Date() : null,
    customerEmail: tx.email,
    metadataAttemptId: tx.attemptId,
  };
}
