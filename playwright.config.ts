import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Load environment variables from .env file
config({ path: ".env" });

/**
 * Playwright E2E Test Configuration
 *
 * Tests the Agent Workspace UI, focusing on the Test page
 * where users interact with agents via chat.
 */
export default defineConfig({
    testDir: "./tests-e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [["html", { open: "never" }], ["list"]],

    use: {
        // Use localhost for dev:local mode, catalyst.localhost for dev with Caddy
        baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: "on-first-retry",
        // Ignore HTTPS errors for local development with self-signed certs
        ignoreHTTPSErrors: true
    },

    projects: [
        // Setup project for authentication
        {
            name: "setup",
            testMatch: /.*\.setup\.ts/
        },
        // Public marketplace tests (no auth required)
        {
            name: "marketplace",
            testMatch: /marketplace\/.*\.spec\.ts/,
            use: { ...devices["Desktop Chrome"] }
        },
        // Main tests that depend on authentication
        {
            name: "chromium",
            testIgnore: /marketplace\/.*/,
            use: {
                ...devices["Desktop Chrome"],
                storageState: ".auth/user.json"
            },
            dependencies: ["setup"]
        }
    ],

    // Web server configuration - starts dev server if not already running
    webServer: {
        command: "bunx turbo dev --filter=frontend --filter=agent",
        url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120000,
        ignoreHTTPSErrors: true
    }
});
