import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import {
  WIREMOCK_ADMIN_URL,
  WIREMOCK_PORT,
  WIREMOCK_URL,
} from "#tests/playwright/helpers/wiremockConfig.js";
import { REDIS_URL } from "#tests/playwright/helpers/redisConfig.js";
import {
  TEST_SESSION_NAME,
  TEST_SESSION_SECRET,
} from "#tests/playwright/helpers/testSessionConfig.js";

const TRY_ZER0 = 0;
const TRY_TWICE = 2;
const appServerCommand =
  process.env.PLAYWRIGHT_COVERAGE === "true"
    ? "bun scripts/startPlaywrightCoverage.ts"
    : "bun start";
const wiremockMappingsPath = path.resolve(
  process.cwd(),
  "tests/resources/wiremock",
);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  timeout: 15_000,
  testDir: "./tests/playwright",
  outputDir: "./playwright-test-results",
  globalTeardown:
    process.env.PLAYWRIGHT_COVERAGE === "true"
      ? "./tests/playwright/coverageTeardown.ts"
      : undefined,
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: Boolean(process.env.CI ?? false),
  /* Retry on CI only */
  retries: process.env.CI === "true" ? TRY_TWICE : TRY_ZER0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // reporter: [["html", { outputFolder: "playwright-test-results" }]],
  reporter: "line",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://127.0.0.1:3000",
    ignoreHTTPSErrors: true,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI === "true" ? "on" : "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: `docker run --name wiremock-pw --rm -p ${WIREMOCK_PORT}:8080 -p 8443:8443 -v "${wiremockMappingsPath}:/home/wiremock/mappings" wiremock/wiremock:latest --https-port 8443 --global-response-templating`,
      url: `${WIREMOCK_ADMIN_URL}/mappings`,
      reuseExistingServer: process.env.CI === "false",
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: appServerCommand,
      env: {
        SKIP_AUTH: "false",
        CLIENT_ID: "test-client-id",
        AUTH_CLIENT_ID: "test-client-id",
        AUTH_CLIENT_SECRET: "test-client-secret",
        AUTH_REDIRECT_URL: "http://127.0.0.1:3000/auth/redirect",
        AUTH_DIRECTORY_URL: "https://127.0.0.1:8443/mock-entra",
        KNOWN_AUTHORITIES: "127.0.0.1:8443",
        NODE_TLS_REJECT_UNAUTHORIZED: "0",
        BACKEND_URL: WIREMOCK_URL,
        DEPARTMENT_NAME: "Legal aid agency",
        RATE_LIMIT_MAX: "10000",
        RATE_WINDOW_MS: "1",
        SESSION_REDIS_URL: REDIS_URL,
        SESSION_NAME: TEST_SESSION_NAME,
        SESSION_SECRET: TEST_SESSION_SECRET,
        LOG_PRETTY: "true",
      },
      url: "http://127.0.0.1:3000/health/liveness",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
