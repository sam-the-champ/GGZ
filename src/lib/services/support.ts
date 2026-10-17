import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomCode } from "@/lib/crypto";
import { audit } from "@/lib/services/audit";
import { sendEmail } from "@/lib/email/send";
import { newTicketAlertEmail, ticketReceivedEmail, ticketReplyEmail } from "@/lib/email/templates";
import { categoryLabel, RESPONSE_WINDOW } from "@/content/help";
import { helpRequestSchema, ticketReplySchema } from "@/lib/validation/registration";
import type { AdminIdentity } from "@/lib/auth/session";
import type { Prisma, TicketStatus } from "@/generated/prisma/client";

export const RESPONSE_TARGET_HOURS = 24;
export const RESPONSE_DEADLINE_HOURS = 48;

export function newTicketReference() {
  return `HC-${randomCode(6)}`;
}

export type CreateTicketResult =
  | { kind: "created"; reference: string; emailSent: boolean }
  | { kind: "invalid"; fieldErrors: Record<string, string> };

/** Submits a Help Center request from the public site. */
export async function createTicket(rawInput: unknown): Promise<CreateTicketResult> {
  const parsed = helpRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { kind: "invalid", fieldErrors };
  }
  const d = parsed.data;

  // Link to a registration attempt when the reference or email matches, so
  // organisers see the payment/registration next to the request.
  const ref = d.registrationRef?.trim();
  const attempt =
    (ref
      ? await db.registrationAttempt.findFirst({
          where: {
            OR: [
              { publicRef: { equals: ref, mode: "insensitive" } },
              { paymentReference: ref },
              { registration: { is: { registrationNumber: { equals: ref, mode: "insensitive" } } } },
            ],
          },
          select: { id: true },
        })
      : null) ??
    (await db.registrationAttempt.findFirst({
      where: { email: d.email, paymentStatus: "PAID" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })) ??
    (await db.registrationAttempt.findFirst({
      where: { email: d.email },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }));

  let reference = newTicketReference();
  while (await db.supportTicket.findUnique({ where: { reference } })) reference = newTicketReference();

  const ticket = await db.supportTicket.create({
    data: {
      reference,
      name: d.name,
      email: d.email,
      phone: d.phone ?? null,
      category: d.category,
      message: d.message,
      registrationRef: ref || null,
      attemptId: attempt?.id ?? null,
      messages: { create: { channel: "WEB", body: d.message } },
    },
  });

  const label = categoryLabel(ticket.category);
  const ack = await sendEmail(
    ticketReceivedEmail({
      to: ticket.email,
      name: ticket.name,
      reference: ticket.reference,
      categoryLabel: label,
      message: ticket.message,
      responseWindow: RESPONSE_WINDOW,
    }),
  );
  const notifyTo = env().HELPDESK_NOTIFY_EMAIL ?? env().SMTP_USER;
  if (notifyTo) {
    await sendEmail(
      newTicketAlertEmail({
        to: notifyTo,
        reference: ticket.reference,
        name: ticket.name,
        categoryLabel: label,
        adminUrl: `${env().APP_URL}/admin/help/${ticket.id}`,
      }),
    );
  }
  return { kind: "created", reference: ticket.reference, emailSent: ack.sent };
}

// ─── Admin: listing ─────────────────────────────────────────────────────────

export const TICKET_FILTERS = ["open", "in_progress", "resolved", "closed", "all"] as const;
export type TicketFilter = (typeof TICKET_FILTERS)[number];

const filterWhere: Record<TicketFilter, Prisma.SupportTicketWhereInput> = {
  open: { status: "OPEN" },
  in_progress: { status: "IN_PROGRESS" },
  resolved: { status: "RESOLVED" },
  closed: { status: "CLOSED" },
  all: {},
};

export const TICKET_PAGE_SIZE = 25;

