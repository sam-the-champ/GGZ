import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCapacitySnapshot, getEvent, lockAttempt, lockEvent, missingSetup } from "@/lib/services/event";
import { issueEmailLinkToken } from "@/lib/services/continuation";
import { verifyAndApply } from "@/lib/services/payments";
import { audit } from "@/lib/services/audit";
import { nairaInputToKobo } from "@/lib/money";
import type { AdminIdentity } from "@/lib/auth/session";
import type { Prisma } from "@/generated/prisma/client";

// ─── Dashboard statistics ───────────────────────────────────────────────────

export async function getDashboardStats(now = new Date()) {
  const event = await getEvent();
  if (!event) return null;
  const [snap, pending, failed, abandoned, mismatch, gross, reversed] = await Promise.all([
    getCapacitySnapshot(db, event, now),
    db.registrationAttempt.count({ where: { eventId: event.id, paymentStatus: "PENDING" } }),
    db.registrationAttempt.count({ where: { eventId: event.id, paymentStatus: "FAILED" } }),
    db.registrationAttempt.count({ where: { eventId: event.id, paymentStatus: "ABANDONED" } }),
    db.registrationAttempt.count({ where: { eventId: event.id, paymentStatus: "MISMATCH" } }),
    db.payment.aggregate({
      where: { attempt: { eventId: event.id }, status: { in: ["PAID", "REVERSED"] } },
      _sum: { paidAmountKobo: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { attempt: { eventId: event.id }, status: "REVERSED" },
      _sum: { paidAmountKobo: true },
      _count: true,
    }),
  ]);
  const grossKobo = gross._sum.paidAmountKobo ?? 0;
  const reversedKobo = reversed._sum.paidAmountKobo ?? 0;
  return {
    event,
    missingSetup: missingSetup(event),
    capacity: snap,
    pendingPayments: pending,
    failedPayments: failed,
    abandonedPayments: abandoned,
    mismatchedPayments: mismatch,
    grossVerifiedKobo: grossKobo,
    verifiedPaymentCount: gross._count,
    reversedKobo,
    reversedCount: reversed._count,
    netKobo: grossKobo - reversedKobo,
    overCommitted: snap.capacity != null && snap.committed > snap.capacity,
  };
}

// ─── Registration listing / search ──────────────────────────────────────────

export const LIST_FILTERS = [
  "all",
  "confirmed",
  "paid_incomplete",
  "overflow",
  "pending",
  "failed",
  "abandoned",
  "mismatch",
  "cancelled",
] as const;
export type ListFilter = (typeof LIST_FILTERS)[number];

const filterWhere: Record<ListFilter, Prisma.RegistrationAttemptWhereInput> = {
  all: {},
  confirmed: { registration: { is: { status: "CONFIRMED" } } },
  paid_incomplete: { paymentStatus: "PAID", reservationStatus: "HELD", registration: { is: null } },
  overflow: { reservationStatus: "OVERFLOW" },
  pending: { paymentStatus: { in: ["PENDING", "INITIATED"] } },
  failed: { paymentStatus: "FAILED" },
  abandoned: { paymentStatus: "ABANDONED" },
  mismatch: { paymentStatus: "MISMATCH" },
  cancelled: { registration: { is: { status: "CANCELLED" } } },
};

export const PAGE_SIZE = 25;

export function buildSearchWhere(eventId: string, q: string | undefined, filter: ListFilter) {
  const term = q?.trim().slice(0, 100);
  const search: Prisma.RegistrationAttemptWhereInput = term
    ? {
        OR: [
          { email: { contains: term, mode: "insensitive" } },
          { publicRef: { contains: term, mode: "insensitive" } },
          { paymentReference: { contains: term, mode: "insensitive" } },
          { registration: { is: { registrationNumber: { contains: term, mode: "insensitive" } } } },
          { registration: { is: { participant: { fullName: { contains: term, mode: "insensitive" } } } } },
          {
            registration: {
              is: { participant: { phone: { contains: term.replace(/[\s()-]/g, "") } } },
            },
          },
        ],
      }
    : {};
  return { AND: [{ eventId }, filterWhere[filter], search] } satisfies Prisma.RegistrationAttemptWhereInput;
}

export async function searchAttempts(params: { q?: string; filter?: string; page?: number }) {
  const filter: ListFilter = (LIST_FILTERS as readonly string[]).includes(params.filter ?? "")
    ? (params.filter as ListFilter)
    : "all";
  const event = await getEvent();
  if (!event) return { rows: [], total: 0, page: 1, pages: 1, filter };
  const where = buildSearchWhere(event.id, params.q, filter);
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const [total, rows] = await Promise.all([
    db.registrationAttempt.count({ where }),
    db.registrationAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        registration: {
          select: {
            registrationNumber: true,
            status: true,
            participant: { select: { fullName: true, phone: true } },
          },
        },
      },
    }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), filter };
}

