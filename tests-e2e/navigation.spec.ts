import { test, expect } from "./fixtures/auth.fixture";
import { TEST_AGENT_SLUG, TIMEOUTS } from "./fixtures/test-data";

/**
 * Navigation E2E Tests
 *
 * Basic navigation tests to verify the workspace is accessible
 * and all pages load correctly.
 */
test.describe("Basic Navigation", () => {
    test("should load the dashboard after login", async ({ page }) => {
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Verify we're on the dashboard
        const url = page.url();
        expect(url).toContain("/dashboard");
    });

    test("should access agent workspace", async ({ workspacePage }) => {
        await workspacePage.gotoAgentList();

        // Page should load without error
        const bodyText = await workspacePage.page.locator("body").textContent();
        expect(bodyText).toBeTruthy();
    });

    test("should access agent test page directly", async ({ testPage }) => {
        await testPage.goto(TEST_AGENT_SLUG);

        // Verify page loaded
        const isLoaded = await testPage.isLoaded();
        expect(isLoaded).toBe(true);
    });

    test("should access agent runs page directly", async ({ runsPage }) => {
        await runsPage.goto(TEST_AGENT_SLUG);

        // Verify page loaded
        const isLoaded = await runsPage.isLoaded();
        expect(isLoaded).toBe(true);
    });

    test("should access agent traces page directly", async ({ tracesPage }) => {
        await tracesPage.goto(TEST_AGENT_SLUG);

        // Verify page loaded
        const isLoaded = await tracesPage.isLoaded();
        expect(isLoaded).toBe(true);
    });
});

test.describe("Workspace Navigation", () => {
    test("should navigate to overview page", async ({ workspacePage }) => {
        await workspacePage.gotoAgentOverview(TEST_AGENT_SLUG);

        const currentPath = workspacePage.getCurrentPath();
        expect(currentPath).toContain("overview");
    });

    test("should navigate between workspace tabs via sidebar", async ({ workspacePage, page }) => {
        await workspacePage.gotoAgentOverview(TEST_AGENT_SLUG);

        // Navigate to test tab
        await workspacePage.navigateToTab("test");
        await expect(page).toHaveURL(/.*\/test/);

        // Navigate to runs tab
        await workspacePage.navigateToTab("runs");
        await expect(page).toHaveURL(/.*\/runs/);

        // Navigate to analytics tab
        await workspacePage.navigateToTab("analytics");
        await expect(page).toHaveURL(/.*\/analytics/);
    });
});

test.describe("Page Load Performance", () => {
    test("test page should load within acceptable time", async ({ testPage }) => {
        const startTime = Date.now();

        await testPage.goto(TEST_AGENT_SLUG);

        const loadTime = Date.now() - startTime;

        // Page should load within 10 seconds
        expect(loadTime).toBeLessThan(10000);

        // Verify page is functional
        const isLoaded = await testPage.isLoaded();
        expect(isLoaded).toBe(true);
    });

    test("runs page should load within acceptable time", async ({ runsPage }) => {
        const startTime = Date.now();

        await runsPage.goto(TEST_AGENT_SLUG);

        const loadTime = Date.now() - startTime;

        // Page should load within 10 seconds
        expect(loadTime).toBeLessThan(10000);

        // Verify page is functional
        const isLoaded = await runsPage.isLoaded();
        expect(isLoaded).toBe(true);
    });
});
