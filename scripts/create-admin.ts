/**
 * Provision an admin account from the command line (there is deliberately no
 * public sign-up endpoint).
 *
 *   npm run admin:create -- --email you@example.org --name "Your Name" [--role ADMIN|VIEWER]
 *
 * The password is read from ADMIN_PASSWORD if set, otherwise a strong random
 * password is generated and printed ONCE. Re-running for an existing email
 * resets that account's password and re-activates it.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "ADMIN" },
  },
});

async function main() {
  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  const role = values.role === "VIEWER" ? "VIEWER" : "ADMIN";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    console.error('Usage: npm run admin:create -- --email you@example.org --name "Your Name" [--role ADMIN|VIEWER]');
    process.exit(1);
  }
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(18).toString("base64url");
  if (password.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters");
    process.exit(1);
  }
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    const user = await prisma.adminUser.upsert({
      where: { email },
      update: { name, role, passwordHash, isActive: true, failedLoginCount: 0, lockedUntil: null },
      create: { email, name, role, passwordHash },
    });
    await prisma.adminSession.deleteMany({ where: { adminUserId: user.id } });
    await prisma.auditLog.create({
      data: { action: "admin.provisioned", entityType: "AdminUser", entityId: user.id, details: { role, via: "cli" } },
    });
    console.log(`Admin ready: ${email} (${role})`);
    if (generated) console.log(`Generated password (shown once — store it in a password manager):\n  ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
