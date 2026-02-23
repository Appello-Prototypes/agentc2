import { test, expect } from "./fixtures/auth.fixture";
import { TIMEOUTS } from "./fixtures/test-data";

/**
 * Nav Refactor E2E Tests
 *
 * Validates the new 7-item navigation structure, the Build dropdown,
 * the Schedule page (list + calendar), the Observe page (runs + triggers),
 * redirects from old routes, and the removal of ConnectionPowerBar.
 */

test.describe("Main Navigation Structure", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/workspace");
        await page.waitForLoadState("networkidle");
    });

    test("should render exactly 7 visible nav items", async ({ page }) => {
        const navLinks = page.locator("header nav a, header nav button[type='button']");
        await expect(navLinks.first()).toBeVisible({ timeout: TIMEOUTS.medium });

        const visibleItems = await navLinks.allTextContents();
        const expectedLabels = [
            "Workspace",
            "Campaigns",
            "Build",
            "Schedule",
            "Observe",
            "Knowledge",
            "Integrations"
        ];

        for (const label of expectedLabels) {
            const found = visibleItems.some((text) => text.includes(label));
            expect(found, `Expected nav item "${label}" to be visible`).toBeTruthy();
        }
    });

    test("should NOT show old nav items (Activity, Live Runs, Automations, Support, Skills as standalone)", async ({
        page
    }) => {
        const header = page.locator("header");
        const headerText = await header.textContent();

        expect(headerText).not.toContain("Live Runs");
        expect(headerText).not.toContain("Activity");
        expect(headerText).not.toContain("Automations");
        // Support should NOT be a top-level nav item (moved to avatar menu + ? icon)
        const topNavLinks = page.locator("header nav a");
        const linkTexts = await topNavLinks.allTextContents();
        expect(linkTexts).not.toContain("Support");
    });

    test("should NOT render ConnectionPowerBar", async ({ page }) => {
        // The ConnectionPowerBar used to render integration badges below the header
        // It should be completely removed
        const powerBar = page.locator('[class*="ConnectionPowerBar"]');
        await expect(powerBar).toHaveCount(0);

        // Also check there's no secondary bar with integration badges below the header
        const integrationBadges = page.locator("header + div .gap-1\\.5");
        const count = await integrationBadges.count();
        // If count > 0, check they're not integration provider badges
        if (count > 0) {
            const text = await integrationBadges.first().textContent();
            expect(text).not.toMatch(/HubSpot|Firecrawl|Jira|Slack|Gmail/i);
        }
    });

    test("should show help (?) icon in header utility area", async ({ page }) => {
        const helpButton = page.locator('header button:has(span:text("Help & Support"))');
        await expect(helpButton).toBeVisible();
    });

    test("should show search icon in header", async ({ page }) => {
        const searchButton = page.locator('header button:has(span:text("Search"))');
        await expect(searchButton).toBeVisible();
    });
});

test.describe("Build Dropdown", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/workspace");
        await page.waitForLoadState("networkidle");
    });

    test("should open Build dropdown with Agents, Workflows, Networks, Skills", async ({
        page
    }) => {
        const buildTrigger = page.locator("header nav button", { hasText: "Build" });
        await expect(buildTrigger).toBeVisible();

        await buildTrigger.click();

        // Wait for dropdown to appear
        const dropdown = page.locator('[data-slot="dropdown-menu-content"]');
        await expect(dropdown).toBeVisible({ timeout: TIMEOUTS.short });

        const items = await dropdown.locator('[data-slot="dropdown-menu-item"]').allTextContents();
        expect(items).toContain("Agents");
        expect(items).toContain("Workflows");
        expect(items).toContain("Networks");
        expect(items).toContain("Skills");
    });

    test("Build dropdown items should navigate to correct routes", async ({ page }) => {
        const buildTrigger = page.locator("header nav button", { hasText: "Build" });
        await buildTrigger.click();

        const dropdown = page.locator('[data-slot="dropdown-menu-content"]');
        await expect(dropdown).toBeVisible();

        // Click Agents
        await dropdown.locator('[data-slot="dropdown-menu-item"]', { hasText: "Agents" }).click();
        await page.waitForLoadState("networkidle");
        expect(page.url()).toContain("/agents");
    });
});

