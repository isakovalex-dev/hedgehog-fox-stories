import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.mjs",
  // The project runs visual browser scenarios with large watercolour assets.
  // One worker keeps their timing deterministic on a developer laptop and in CI.
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4318",
    channel: "chrome",
    screenshot: "off"
  },
  webServer: {
    command:
      "SUPABASE_URL=https://supabase.e2e.test SUPABASE_ANON_KEY=e2e-anon-key AI_GENERATION_ENABLED=true npm run build && python3 scripts/e2e-static-server.py",
    port: 4318,
    reuseExistingServer: false
  }
});
