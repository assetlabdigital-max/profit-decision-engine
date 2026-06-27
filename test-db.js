require("dotenv").config({ path: ".env.local" });

const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    console.log("DATABASE_URL =", process.env.DATABASE_URL);

    await client.connect();

    console.log("✅ DB OK");

    await client.end();
  } catch (e) {
    console.error("❌ DB FAILED");
    console.error(e);
  }
})();