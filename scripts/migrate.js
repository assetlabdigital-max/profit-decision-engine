/**
 * scripts/migrate.js
 *
 * Simple migration runner: applies every .sql file in /migrations in
 * filename order. Uses a plain `pg` client (not the pool used by the
 * app) since this runs as a one-off CLI script, not inside the server.
 *
 * Usage: npm run db:migrate
 *
 * If DATABASE_URL is missing, this exits with a clear message rather
 * than a stack trace — consistent with the project's "never crash
 * confusingly" philosophy, even for tooling.
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Add it to .env.local before running migrations.");
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found in /migrations.");
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log(`Connected. Applying ${files.length} migration file(s)...`);

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8");
      console.log(`-> Applying ${file}`);
      await client.query(sql);
    }

    console.log("All migrations applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