export async function getAttemptDetail(id: string) {
  return db.registrationAttempt.findUnique({
    where: { id },
    include: {
      payment: true,
      registration: { include: { participant: true } },
      event: { select: { name: true, guardianConsentAge: true } },
    },
  });
}

export async function listPayments(params: { status?: string; page?: number }) {
  const statuses = ["PAID", "PENDING", "FAILED", "ABANDONED", "MISMATCH", "REVERSED"] as const;
  const status = statuses.find((s) => s === params.status);
  const where: Prisma.PaymentWhereInput = status ? { status } : {};
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const [total, rows] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy: { verifiedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { attempt: { select: { id: true, publicRef: true, email: true } } },
    }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), status: status ?? "all" };
}

// ─── CSV export ─────────────────────────────────────────────────────────────

/** Neutralises spreadsheet formula injection and quotes the cell. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function buildRegistrationsCsv(filter: ListFilter = "confirmed") {
  const event = await getEvent();
  if (!event) return "";
  const rows = await db.registrationAttempt.findMany({
    where: buildSearchWhere(event.id, undefined, filter),
    orderBy: { createdAt: "asc" },
    include: { payment: true, registration: { include: { participant: true } } },
  });
  const header = [
    "Registration number",
    "Registration status",
    "Full name",
    "Email",
    "Phone",
    "Date of birth",
    "City/State",
    "Emergency contact",
    "Emergency phone",
    "Guardian name",
    "Guardian phone",
    "Support needs",
    "Payment status",
    "Amount (NGN)",
    "Payment reference",
    "Paid at",
    "Confirmed at",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const a of rows) {
    const r = a.registration;
    const p = r?.participant;
    lines.push(
      [
        r?.registrationNumber,
        r?.status ?? (a.paymentStatus === "PAID" ? "PAID_INCOMPLETE" : ""),
        p?.fullName,
        a.email,
        p?.phone,
        p?.dateOfBirth.toISOString().slice(0, 10),
        p?.cityOrState,
        p?.emergencyContactName,
        p?.emergencyContactPhone,
        p?.guardianName,
        p?.guardianPhone,
        p?.supportNeeds,
        a.paymentStatus,
        (a.amountKobo / 100).toFixed(2),
        a.paymentReference,
        a.payment?.paidAt,
        r?.confirmedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

// ─── Settings ───────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  feeNaira: z.string().trim().max(20),
  capacity: z.string().trim().max(6),
  reservationMinutes: z.coerce.number().int().min(10).max(120),
  feeCovers: z.string().trim().max(1000),
  refundPolicy: z.string().trim().max(3000),
  minimumAge: z.string().trim().max(3),
  guardianConsentAge: z.coerce.number().int().min(13).max(21),
  registrationOpen: z.boolean(),
});

export type SettingsResult =
  | { ok: true; message: string }
  | { ok: false; errors: Record<string, string> };

export async function updateSettings(admin: AdminIdentity, input: z.input<typeof settingsSchema>): Promise<SettingsResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const d = parsed.data;
  const errors: Record<string, string> = {};

  let feeKobo: number | null = null;
  if (d.feeNaira) {
    feeKobo = nairaInputToKobo(d.feeNaira);
    if (feeKobo == null) errors.feeNaira = "Enter a positive amount in naira, e.g. 15000";
    else if (feeKobo < 100 * 100) errors.feeNaira = "The fee must be at least ₦100";
    else if (feeKobo > 10_000_000 * 100) errors.feeNaira = "That amount looks too large";
  }
  let capacity: number | null = null;
  if (d.capacity) {
    capacity = Number(d.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20000) {
      errors.capacity = "Capacity must be a whole number between 1 and 20,000";
    }
  }
  let minimumAge: number | null = null;
  if (d.minimumAge) {
    minimumAge = Number(d.minimumAge);
    if (!Number.isInteger(minimumAge) || minimumAge < 5 || minimumAge > 40) {
      errors.minimumAge = "Minimum age must be between 5 and 40";
    }
  }
  if (d.registrationOpen) {
    if (feeKobo == null) errors.registrationOpen = "Set the registration fee before opening registration";
    else if (capacity == null) errors.registrationOpen = "Set the capacity before opening registration";
    else if (!d.refundPolicy) errors.registrationOpen = "Publish a refund policy before opening registration";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const event = await getEvent();
  if (!event) return { ok: false, errors: { form: "Event record is missing — run the database seed" } };

  const next = {
    feeKobo,
    capacity,
    reservationMinutes: d.reservationMinutes,
    feeCovers: d.feeCovers || null,
    refundPolicy: d.refundPolicy || null,
    minimumAge,
    guardianConsentAge: d.guardianConsentAge,
    registrationOpen: d.registrationOpen,
  };

  const snapshot = await db.$transaction(async (tx) => {
    await lockEvent(tx, event.id);
    const before = await tx.event.findUniqueOrThrow({ where: { id: event.id } });
    await tx.event.update({ where: { id: event.id }, data: next });
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(next)) {
      const prev = before[k as keyof typeof before];
      if (prev !== v) changes[k] = { from: prev, to: v };
    }
    if (Object.keys(changes).length > 0) {
      await audit(tx, {
        actorId: admin.id,
        action: "settings.update",
        entityType: "Event",
        entityId: event.id,
        details: changes as Prisma.InputJsonValue,
      });
    }
    return getCapacitySnapshot(tx, { id: event.id, capacity }, new Date());
  });

  const warning =
    capacity != null && snapshot.committed > capacity
      ? ` Capacity (${capacity}) is below current commitments (${snapshot.committed}); new reservations are blocked until places free up or capacity is raised.`
      : "";
  return { ok: true, message: `Settings saved.${warning}` };
}

// ─── Audited registration actions ───────────────────────────────────────────

export async function reverifyAttempt(admin: AdminIdentity, attemptId: string) {
  const attempt = await db.registrationAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) return { ok: false as const, message: "Attempt not found" };
  const outcome = await verifyAndApply(attempt.paymentReference, "RECONCILE");
  const status = outcome.kind === "processed" ? outcome.attempt.paymentStatus : outcome.kind;
  await audit(db, {
    actorId: admin.id,
    action: "payment.reverify",
    entityType: "RegistrationAttempt",
    entityId: attemptId,
    details: { from: attempt.paymentStatus, result: status },
  });
  return { ok: true as const, message: `Paystack says: ${status}` };
}

/** Creates a one-time continuation link for organisers to share (e.g. WhatsApp). */
export async function issueRecoveryLink(admin: AdminIdentity, attemptId: string) {
  const attempt = await db.registrationAttempt.findUnique({
    where: { id: attemptId },
    include: { registration: { select: { id: true } } },
  });
  if (!attempt || attempt.paymentStatus !== "PAID" || attempt.reservationStatus !== "HELD" || attempt.registration) {
    return { ok: false as const, message: "Only paid, unfinished registrations can be recovered" };
  }
  const raw = await issueEmailLinkToken(db, attempt.id);
  await audit(db, {
    actorId: admin.id,
    action: "registration.recovery_link_issued",
    entityType: "RegistrationAttempt",
    entityId: attempt.id,
  });
  return { ok: true as const, url: `${env().APP_URL}/register/resume/${raw}` };
}

