/**
 * Starts a real, local PostgreSQL server for development and tests using the
 * `embedded-postgres` binaries, so contributors do not need Docker or a system
 * install. Data lives in `.local/pgdata` (git-ignored).
 *
 *   npm run db:local          # runs in the foreground until Ctrl+C
 *
 * Connection strings (also in .env.example):
 *   postgresql://postgres:postgres@localhost:54329/ggz_dev
 *   postgresql://postgres:postgres@localhost:54329/ggz_test
 *
 * Production uses a managed PostgreSQL provider — never this script.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 54329);
const dataDir = path.resolve(process.cwd(), ".local", "pgdata");

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
    onLog: () => {},
    onError: (e) => console.error("[postgres]", e),
  });

  const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
  if (fresh) {
    console.log("Initialising local PostgreSQL cluster…");
    await pg.initialise();
  }
  await pg.start();

  for (const db of ["ggz_dev", "ggz_test"]) {
    try {
      await pg.createDatabase(db);
      console.log(`Created database ${db}`);
    } catch {
      // Already exists.
    }
  }

  console.log(`Local PostgreSQL ready on port ${PORT}. Press Ctrl+C to stop.`);

  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Keep the process alive.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
