import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());
const ip = vi.hoisted(() => ({ value: "198.51.100.7" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string) => void jar.delete(n),
  }),
  headers: async () => new Headers({ "x-forwarded-for": ip.value }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/flutterwave/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/flutterwave/client")>();
  const fake = await import("../helpers/provider-fake");
  return { ...actual, initializeTransaction: fake.fakeInitialize, verifyTransaction: fake.fakeVerify };
});

import { db } from "@/lib/db";
import { submitHelpRequestAction } from "@/app/help/actions";
import {
  createTicket,
  respondToTicket,
  setTicketStatus,
  ticketCounts,
  listTickets,
  whatsappNumber,
} from "@/lib/services/support";
import { initiateRegistration } from "@/lib/services/attempts";
import { verifyAndApply } from "@/lib/services/payments";
import { submitRegistration } from "@/lib/services/registrations";
import { fakeProvider } from "../helpers/provider-fake";
import { resetDb, seedEvent, validForm } from "../helpers/db";

const request = {
  name: "Ada Okafor",
  email: "ada@example.com",
  phone: "0803 123 4567",
  category: "PAID_NOT_CONFIRMED",
  registrationRef: "",
  message: "I paid this morning but the page closed before I filled the form.",
};

let admin = { id: "", email: "admin@example.com", name: "Admin", role: "ADMIN" as const };

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(async () => {
  await resetDb();
  fakeProvider.reset();
  jar.clear();
  ip.value = `198.51.100.${Math.floor(Math.random() * 200)}`;
  await seedEvent({ capacity: 10 });
  const u = await db.adminUser.create({ data: { email: admin.email, name: "Admin", passwordHash: "x", role: "ADMIN" } });
  admin = { ...admin, id: u.id };
});

describe("submitting a request", () => {
  it("creates a ticket with a reference and the first message", async () => {
    const res = await createTicket(request);
    expect(res.kind).toBe("created");
    if (res.kind !== "created") return;
    expect(res.reference).toMatch(/^HC-[A-Z2-9]{6}$/);
    expect(res.emailSent).toBe(false); // email not configured in tests
    const t = await db.supportTicket.findUniqueOrThrow({ where: { reference: res.reference }, include: { messages: true } });
    expect(t).toMatchObject({ status: "OPEN", phone: "08031234567", category: "PAID_NOT_CONFIRMED" });
    expect(t.messages).toHaveLength(1);
    expect(t.messages[0]!.channel).toBe("WEB");
  });

  it("validates input", async () => {
    const res = await createTicket({ ...request, email: "nope", message: "short", category: "NOT_A_TOPIC" });
    expect(res.kind).toBe("invalid");
    if (res.kind === "invalid") expect(Object.keys(res.fieldErrors)).toEqual(expect.arrayContaining(["email", "message", "category"]));
    expect(await db.supportTicket.count()).toBe(0);
  });

  it("links the request to the person's paid registration", async () => {
    const r = await initiateRegistration({ email: "ada@example.com" });
    if (r.kind !== "checkout") throw new Error();
    const a = await db.registrationAttempt.findUniqueOrThrow({ where: { id: r.attemptId } });
    fakeProvider.setStatus(a.paymentReference, "success");
    await verifyAndApply(a.paymentReference, "WEBHOOK");
    await submitRegistration(a.id, validForm);
    const reg = await db.registration.findFirstOrThrow();

    // by email
    const byEmail = await createTicket(request);
    // by registration number, with a different email
    const byRef = await createTicket({ ...request, email: "parent@example.com", registrationRef: reg.registrationNumber.toLowerCase() });
    const tickets = await db.supportTicket.findMany();
    expect(tickets.every((t) => t.attemptId === a.id)).toBe(true);
    expect(byEmail.kind === "created" && byRef.kind === "created").toBe(true);
  });

  it("the public action rate-limits and silently drops honeypot bots", async () => {
    const bot = await submitHelpRequestAction({}, form({ ...request, website: "http://spam" }));
    expect(bot.done).toBeTruthy();
    expect(await db.supportTicket.count()).toBe(0);

    for (let i = 0; i < 5; i++) {
      const ok = await submitHelpRequestAction({}, form({ ...request, email: `p${i}@example.com` }));
      expect(ok.done?.reference).toMatch(/^HC-/);
    }
    const limited = await submitHelpRequestAction({}, form({ ...request, email: "p9@example.com" }));
    expect(limited.error).toMatch(/several requests/);
    expect(limited.values?.message).toBe(request.message); // nothing typed is lost
    expect(await db.supportTicket.count()).toBe(5);
  });
});

describe("responding in the help desk", () => {
  async function ticket() {
    const res = await createTicket(request);
    if (res.kind !== "created") throw new Error();
    return db.supportTicket.findUniqueOrThrow({ where: { reference: res.reference } });
  }

  it("an email reply fails cleanly when email isn't configured and saves nothing", async () => {
    const t = await ticket();
    const res = await respondToTicket(admin, t.id, { channel: "EMAIL", body: "Hello Ada, sorting this now." });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/Nothing was saved/);
    expect(await db.supportMessage.count({ where: { ticketId: t.id } })).toBe(1);
  });

  it("logging a call counts as the first response and moves it to in progress", async () => {
    const t = await ticket();
    const res = await respondToTicket(admin, t.id, { channel: "PHONE", body: "Called Ada, sent recovery link by WhatsApp." });
    expect(res.ok).toBe(true);
    const after = await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.status).toBe("IN_PROGRESS");
    expect(after.firstResponseAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "support.phone" } })).toBe(1);
  });

  it("internal notes don't count as a response", async () => {
    const t = await ticket();
    await respondToTicket(admin, t.id, { channel: "NOTE", body: "Checking Flutterwave first." });
    const after = await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.status).toBe("OPEN");
    expect(after.firstResponseAt).toBeNull();
  });

  it("can resolve and reopen", async () => {
    const t = await ticket();
    await respondToTicket(admin, t.id, { channel: "WHATSAPP", body: "Resolved on WhatsApp.", status: "RESOLVED" });
    let after = await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.status).toBe("RESOLVED");
    expect(after.resolvedAt).not.toBeNull();
    await setTicketStatus(admin, t.id, "OPEN");
    after = await db.supportTicket.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.status).toBe("OPEN");
    expect(after.resolvedAt).toBeNull();
  });

  it("counts requests waiting more than 24 and 48 hours", async () => {
    const a = await ticket();
    const b = await ticket();
    await ticket();
    await db.supportTicket.update({ where: { id: a.id }, data: { createdAt: new Date(Date.now() - 30 * 3600_000) } });
    await db.supportTicket.update({ where: { id: b.id }, data: { createdAt: new Date(Date.now() - 50 * 3600_000) } });
    expect(await ticketCounts()).toMatchObject({ open: 3, overdue: 2, breached: 1 });
    const list = await listTickets({ filter: "open" });
    expect(list.rows[0]!.id).toBe(b.id); // oldest first
  });
});

describe("WhatsApp numbers", () => {
  it("normalises Nigerian numbers for wa.me", () => {
    expect(whatsappNumber("08031234567")).toBe("2348031234567");
    expect(whatsappNumber("+2348031234567")).toBe("2348031234567");
    expect(whatsappNumber("0803 123 4567")).toBe("2348031234567");
    expect(whatsappNumber("12")).toBeNull();
  });
});
