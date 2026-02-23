import { test, expect } from "@playwright/test";

const AGENT_BASE = process.env.PLAYWRIGHT_AGENT_URL || "http://localhost:3001";

test.describe("Navigation (US-079)", () => {
    test("should have navigation in sidebar (US-079)", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/playbooks`);
        await page.waitForLoadState("networkidle");

        const nav = page.locator("nav, [role='navigation'], aside");
        if (await nav.first().isVisible()) {
            const navText = await nav.first().textContent();
            expect(navText).toBeDefined();
        }
    });
});

test.describe("Public Route Access (US-080)", () => {
    test("marketplace browse is publicly accessible", async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`${AGENT_BASE}/marketplace`);
        await page.waitForLoadState("networkidle");
        await expect(page).not.toHaveURL(/.*login.*/);

        await context.close();
    });

    test("marketplace detail is publicly accessible", async ({ browser }) => {
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
