/**
 * Vercel runs `npm run vercel-build` instead of `build` when it exists.
 *
 * Production deployments apply pending database migrations first
 * (`prisma migrate deploy` only runs committed migrations; it never resets or
 * deletes data), so new code never goes live without the tables it needs.
 * If migrating fails, the build fails and the previous deployment stays live.
 *
 * Preview deployments skip migrations so they can never change production data.
 */
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const isProduction = process.env.VERCEL_ENV === "production";
if (isProduction) {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set for Production — cannot apply migrations.");
    process.exit(1);
  }
  console.log("Applying database migrations (production)…");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