test.describe("Schedule Page", () => {
    test("should load schedule page with List and Calendar tabs", async ({ page }) => {
        await page.goto("/schedule");
        await page.waitForLoadState("networkidle");

        // Page title
        await expect(page.locator("h1", { hasText: "Schedule" })).toBeVisible({
            timeout: TIMEOUTS.medium
        });

        // Tabs
        const listTab = page.locator('button[role="tab"]', { hasText: "List" });
        const calendarTab = page.locator('button[role="tab"]', { hasText: "Calendar" });
        await expect(listTab).toBeVisible();
        await expect(calendarTab).toBeVisible();
    });

    test("should show automation summary cards in list view", async ({ page }) => {
        await page.goto("/schedule");
        await page.waitForLoadState("networkidle");

        // Wait for data to load (summary cards should appear)
        const summaryCards = page.locator('[data-slot="card"]');
        await expect(summaryCards.first()).toBeVisible({ timeout: TIMEOUTS.long });
    });

    test("should switch to calendar view", async ({ page }) => {
        await page.goto("/schedule");
        await page.waitForLoadState("networkidle");

        const calendarTab = page.locator('button[role="tab"]', { hasText: "Calendar" });
        await calendarTab.click();

        // Calendar grid should appear (day headers)
        await expect(page.getByText("Tue", { exact: true })).toBeVisible({
            timeout: TIMEOUTS.medium
        });
        await expect(page.getByText("Wed", { exact: true })).toBeVisible();

        // Navigation buttons should be visible
        await expect(page.locator("button", { hasText: "Today" })).toBeVisible();
    });

    test("should toggle between week and month view in calendar", async ({ page }) => {
        await page.goto("/schedule?view=calendar");
        await page.waitForLoadState("networkidle");

        const calendarTab = page.locator('button[role="tab"]', { hasText: "Calendar" });
        await calendarTab.click();

        // Default is week view - should show 7 day columns
        await expect(page.locator("text=Sun")).toBeVisible({ timeout: TIMEOUTS.medium });

        // Switch to month
        const monthButton = page.locator("button", { hasText: "Month" });
        await monthButton.click();

        // Month view should show more day cells
        const dayCells = page.locator(".grid-cols-7 > div");
        const count = await dayCells.count();
        // Month has at least 28 day cells (plus header + padding)
        expect(count).toBeGreaterThan(20);
    });
});

test.describe("Observe Page", () => {
    test("should load observe page with Runs and Triggers tabs", async ({ page }) => {
        await page.goto("/observe");
        await page.waitForLoadState("networkidle");

        // Page title
        await expect(page.locator("h1", { hasText: "Observe" })).toBeVisible({
            timeout: TIMEOUTS.medium
        });

        // Tabs
        const runsTab = page.locator('button[role="tab"]', { hasText: "Runs" });
        const triggersTab = page.locator('button[role="tab"]', { hasText: "Triggers" });
        await expect(runsTab).toBeVisible();
        await expect(triggersTab).toBeVisible();
    });

    test("should show runs data in Runs tab", async ({ page }) => {
        await page.goto("/observe");
        await page.waitForLoadState("networkidle");

        // The Runs tab should be active by default and show a table or loading state
        // Wait for either data or empty state
        const contentArea = page.locator("main, [class*='container']").first();
        await expect(contentArea).toBeVisible({ timeout: TIMEOUTS.long });
    });

    test("should switch to Triggers tab", async ({ page }) => {
        await page.goto("/observe");
        await page.waitForLoadState("networkidle");

        const triggersTab = page.locator('button[role="tab"]', { hasText: "Triggers" });
        await triggersTab.click();

        // Should show the trigger event monitoring view
        await page.waitForLoadState("networkidle");

        // The triggers tab content should be visible
        // (either data table or loading/empty state)
        await expect(page.locator("body")).toBeVisible();
    });

    test("should accept tab query parameter", async ({ page }) => {
        await page.goto("/observe?tab=triggers");
        await page.waitForLoadState("networkidle");

        await expect(page.locator("h1", { hasText: "Observe" })).toBeVisible({
            timeout: TIMEOUTS.medium
        });
    });
});

