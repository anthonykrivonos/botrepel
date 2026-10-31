import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE, E2E_ORIGIN, E2E_PORT } from "./apps/web/tests/e2e/host";

const CI = Boolean(process.env.CI);
const build = process.env.E2E_PREBUILT === "1" ? "" : "bun run build && ";
const SERVER_START_TIMEOUT_MS = 120_000;
/** Only tests that assert layout carry this tag, so the phone project runs just those. */
const PHONE_TAG = /@phone/;
/**
 * Tests that also run in WebKit and Firefox. Their automation always sets `navigator.webdriver`, so
 * the invisible pass can't be driven there; the step-up still proves the ticket, worker, and proof of work.
 */
const ENGINES_TAG = /@engines/;
/** The Playwright agents' scaffold; their MCP server runs it through this config locally. */
const AGENT_SEED_SPEC = /seed\.e2e\.ts$/;

export default defineConfig({
  testDir: "apps/web/tests/e2e",
  testMatch: /.*\.(e2e|spec)\.ts$/,
  testIgnore: CI ? AGENT_SEED_SPEC : [],
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // One at a time: tests seed the SQLite file from separate processes, and a write from one can
  // fail another process's in-flight write with SQLITE_BUSY (WAL snapshots skip busy_timeout).
  workers: 1,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: E2E_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: PHONE_TAG },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grep: ENGINES_TAG },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grep: ENGINES_TAG },
  ],
  webServer: {
    // The demo site's keys are exported before the build, which inlines the public one into the home page.
    command: `rm -f ${E2E_DATABASE}* && export $(bun scripts/seed-demo-site.ts --print | grep -E '^[A-Z_]+=br_') && ${build}bun apps/web/preview.ts`,
    url: `${E2E_ORIGIN}/api/health`,
    reuseExistingServer: !CI,
    timeout: SERVER_START_TIMEOUT_MS,
    stdout: "ignore",
    env: { PORT: String(E2E_PORT), DATABASE_PATH: E2E_DATABASE, BETTER_AUTH_URL: E2E_ORIGIN },
  },
});
