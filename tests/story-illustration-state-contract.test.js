const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");

function readMigration() {
  const names = fs.readdirSync(migrationsDirectory)
    .filter((name) => /^\d+_story_illustration_state\.sql$/.test(name));
  assert.equal(names.length, 1, "exactly one CLI-created illustration-state migration exists");
  return fs.readFileSync(path.join(migrationsDirectory, names[0]), "utf8");
}

test("illustration state uses a dedicated server-only RPC instead of an unsupported overload", () => {
  const migration = readMigration();

  assert.match(migration, /add column if not exists illustrations_enabled boolean/is);
  assert.match(migration, /add column if not exists image_status text/is);
  assert.match(migration, /image_status in \('pending', 'generating', 'ready', 'failed', 'skipped'\)/is);
  assert.match(
    migration,
    /create or replace function public\.create_story_from_reservation_with_illustration_state\([\s\S]*p_illustrations_enabled boolean/is
  );
  assert.match(
    migration,
    /create_story_from_reservation_with_illustration_state\([\s\S]*security definer[\s\S]*set search_path\s*=\s*public,\s*pg_temp/is
  );
  assert.match(
    migration,
    /revoke all on function public\.create_story_from_reservation_with_illustration_state\([\s\S]*from public, anon, authenticated/is
  );
  assert.match(
    migration,
    /grant execute on function public\.create_story_from_reservation_with_illustration_state\([\s\S]*to service_role/is
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.create_story_from_reservation\([\s\S]*p_illustrations_enabled boolean/is
  );
});
