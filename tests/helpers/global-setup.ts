import { execSync } from "node:child_process";

/** Applies migrations to the test database before the suite runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/ggz_test";
  if (!/ggz_test|_test\b|test/.test(url)) throw new Error("Refusing to run tests against a non-test database");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