export async function listTickets(params: { filter?: string; q?: string; page?: number }) {
  const filter: TicketFilter = (TICKET_FILTERS as readonly string[]).includes(params.filter ?? "")
    ? (params.filter as TicketFilter)
    : "open";
  const term = params.q?.trim().slice(0, 100);
  const where: Prisma.SupportTicketWhereInput = {
    AND: [
      filterWhere[filter],
      term
        ? {
            OR: [
              { reference: { contains: term, mode: "insensitive" } },
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { phone: { contains: term.replace(/[\s()-]/g, "") } },
              { registrationRef: { contains: term, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const [total, rows] = await Promise.all([
    db.supportTicket.count({ where }),
    db.supportTicket.findMany({
      where,
      // Oldest unanswered first, so nothing waits too long.
      orderBy: filter === "open" ? { createdAt: "asc" } : { updatedAt: "desc" },
      skip: (page - 1) * TICKET_PAGE_SIZE,
      take: TICKET_PAGE_SIZE,
    }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / TICKET_PAGE_SIZE)), filter };
}

/** Counts for the dashboard and nav badge. Overdue = open longer than 24 h with no response. */
export async function ticketCounts(now = new Date()) {
  const target = new Date(now.getTime() - RESPONSE_TARGET_HOURS * 3600_000);
  const deadline = new Date(now.getTime() - RESPONSE_DEADLINE_HOURS * 3600_000);
  const [open, inProgress, overdue, breached] = await Promise.all([
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
    db.supportTicket.count({ where: { status: "OPEN", firstResponseAt: null, createdAt: { lt: target } } }),
    db.supportTicket.count({ where: { status: "OPEN", firstResponseAt: null, createdAt: { lt: deadline } } }),
  ]);
  return { open, inProgress, overdue, breached };
}

export function waitingHours(ticket: { createdAt: Date; firstResponseAt: Date | null }, now = new Date()) {
  const end = ticket.firstResponseAt ?? now;
  return Math.floor((end.getTime() - ticket.createdAt.getTime()) / 3600_000);
}

export async function getTicket(id: string) {
  return db.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      attempt: {
        select: {
          id: true,
          publicRef: true,
          paymentStatus: true,
          reservationStatus: true,
          registration: { select: { registrationNumber: true, status: true } },
        },
      },
    },
  });
}

// ─── Admin: responding ──────────────────────────────────────────────────────

export type ReplyResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Records an organiser response. EMAIL sends the reply to the person; PHONE
 * and WHATSAPP log a conversation that happened outside the site; NOTE is
 * internal only. Any non-note response counts as the first response.
 */
export async function respondToTicket(admin: AdminIdentity, ticketId: string, input: unknown, now = new Date()): Promise<ReplyResult> {
  const parsed = ticketReplySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const { channel, body, status } = parsed.data;
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false, message: "Request not found." };

  let emailSent = false;
  if (channel === "EMAIL") {
    const res = await sendEmail(ticketReplyEmail({ to: ticket.email, name: ticket.name, reference: ticket.reference, body }));
    if (!res.sent) return { ok: false, message: `Email not sent: ${res.error ?? "email is not configured"}. Nothing was saved.` };
    emailSent = true;
  }

  const isResponse = channel !== "NOTE";
  const nextStatus: TicketStatus = status ?? (isResponse && ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status);

  await db.$transaction(async (tx) => {
    await tx.supportMessage.create({ data: { ticketId, channel, authorId: admin.id, body, emailSent } });
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: nextStatus,
        firstResponseAt: ticket.firstResponseAt ?? (isResponse ? now : null),
        resolvedAt: nextStatus === "RESOLVED" ? (ticket.resolvedAt ?? now) : nextStatus === "OPEN" || nextStatus === "IN_PROGRESS" ? null : ticket.resolvedAt,
      },
    });
    await audit(tx, {
      actorId: admin.id,
      action: `support.${channel.toLowerCase()}`,
      entityType: "SupportTicket",
      entityId: ticketId,
      details: { status: nextStatus },
    });
  });

  const done = { EMAIL: "Reply emailed", PHONE: "Phone call logged", WHATSAPP: "WhatsApp conversation logged", NOTE: "Note added" }[channel];
  return { ok: true, message: `${done}.` };
}

export async function setTicketStatus(admin: AdminIdentity, ticketId: string, status: TicketStatus, now = new Date()) {
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { ok: false as const, message: "Request not found." };
  await db.supportTicket.update({
    where: { id: ticketId },
    data: { status, resolvedAt: status === "RESOLVED" ? (ticket.resolvedAt ?? now) : status === "CLOSED" ? ticket.resolvedAt : null },
  });
  await audit(db, {
    actorId: admin.id,
    action: "support.status",
    entityType: "SupportTicket",
    entityId: ticketId,
    details: { from: ticket.status, to: status },
  });
  return { ok: true as const, message: `Marked as ${status.replace("_", " ").toLowerCase()}.` };
}

/** Normalises a Nigerian/international number to digits for wa.me links. */
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^0[789][01]\d{8}$/.test(digits)) return `234${digits.slice(1)}`;
  if (/^234[789][01]\d{8}$/.test(digits)) return digits;
  if (/^[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}
