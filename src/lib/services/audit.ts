import "server-only";
import { db, type Tx } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function audit(
  client: Tx | typeof db,
  entry: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: Prisma.InputJsonValue;
  },
) {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      details: entry.details,
    },
  });
}
