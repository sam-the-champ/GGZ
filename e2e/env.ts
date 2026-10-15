/** Environment for the E2E build, servers and tests — never real credentials. */
export const E2E_PORT = 3100;
export const MOCK_PORT = 4010;
export const e2eEnv = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/ggz_e2e",
  APP_URL: `http://localhost:${E2E_PORT}`,
  APP_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
  FLUTTERWAVE_SECRET_KEY: "FLWSECK_TEST-e2e-mock-only-X",
  FLUTTERWAVE_WEBHOOK_HASH: "e2e-webhook-secret-hash-0123",
  FLUTTERWAVE_API_BASE_URL: `http://localhost:${MOCK_PORT}`,
  MOCK_PAYMENTS_PORT: String(MOCK_PORT),
  // Separate build folder so E2E can run alongside `npm run dev`.
  NEXT_DIST_DIR: ".next-e2e",
};
