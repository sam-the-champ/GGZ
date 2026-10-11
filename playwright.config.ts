import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT, MOCK_PORT, e2eEnv } from "./e2e/env";

/**
 * End-to-end tests against a production build (built by `npm run test:e2e`),
 * a dedicated database (ggz_e2e) and a LOCAL MOCK Paystack server — never
 * real credentials. Requires the local PostgreSQL from `npm run db:local`.
 *
 * Servers are started as plain `node` processes (no npx/shell chains) so they
 * shut down cleanly on Windows.
 */
Object.assign(process.env, e2eEnv);

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: e2eEnv.APP_URL, trace: "retain-on-failure", ...devices["Pixel 7"] },
  webServer: [
    {
      command: "node --import tsx scripts/mock-paystack.ts",
      url: `http://localhost:${MOCK_PORT}/health`,
      env: e2eEnv,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 2000 },
    },
    {
      command: `node node_modules/next/dist/bin/next start -p ${E2E_PORT}`,
      url: e2eEnv.APP_URL,
      env: e2eEnv,
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 2000 },
    },
  ],
});
