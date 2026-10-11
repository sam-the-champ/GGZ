/**
 * Idempotent seed: ensures the GGZ Camp 1.0 event row exists with the
 * confirmed facts only. Fee, capacity, refund policy and age policy are left
 * unset (registration stays closed) until organisers configure them in
 * /admin/settings. Re-running never overwrites values set by admins.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const event = await prisma.event.upsert({
    where: { slug: "ggz-camp-1" },
    update: {},
    create: {
      slug: "ggz-camp-1",
      name: "GGZ Camp 1.0",
      theme: "IMPACT",
      startDate: new Date("2026-12-08T00:00:00Z"),
      endDate: new Date("2026-12-10T00:00:00Z"),
      venue: "Royal Beach, Orimedu, Lagos, Nigeria",
      currency: "NGN",
    },
  });
  console.log(`Event ready: ${event.name} (${event.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