/** Gives an OVERFLOW (late-paid) attempt a place if capacity now allows. */
export async function allocateOverflowPlace(admin: AdminIdentity, attemptId: string) {
  return db.$transaction(async (tx) => {
    const a0 = await tx.registrationAttempt.findUnique({ where: { id: attemptId } });
    if (!a0) return { ok: false as const, message: "Attempt not found" };
    await lockEvent(tx, a0.eventId);
    await lockAttempt(tx, attemptId);
    const attempt = await tx.registrationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.reservationStatus !== "OVERFLOW" || attempt.paymentStatus !== "PAID") {
      return { ok: false as const, message: "This attempt is not waiting for a place" };
    }
    const event = await tx.event.findUniqueOrThrow({ where: { id: attempt.eventId } });
    const snap = await getCapacitySnapshot(tx, event);
    if (!snap.available) {
      return { ok: false as const, message: "No places available. Raise capacity first or arrange a refund." };
    }
    await tx.registrationAttempt.update({ where: { id: attemptId }, data: { reservationStatus: "HELD" } });
    await audit(tx, {
      actorId: admin.id,
      action: "registration.overflow_allocated",
      entityType: "RegistrationAttempt",
      entityId: attemptId,
    });
    return { ok: true as const, message: "Place allocated. Issue a recovery link so they can complete the form." };
  });
}

