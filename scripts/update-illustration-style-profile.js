#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const profilePath = path.join(projectRoot, "assets", "illustration-style-profile.json");
const force = process.argv.includes("--force");

async function readProfile() {
  return JSON.parse(await fs.readFile(profilePath, "utf8"));
}

async function getSourceHashes(profile) {
  const references = Array.isArray(profile.reference_roles) ? profile.reference_roles : [];
  const hashes = {};

  for (const reference of references) {
    const relativePath = String(reference?.path || "");
    if (!relativePath) throw new Error("Style profile contains a reference without path");

    const bytes = await fs.readFile(path.join(projectRoot, relativePath));
    hashes[relativePath] = crypto.createHash("sha256").update(bytes).digest("hex");
  }

  return hashes;
}

function hashesMatch(left, right) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}

async function main() {
  const profile = await readProfile();
  const sourceHashes = await getSourceHashes(profile);

  if (hashesMatch(profile.source_hashes, sourceHashes)) {
    console.log("Style profile is current. No source hashes changed.");
    return;
  }

  if (!force) {
    console.error("Reference files changed. Review the textual style passport, then run:");
    console.error("node scripts/update-illustration-style-profile.js --force");
    process.exitCode = 1;
    return;
  }

  profile.source_hashes = sourceHashes;
  profile.version = Number(profile.version || 0) + 1;
  await fs.writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  console.log(`Updated ${path.relative(projectRoot, profilePath)} to version ${profile.version}.`);
  console.log("Review the visual rules in the profile before committing this update.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
