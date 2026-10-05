import { defineConfig, devices } from "@playwright/test";

// End-to-end tests. Without a Supabase project, demo.spec.ts runs the whole story in demo mode.
// With one (email confirmation off), E2E_SUPABASE=1 also runs marketplace.spec.ts with three browsers.
// Against the deployed site: E2E_BASE_URL=https://<user>.github.io/<repo> npm run test:e2e.
// E2E_CHANNEL=msedge (or chrome) uses an installed browser instead of Playwright's own download.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
    ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}),
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
