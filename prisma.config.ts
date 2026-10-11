import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` does not need a live database, so allow builds
    // without DATABASE_URL; migrate commands will fail loudly if it is missing.
    url: process.env.DATABASE_URL ?? "",
  },
});
