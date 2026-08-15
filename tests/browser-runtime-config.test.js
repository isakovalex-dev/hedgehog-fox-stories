"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

let modulePromise;

function loadConfigModule() {
  modulePromise ||= import("../scripts/browser-runtime-config.mjs");
  return modulePromise;
}

test("Preview build fails closed when public staging config is incomplete", async () => {
  const { buildBrowserRuntimeConfig } = await loadConfigModule();

  assert.throws(
    () => buildBrowserRuntimeConfig({
      VERCEL_ENV: "preview",
      SUPABASE_URL: "https://opcnhhujyckmccvvpihc.supabase.co"
    }),
    /Vercel Preview requires SUPABASE_URL and SUPABASE_ANON_KEY\./
  );
});

test("Preview browser artifact has staging-only public configuration", async () => {
  const { buildBrowserRuntimeConfig, renderBrowserRuntimeConfig } = await loadConfigModule();
  const config = buildBrowserRuntimeConfig({
    VERCEL_ENV: "preview",
    SUPABASE_URL: "https://opcnhhujyckmccvvpihc.supabase.co",
    SUPABASE_ANON_KEY: "staging-publishable-test-key",
    SUPABASE_SECRET_KEY: "must-not-be-rendered",
    PAYMENTS_ENABLED: "false",
    AI_GENERATION_ENABLED: "false",
    IMAGE_GENERATION_ENABLED: "false"
  });
  const artifact = renderBrowserRuntimeConfig(config);

  assert.equal(config.SUPABASE_URL, "https://opcnhhujyckmccvvpihc.supabase.co");
  assert.equal(config.SUPABASE_ANON_KEY, "staging-publishable-test-key");
  assert.equal(config.SUPABASE_ENABLED, true);
  assert.equal(config.GENERATION_API_ENABLED, false);
  assert.equal(config.ILLUSTRATION_API_ENABLED, false);
  assert.equal(config.GENERATION_API_URL, "");
  assert.equal(config.ILLUSTRATION_API_URL, "");
  assert.equal(config.ILLUSTRATION_SIGNING_API_URL, "/api/get-story-illustration-url");
  assert.equal(config.PAYMENT_API_URL, "");
  assert.match(artifact, /opcnhhujyckmccvvpihc\.supabase\.co/);
  assert.doesNotMatch(artifact, /ynidvdesfolavhngubqv/);
  assert.doesNotMatch(artifact, /must-not-be-rendered|SUPABASE_SECRET_KEY|SERVICE_ROLE/);

  const driftedConfig = buildBrowserRuntimeConfig({
    VERCEL_ENV: "preview",
    SUPABASE_URL: "https://opcnhhujyckmccvvpihc.supabase.co",
    SUPABASE_ANON_KEY: "staging-publishable-test-key",
    PAYMENTS_ENABLED: "true",
    AI_GENERATION_ENABLED: "true",
    IMAGE_GENERATION_ENABLED: "true"
  });

  assert.equal(driftedConfig.GENERATION_API_ENABLED, false);
  assert.equal(driftedConfig.GENERATION_API_URL, "");
  assert.equal(driftedConfig.ILLUSTRATION_API_ENABLED, false);
  assert.equal(driftedConfig.ILLUSTRATION_API_URL, "");
  assert.equal(driftedConfig.ILLUSTRATION_SIGNING_API_URL, "/api/get-story-illustration-url");
  assert.equal(driftedConfig.PAYMENT_API_URL, "");
});

test("Preview browser build rejects the production Supabase project", async () => {
  const { buildBrowserRuntimeConfig } = await loadConfigModule();

  assert.throws(
    () => buildBrowserRuntimeConfig({
      VERCEL_ENV: "preview",
      SUPABASE_URL: "https://ynidvdesfolavhngubqv.supabase.co",
      SUPABASE_ANON_KEY: "fake-preview-anon-key",
      SUPABASE_SECRET_KEY: "fake-preview-service-key",
      PAYMENTS_ENABLED: "true",
      AI_GENERATION_ENABLED: "true",
      IMAGE_GENERATION_ENABLED: "true"
    }),
    /opcnhhujyckmccvvpihc\.supabase\.co/
  );
});
