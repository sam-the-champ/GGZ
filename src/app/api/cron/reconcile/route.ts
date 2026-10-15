import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqualHex, sha256 } from "@/lib/crypto";
import { verifyAndApply } from "@/lib/services/payments";

export const dynamic = "force-dynamic";

/**
 * Optional safety net (see vercel.json). Re-verifies recent unsettled
 * checkouts with Flutterwave — e.g. a payment whose webhook was lost and whose
 * payer closed the browser — marks lapsed reservations EXPIRED, and purges
 * expired tokens/rate-limit rows. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = env().CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqualHex(sha256(auth), sha256(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const now = new Date();
  const candidates = await db.registrationAttempt.findMany({
    where: {
      paymentStatus: { in: ["PENDING", "INITIATED"] },
      createdAt: { gt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      authorizationUrl: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  let verified = 0;
  for (const a of candidates) {
    try {
      await verifyAndApply(a.paymentReference, "RECONCILE", { now });
      verified++;
    } catch (err) {
      console.error("[cron] verify failed", a.paymentReference, (err as Error).message);
    }
  }

  const [expired] = await Promise.all([
    db.registrationAttempt.updateMany({
      where: { reservationStatus: "ACTIVE", reservationExpiresAt: { lte: now }, paymentStatus: { not: "PAID" } },
      data: { reservationStatus: "EXPIRED" },
    }),
    db.continuationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.adminSession.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);

  return NextResponse.json({ verified, expiredReservations: expired.count });
}