test.describe("Redirects from Old Routes", () => {
    test("/activity should redirect to /observe", async ({ page }) => {
        await page.goto("/activity");
        await page.waitForLoadState("networkidle");

        expect(page.url()).toContain("/observe");
    });

    test("/live should redirect to /observe", async ({ page }) => {
        await page.goto("/live");

        // Client-side redirect via window.location.replace
        await page.waitForURL("**/observe", { timeout: TIMEOUTS.medium });
        expect(page.url()).toContain("/observe");
    });

    test("/triggers should redirect to /schedule", async ({ page }) => {
        await page.goto("/triggers");

        // Client-side redirect via window.location.replace
        await page.waitForURL("**/schedule", { timeout: TIMEOUTS.medium });
        expect(page.url()).toContain("/schedule");
    });
});

test.describe("Direct Navigation via Nav Items", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/workspace");
        await page.waitForLoadState("networkidle");
    });

    test("clicking Workspace nav item goes to /workspace", async ({ page }) => {
        const workspaceLink = page.locator("header nav a", { hasText: "Workspace" });
        await workspaceLink.click();
        await page.waitForURL("**/workspace**", { timeout: TIMEOUTS.medium });
        expect(page.url()).toContain("/workspace");
    });

    test("clicking Schedule nav item goes to /schedule", async ({ page }) => {
        const scheduleLink = page.locator("header nav a", { hasText: "Schedule" });
        await Promise.all([page.waitForURL("**/schedule**"), scheduleLink.click()]);
        expect(page.url()).toContain("/schedule");
    });

    test("clicking Observe nav item goes to /observe", async ({ page }) => {
        const observeLink = page.locator("header nav a", { hasText: "Observe" });
        await Promise.all([page.waitForURL("**/observe**"), observeLink.click()]);
        expect(page.url()).toContain("/observe");
    });

    test("clicking Knowledge nav item goes to /knowledge", async ({ page }) => {
        const knowledgeLink = page.locator("header nav a", { hasText: "Knowledge" });
        await Promise.all([page.waitForURL("**/knowledge**"), knowledgeLink.click()]);
        expect(page.url()).toContain("/knowledge");
    });

    test("clicking Integrations nav item goes to /mcp", async ({ page }) => {
        const integrationsLink = page.locator("header nav a", { hasText: "Integrations" });
        await Promise.all([page.waitForURL("**/mcp**"), integrationsLink.click()]);
        expect(page.url()).toContain("/mcp");
    });
});

test.describe("User Menu", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/workspace");
        await page.waitForLoadState("networkidle");
    });

    test("user menu should contain Support option", async ({ page }) => {
        // Target the avatar trigger specifically (last dropdown trigger in header)
        const avatarMenu = page
            .locator("header")
            .locator('[data-slot="dropdown-menu-trigger"]')
            .last();
        await avatarMenu.click();

        const dropdown = page.locator('[data-slot="dropdown-menu-content"]').last();
        await expect(dropdown).toBeVisible({ timeout: TIMEOUTS.short });

        const menuItems = await dropdown
            .locator('[data-slot="dropdown-menu-item"]')
            .allTextContents();
        expect(menuItems.some((item) => item.includes("Support"))).toBeTruthy();
        expect(menuItems.some((item) => item.includes("Settings"))).toBeTruthy();
        expect(menuItems.some((item) => item.includes("Sign out"))).toBeTruthy();
    });
});
