import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.mjs",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4318",
    screenshot: "off"
  },
  webServer: {
    command: "SUPABASE_URL=https://ynidvdesfolavhngubqv.supabase.co SUPABASE_ANON_KEY=test-publishable-key AI_GENERATION_ENABLED=true IMAGE_GENERATION_ENABLED=true npm run build && python3 -m http.server 4318 -d dist",
    port: 4318,
    reuseExistingServer: false
  }
});
