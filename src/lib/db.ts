import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { normaliseEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * node-postgres currently treats sslmode=prefer/require/verify-ca as
 * verify-full (certificate + hostname checked) and warns that a future major
 * version will weaken them to libpq semantics. Ask for verify-full explicitly:
 * identical security today, no warning, and no silent downgrade later.
 */
export function withStrictSsl(connectionString: string): string {
  return connectionString.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/i, "$1verify-full");
}

function createClient() {
  const raw = normaliseEnv(process.env).DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString: withStrictSsl(raw) });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const client = createClient();
  // Reuse one client per server process (and across dev hot reloads).
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Single shared Prisma client, created on first use rather than at import
 * time, so a build without DATABASE_URL can still render pages that fall
 * back gracefully instead of crashing on module load.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
