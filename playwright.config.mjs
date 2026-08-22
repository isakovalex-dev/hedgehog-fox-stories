import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.mjs",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4318",
    channel: "chrome",
    screenshot: "off"
  },
  webServer: {
    command:
      "SUPABASE_URL=https://supabase.e2e.test SUPABASE_ANON_KEY=e2e-anon-key AI_GENERATION_ENABLED=true npm run build && python3 -m http.server 4318 -d dist",
    port: 4318,
    reuseExistingServer: false
  }
});
