import type { VerifiedTransaction } from "@/lib/paystack/client";

/**
 * In-memory stand-in for Paystack's API, installed with vi.mock in each test
 * file. Tests decide what Paystack "reports" for each reference.
 */
type Tx = { reference: string; amountKobo: number; currency: string; email: string; attemptId: string; status: string };

export const fakePaystack = {
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
  setStatus(reference: string, status: string, patch: Partial<Tx> = {}) {
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
  metadata: Record<string, string>;
}) {
  fakePaystack.initializeCalls++;
  if (fakePaystack.failInitialize) throw new Error("Paystack unavailable");
  fakePaystack.txs.set(input.reference, {
    reference: input.reference,
    amountKobo: input.amountKobo,
    currency: input.currency,
    email: input.email,
    attemptId: input.metadata.attempt_id!,
    status: "abandoned",
  });
  return { authorizationUrl: `https://checkout.paystack.test/${input.reference}`, accessCode: `ac_${input.reference}` };
}

export async function fakeVerify(reference: string): Promise<VerifiedTransaction | null> {
  fakePaystack.verifyCalls++;
  const tx = fakePaystack.txs.get(reference);
  if (!tx) return null;
  return {
    providerId: `trx_${reference}`,
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
