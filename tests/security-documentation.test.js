const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
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

test("Storage migration preserves the owner-read policy without altering Supabase-managed RLS", async () => {
  const migration = await readProjectFile(
    "supabase/migrations/20260810003928_security_remediation.sql"
  );

  assert.doesNotMatch(migration, /alter\s+table\s+storage\.objects\s+enable\s+row\s+level\s+security/i);
  assert.match(migration, /create\s+policy\s+story_illustrations_owner_read\s+on\s+storage\.objects/i);
  assert.match(migration, /bucket_id\s*=\s*'story-illustrations'/i);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\]\s*=\s*\(select\s+auth\.uid\(\)::text\)/i);
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
