require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(
    `select tablename, rowsecurity
     from pg_tables
     where schemaname = 'public'
     order by tablename`
  );
  console.log("=== RLS status ===");
  for (const row of rows) {
    console.log(`${row.tablename}: RLS=${row.rowsecurity}`);
  }

  const policies = await client.query(
    `select tablename, policyname, roles::text, cmd, qual, with_check
     from pg_policies
     where schemaname = 'public'
     order by tablename, policyname`
  );
  console.log("\n=== Policies (public) ===");
  if (policies.rows.length === 0) {
    console.log("(none — API roles blocked by RLS with no permissive policies)");
  } else {
    for (const p of policies.rows) {
      console.log(`${p.tablename}.${p.policyname} [${p.roles}] ${p.cmd}`);
      if (p.qual) console.log(`  USING: ${p.qual}`);
      if (p.with_check) console.log(`  WITH CHECK: ${p.with_check}`);
    }
  }
  await client.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