export async function cancelRegistration(admin: AdminIdentity, attemptId: string, reason: string) {
  const cleanReason = reason.trim().slice(0, 300);
  if (cleanReason.length < 3) return { ok: false as const, message: "Give a reason for cancelling" };
  return db.$transaction(async (tx) => {
    const a0 = await tx.registrationAttempt.findUnique({ where: { id: attemptId } });
    if (!a0) return { ok: false as const, message: "Attempt not found" };
    await lockEvent(tx, a0.eventId);
    await lockAttempt(tx, attemptId);
    const attempt = await tx.registrationAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { registration: true },
    });
    if (!attempt.registration || attempt.registration.status === "CANCELLED") {
      return { ok: false as const, message: "No active registration to cancel" };
    }
    await tx.registration.update({
      where: { id: attempt.registration.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    // Return the place to the pool.
    await tx.registrationAttempt.update({ where: { id: attemptId }, data: { reservationStatus: "RELEASED" } });
    await audit(tx, {
      actorId: admin.id,
      action: "registration.cancel",
      entityType: "Registration",
      entityId: attempt.registration.id,
      details: { reason: cleanReason, registrationNumber: attempt.registration.registrationNumber },
    });
    return {
      ok: true as const,
      message: "Registration cancelled and place released. Any refund must be processed in Paystack.",
    };
  });
}

/** Anonymises a participant's personal data on request (payment record retained). */
export async function eraseParticipant(admin: AdminIdentity, attemptId: string) {
  const attempt = await db.registrationAttempt.findUnique({
    where: { id: attemptId },
    include: { registration: true },
  });
  if (!attempt?.registration) return { ok: false as const, message: "No participant record" };
  const erasedEmail = `erased+${attempt.id}@invalid.local`;
  await db.$transaction(async (tx) => {
    await tx.participant.update({
      where: { id: attempt.registration!.participantId },
      data: {
        fullName: "[erased]",
        email: erasedEmail,
        phone: "",
        dateOfBirth: new Date("1900-01-01T00:00:00Z"),
        cityOrState: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        supportNeeds: null,
        guardianName: null,
        guardianPhone: null,
        guardianEmail: null,
        erasedAt: new Date(),
      },
    });
    await tx.registrationAttempt.update({ where: { id: attempt.id }, data: { email: erasedEmail } });
    await tx.payment.updateMany({ where: { attemptId: attempt.id }, data: { customerEmail: null } });
    await tx.continuationToken.deleteMany({ where: { attemptId: attempt.id } });
    await audit(tx, {
      actorId: admin.id,
      action: "participant.erase",
      entityType: "Registration",
      entityId: attempt.registration!.id,
    });
  });
  return { ok: true as const, message: "Personal data erased." };
}
