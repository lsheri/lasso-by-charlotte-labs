import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env["LASSO_E2E_BASE_URL"] ??
  "https://id-preview--57cd51ce-f7b4-4cd0-a7d0-761453b5935b.lovable.app";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 1800 },
    screenshot: "only-on-failure",
    trace: "off",
    ...devices["Desktop Chrome"],
  },
});
