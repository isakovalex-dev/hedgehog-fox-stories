const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile, readdir } = require("node:fs/promises");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");

async function readProjectFile(path) {
  return readFile(resolve(root, path), "utf8");
}

test("retired Supabase SQL documents contain only the required supersession notice", async () => {
  const expectedNotice = [
    "-- SUPERSEDED: Do not run this file.",
    "-- The authoritative implementation is the versioned migration created by:",
    "--   supabase migration new security_remediation",
    "-- Apply and verify that migration in a non-production project first.",
  ].join("\n");
  const retiredFiles = [
    "docs/supabase-production-hardening.sql",
    "docs/supabase-rpc-generated-story.sql",
    "docs/supabase-yookassa-payment-setup.sql",
  ];

  for (const file of retiredFiles) {
    const content = await readProjectFile(file);
    assert.match(content, new RegExp(expectedNotice.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(content, /\b(begin|commit|create|alter|drop|grant|revoke|select|insert|update|delete)\b/i);
  }
});

test("operations runbook has the six required security rollout gates", async () => {
  const operations = await readProjectFile("docs/supabase-operations.md");

  for (const gate of [
    "Supabase Auth Dashboard",
    "Vercel Environment Variables",
    "Non-production",
    "Manual production approval",
    "Rollback",
    "Monitoring",
  ]) {
    assert.match(operations, new RegExp(gate, "i"));
  }

  assert.match(operations, /CAPTCHA/i);
  assert.match(operations, /SUPABASE_SECRET_KEY/);
  assert.match(operations, /supabase db advisors/);
  assert.match(operations, /GENERATION_API_ENABLED/);
  assert.match(operations, /ILLUSTRATION_API_ENABLED/);
  assert.match(operations, /explicit.*approval/i);
});

test("RLS audit exposes raw function ACLs", async () => {
  const audit = await readProjectFile("docs/supabase-rls-audit.sql");
  assert.match(audit, /p\.proacl\s+as\s+function_acl/i);
  assert.match(audit, /function_acl/);
});

test("RLS audit covers the exact image finalizer catalog and privilege contract", async () => {
  const audit = await readProjectFile("docs/supabase-rls-audit.sql");

  assert.match(audit, /public\.finalize_image_generation\(uuid, uuid, text, text\)/i);
  assert.match(audit, /p\.prosecdef\s+as\s+security_definer/i);
  assert.match(audit, /p\.proconfig\s+as\s+function_config/i);
  for (const outcome of [
    "public_execute",
    "anon_execute",
    "authenticated_execute",
    "service_role_execute"
  ]) {
    assert.match(audit, new RegExp(outcome, "i"));
  }
  assert.match(audit, /search_path=public, pg_temp/i);
});

test("Storage migration preserves the owner-read policy without altering Supabase-managed RLS", async () => {
  const migration = await readProjectFile(
    "supabase/migrations/20260810003928_security_remediation.sql"
  );

  assert.doesNotMatch(migration, /alter\s+table\s+storage\.objects\s+enable\s+row\s+level\s+security/i);
  assert.match(migration, /create\s+policy\s+story_illustrations_owner_read\s+on\s+storage\.objects/i);
  assert.match(migration, /bucket_id\s*=\s*'story-illustrations'/i);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\]\s*=\s*\(select\s+auth\.uid\(\)::text\)/i);
});

test("local Supabase Auth fixtures avoid the removed email_confirmed_at column", async () => {
  for (const fixture of [
    "tests/supabase-security.sql",
    "tests/supabase-concurrent-reservation.sh",
  ]) {
    const content = await readProjectFile(fixture);
    assert.doesNotMatch(content, /\bemail_confirmed_at\b/i);
  }
});

test("concurrency runner falls back to the local Docker psql client", async () => {
  const runner = await readProjectFile("tests/supabase-concurrent-reservation.sh");

  assert.match(runner, /run_psql\(\)/);
  assert.match(runner, /command -v psql/);
  assert.match(runner, /docker exec -i supabase_db_security-remediation psql/);
  assert.match(runner, /run_psql "\$database_url"/);
  assert.doesNotMatch(runner, /exec\s+(?:psql|docker)/);
});

test("usage display RPC is revoked from the service role by a versioned migration", async () => {
  const migrationsDirectory = resolve(root, "supabase/migrations");
  const migrationFiles = await readdir(migrationsDirectory);
  const migrations = await Promise.all(
    migrationFiles
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFile(resolve(migrationsDirectory, file), "utf8"))
  );

  assert.ok(
    migrations.some((migration) =>
      /revoke\s+execute\s+on\s+function\s+public\.get_current_usage\(\)\s+from\s+service_role/i.test(migration)
    ),
    "a migration must revoke service_role execution from get_current_usage"
  );
});

test("security audit records remediation findings as pending verification", async () => {
  const audit = await readProjectFile("SECURITY-AUDIT.md");

  for (const finding of ["SEC-001", "SEC-002", "SEC-003", "SEC-004", "SEC-005", "SEC-006"]) {
    assert.match(audit, new RegExp(finding));
  }

  assert.match(audit, /implemented, pending non-production verification/i);
  assert.match(audit, /risk reduced; BFF cookie migration remains separate/i);
  assert.match(audit, /Migration name:/);
  assert.match(audit, /Test results:/);
  assert.match(audit, /Staging URL:/);
  assert.match(audit, /Deploy timestamp:/);
  assert.match(audit, /Reviewer:/);
});

test("atomic image finalization rollout remains gated on non-production verification", async () => {
  const [operations, audit] = await Promise.all([
    readProjectFile("docs/supabase-operations.md"),
    readProjectFile("SECURITY-AUDIT.md"),
  ]);
  const gateThree = operations.match(/## 3\. Non-production([\s\S]*?)## 4\. Manual production approval/i)?.[1];
  const sec007 = audit.match(/### SEC-007([\s\S]*?)### SEC-008/i)?.[1];
  const sec008 = audit.match(/### SEC-008([\s\S]*)/i)?.[1];

  assert.match(operations, /supabase\/migrations\//i);
  assert.match(operations, /every timestamped migration[\s\S]*timestamp order/i);
  assert.match(operations, /_atomic_image_finalization\.sql/i);
  assert.match(operations, /public\.finalize_image_generation/i);
  assert.match(operations, /tests\/supabase-security\.sql/i);
  assert.match(operations, /tests\/supabase-concurrent-reservation\.sh/i);
  assert.ok(gateThree, "Gate 3 must be present");
  for (const scenario of ["completed", "idempotency_replayed", "reservation_expired", "page_changed"]) {
    assert.match(gateThree, new RegExp(scenario, "i"));
  }

  assert.ok(sec007, "SEC-007 must be present before SEC-008");
  assert.match(sec007, /Page reference and image usage charge in one transaction/i);
  assert.match(sec007, /implemented, pending non-production verification/i);
  assert.match(sec007, /SQL runtime, concurrency,\s*staging, and\s*production verification remain release-blockers/i);

  assert.ok(sec008, "SEC-008 must be present");
  assert.match(sec008, /CAS does not overwrite a newer illustration/i);
  assert.match(sec008, /implemented, pending non-production verification/i);
  assert.match(sec008, /SQL runtime, concurrency,\s*staging, and\s*production verification remain release-blockers/i);
});
