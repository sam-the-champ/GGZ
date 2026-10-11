import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAdmin } from "@/lib/auth/session";
import { buildRegistrationsCsv, LIST_FILTERS, type ListFilter } from "@/lib/services/admin";
import { audit } from "@/lib/services/audit";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Authorised, audited CSV export. Values are protected against formula injection. */
export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin("VIEWER");
  } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    throw err;
  }
  if (!(await rateLimit("adminSensitive", admin.id)).ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const raw = request.nextUrl.searchParams.get("filter") ?? "confirmed";
  const filter: ListFilter = (LIST_FILTERS as readonly string[]).includes(raw) ? (raw as ListFilter) : "confirmed";
  const csv = await buildRegistrationsCsv(filter);
  await audit(db, { actorId: admin.id, action: "registrations.export", entityType: "Registration", details: { filter } });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ggz-camp-${filter}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
