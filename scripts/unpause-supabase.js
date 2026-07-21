/**
 * scripts/unpause-supabase.js
 *
 * Restores a paused Supabase project via Management API.
 * Requires SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/unpause-supabase.js
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/unpause-supabase.js bnfzabypahljrddhbadf
 */

require("dotenv").config({ path: ".env.local" });

const projectRef = process.argv[2] || "bnfzabypahljrddhbadf";
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

async function main() {
  if (!token) {
    console.error("SUPABASE_ACCESS_TOKEN is not set.");
    console.error("Create one at https://supabase.com/dashboard/account/tokens");
    console.error("Then add to .env.local or pass inline for this command.");
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const statusRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, { headers });
  if (!statusRes.ok) {
    const text = await statusRes.text();
    console.error(`Failed to fetch project status: HTTP ${statusRes.status} — ${text.slice(0, 300)}`);
    process.exit(1);
  }

  const project = await statusRes.json();
  console.log(`Project: ${project.name} (${projectRef})`);
  console.log(`Status: ${project.status}`);

  if (project.status === "ACTIVE_HEALTHY" || project.status === "COMING_UP") {
    console.log("Project is already active or restoring — no restore needed.");
    return;
  }

  if (project.status !== "INACTIVE" && project.status !== "PAUSED") {
    console.log(`Unexpected status "${project.status}". Attempting restore anyway...`);
  }

  const restoreRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/restore`, {
    method: "POST",
    headers,
  });

  const restoreBody = await restoreRes.text();
  if (!restoreRes.ok) {
    console.error(`Restore failed: HTTP ${restoreRes.status} — ${restoreBody.slice(0, 400)}`);
    process.exit(1);
  }

  console.log("Restore request accepted.");
  if (restoreBody.trim()) console.log(restoreBody);

  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const poll = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, { headers });
    if (!poll.ok) continue;
    const state = await poll.json();
    console.log(`… status: ${state.status}`);
    if (state.status === "ACTIVE_HEALTHY") {
      console.log("Project is ACTIVE_HEALTHY.");
      return;
    }
  }

  console.log("Restore still in progress — check Supabase dashboard in a few minutes.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
