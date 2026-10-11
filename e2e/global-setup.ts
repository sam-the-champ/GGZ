import { execSync } from "node:child_process";
import pg from "pg";

export const E2E_ADMIN = { email: "e2e-admin@example.com", password: "e2e-Password-123456" };

/** Fresh ggz_e2e database: migrate, configure an open event, create an admin. */
export default async function globalSetup() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!url.pathname.includes("e2e")) throw new Error("Refusing to reset a non-e2e database");
  const admin = new pg.Client({ connectionString: url.toString().replace(url.pathname, "/postgres") });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'ggz_e2e'");
  if (exists.rowCount === 0) await admin.query("CREATE DATABASE ggz_e2e");
  await admin.end();

  const env = { ...process.env };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`TRUNCATE "AuditLog","AdminSession","AdminUser","Registration","Participant","Payment","ContinuationToken","RegistrationAttempt","RateLimitBucket","Event" CASCADE`);
  await client.end();
  execSync("npx prisma db seed", { stdio: "inherit", env });
  const c2 = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c2.connect();
  await c2.query(
    `UPDATE "Event" SET "feeKobo" = 1500000, "capacity" = 50, "registrationOpen" = true,
     "refundPolicy" = 'E2E test refund policy', "feeCovers" = 'E2E: camp activities'`,
  );
  await c2.end();
  execSync(`npx tsx scripts/create-admin.ts --email ${E2E_ADMIN.email} --name "E2E Admin" --role ADMIN`, {
    stdio: "inherit",
    env: { ...env, ADMIN_PASSWORD: E2E_ADMIN.password },
  });
}
