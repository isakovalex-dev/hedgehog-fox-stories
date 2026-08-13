const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const dir = path.join(__dirname, "..", "supabase", "migrations");

function readMigration() {
  const names = fs.readdirSync(dir).filter((name) => /^\d+_atomic_image_finalization\.sql$/.test(name));
  assert.equal(names.length, 1, "exactly one CLI-created atomic finalization migration exists");
  return fs.readFileSync(path.join(dir, names[0]), "utf8");
}

test("image finalizer is server-only and uses an owner-bound CAS", () => {
  const sql = readMigration();
  assert.match(sql, /public\.finalize_image_generation[\s\S]*p_reservation_id\s+uuid[\s\S]*p_page_id\s+uuid[\s\S]*p_expected_image_url\s+text[\s\S]*p_new_image_url\s+text/is);
  assert.match(sql, /security\s+definer\s+set\s+search_path\s*=\s*public,\s*pg_temp/is);
  assert.match(sql, /from\s+public,\s+anon,\s+authenticated/is);
  assert.match(sql, /finalize_image_generation\(uuid,\s*uuid,\s*text,\s*text\)\s+to\s+service_role/is);
  assert.match(sql, /ai_usage_counters[\s\S]*for\s+update[\s\S]*ai_generation_reservations[\s\S]*for\s+update/is);
  assert.match(sql, /join\s+public\.stories[\s\S]*user_id\s*=\s*v_reservation\.user_id/is);
  assert.match(sql, /image_url\s+is\s+not\s+distinct\s+from\s+p_expected_image_url/is);
  assert.match(sql, /'idempotency_replayed',\s*true/is);
  assert.match(sql, /'page_changed'|storage:\/\/story-illustrations\//is);
});
