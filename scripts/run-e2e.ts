/**
 * npm run test:e2e — builds the app into .next-e2e with test-only settings,
 * then runs Playwright (which starts `next start` and the mock Paystack server).
 * Pass --skip-build to reuse the previous build.
 */
import { spawnSync } from "node:child_process";
import { e2eEnv } from "../e2e/env";

const env = { ...process.env, ...e2eEnv };
const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const passthrough = args.filter((a) => a !== "--skip-build");

const run = (cmd: string, cmdArgs: string[]) => {
  const r = spawnSync(process.execPath, [cmd, ...cmdArgs], { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!skipBuild) run("node_modules/next/dist/bin/next", ["build"]);
run("node_modules/@playwright/test/cli.js", ["test", ...passthrough]);
