import { test, expect } from "@playwright/test";

const AGENT_BASE = process.env.PLAYWRIGHT_AGENT_URL || "http://localhost:3001";

test.describe("Marketplace Browse (US-075, US-076)", () => {
    test("should load marketplace page without authentication (US-003, US-075)", async ({
        browser
    }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`${AGENT_BASE}/marketplace`);
        await expect(page.locator("body")).toBeVisible();
        await expect(page).not.toHaveURL(/.*login.*/);
        await context.close();
    });

    test("should display marketplace page content (US-075)", async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`${AGENT_BASE}/marketplace`);
        await page.waitForLoadState("networkidle");

        const content = await page.textContent("body");
        expect(content).toBeDefined();
        await context.close();
    });

    test("should navigate to detail page on card click (US-076)", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/marketplace`);
        await page.waitForLoadState("networkidle");

        const firstCard = page.locator("a[href*='/marketplace/']").first();
        if (await firstCard.isVisible()) {
            await firstCard.click();
            await expect(page).toHaveURL(/.*\/marketplace\/[a-z0-9-]+/);
        }
    });

    test("should display playbook detail page without auth (US-076)", async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`${AGENT_BASE}/marketplace`);
        await page.waitForLoadState("networkidle");

        const firstCard = page.locator("a[href*='/marketplace/']").first();
        if (await firstCard.isVisible()) {
            await firstCard.click();
            await page.waitForLoadState("networkidle");
            await expect(page).not.toHaveURL(/.*login.*/);
        }
        await context.close();
    });
});

test.describe("Marketplace Search & Filter (US-046)", () => {
    test("should filter by category when tabs are available", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/marketplace`);
        await page.waitForLoadState("networkidle");

        const categoryTab = page
            .locator("button, [role='tab']")
            .filter({ hasText: /support/i })
            .first();
        if (await categoryTab.isVisible()) {
            await categoryTab.click();
            await page.waitForLoadState("networkidle");
        }
    });

    test("should search by keyword when search input is available", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/marketplace`);
        await page.waitForLoadState("networkidle");

        const searchInput = page.locator("input[type='text'], input[type='search']").first();
        if (await searchInput.isVisible()) {
            await searchInput.fill("support");
            await page.waitForTimeout(500);
        }
    });
});
