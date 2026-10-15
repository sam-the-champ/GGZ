import "server-only";
import { db, type Tx } from "@/lib/db";
import { EVENT_SLUG } from "@/content/site";
import { paymentsConfigured } from "@/lib/env";
import type { Event } from "@/generated/prisma/client";

export async function getEvent(client: Tx | typeof db = db): Promise<Event | null> {
  return client.event.findUnique({ where: { slug: EVENT_SLUG } });
}

/** Settings that must be confirmed by organisers before payments can open. */
export function missingSetup(event: Event): string[] {
  const missing: string[] = [];
  if (event.feeKobo == null || event.feeKobo <= 0) missing.push("registration fee");
  if (event.capacity == null || event.capacity <= 0) missing.push("capacity");
  if (!event.refundPolicy?.trim()) missing.push("refund policy");
  return missing;
}

export type CapacitySnapshot = {
  capacity: number | null;
  /** Paid attempts holding a place (confirmed + paid-but-incomplete). */
  held: number;
  /** Unpaid checkouts whose reservation has not yet expired. */
  activeReservations: number;
  confirmed: number;
  paidIncomplete: number;
  overflow: number;
  committed: number;
  available: number | null;
};

/**
 * Counts places from the database. Reservations whose expiry time has passed
 * are ignored even if their row has not been swept yet, so expiry needs no
 * background job.
 */
export async function getCapacitySnapshot(
  client: Tx | typeof db,
  event: Pick<Event, "id" | "capacity">,
  now = new Date(),
  excludeAttemptId?: string,
): Promise<CapacitySnapshot> {
  const notSelf = excludeAttemptId ? { id: { not: excludeAttemptId } } : {};
  // Sequential on purpose: inside a transaction all queries share one connection.
  const [held, activeReservations, confirmed, paidIncomplete, overflow] = await sequence([
    () => client.registrationAttempt.count({
      where: { eventId: event.id, reservationStatus: "HELD", ...notSelf },
    }),
    () => client.registrationAttempt.count({
      where: {
        eventId: event.id,
        reservationStatus: "ACTIVE",
        reservationExpiresAt: { gt: now },
        ...notSelf,
      },
    }),
    () => client.registration.count({ where: { eventId: event.id, status: "CONFIRMED" } }),
    () => client.registrationAttempt.count({
      where: {
        eventId: event.id,
        reservationStatus: "HELD",
        paymentStatus: "PAID",
        registration: { is: null },
      },
    }),
    () => client.registrationAttempt.count({
      where: { eventId: event.id, reservationStatus: "OVERFLOW" },
    }),
  ]);
  const committed = held + activeReservations;
  return {
    capacity: event.capacity,
    held,
    activeReservations,
    confirmed,
    paidIncomplete,
    overflow,
    committed,
    available: event.capacity == null ? null : Math.max(0, event.capacity - committed),
  };
}

/**
 * Locks the event row for the rest of the transaction. Every code path that
 * creates, converts or releases a place takes this lock first (then the
 * attempt row), so capacity decisions are serialised and lock order is fixed.
 */
export async function lockEvent(tx: Tx, eventId: string) {
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
}

export async function lockAttempt(tx: Tx, attemptId: string) {
  await tx.$queryRaw`SELECT id FROM "RegistrationAttempt" WHERE id = ${attemptId} FOR UPDATE`;
}

export type PublicAvailability =
  | { state: "open"; feeKobo: number; currency: string; spacesLeft: number }
  | { state: "full" }
  | { state: "closed" }
  | { state: "not_configured" };

export type PublicEventInfo = {
  availability: PublicAvailability;
  feeKobo: number | null;
  feeCovers: string | null;
  refundPolicy: string | null;
  minimumAge: number | null;
  guardianConsentAge: number;
};

/** Public-safe registration state for the landing and register pages. */
export async function getPublicEventInfo(now = new Date()): Promise<PublicEventInfo> {
  const event = await getEvent();
  if (!event) {
    return {
      availability: { state: "not_configured" },
      feeKobo: null,
      feeCovers: null,
      refundPolicy: null,
      minimumAge: null,
      guardianConsentAge: 18,
    };
  }
  const base = {
    feeKobo: event.feeKobo,
    feeCovers: event.feeCovers,
    refundPolicy: event.refundPolicy,
    minimumAge: event.minimumAge,
    guardianConsentAge: event.guardianConsentAge,
  };
  // Never show a payment button that cannot work.
  if (missingSetup(event).length > 0 || !paymentsConfigured()) {
    return { ...base, availability: { state: "not_configured" } };
  }
  if (!event.registrationOpen) return { ...base, availability: { state: "closed" } };
  const snap = await getCapacitySnapshot(db, event, now);
  if (!snap.available) return { ...base, availability: { state: "full" } };
  return {
    ...base,
    availability: {
      state: "open",
      feeKobo: event.feeKobo!,
      currency: event.currency,
      spacesLeft: snap.available,
    },
  };
}

async function sequence<T extends readonly (() => Promise<unknown>)[]>(fns: T) {
  const out: unknown[] = [];
  for (const fn of fns) out.push(await fn());
  return out as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
}
