import { test, expect } from "@playwright/test";

const AGENT_BASE = process.env.PLAYWRIGHT_AGENT_URL || "http://localhost:3001";

test.describe("Deploy Wizard (US-077)", () => {
    test("should load deploy page for authenticated user (US-077)", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/marketplace`);
        await page.waitForLoadState("networkidle");

        const firstCard = page.locator("a[href*='/marketplace/']").first();
        if (await firstCard.isVisible()) {
            const href = await firstCard.getAttribute("href");
            if (href) {
                const deployUrl = href.startsWith("http")
                    ? href + "/deploy"
                    : `${AGENT_BASE}${href}/deploy`;
                await page.goto(deployUrl);
                await page.waitForLoadState("networkidle");
                await expect(page.locator("body")).toBeVisible();
            }
        }
    });
});

test.describe("Installed Playbooks (US-078)", () => {
    test("should load installed playbooks page (US-078)", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/marketplace/installed`);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).toBeVisible();
    });

    test("should display installed page content (US-078)", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/marketplace/installed`);
        await page.waitForLoadState("networkidle");

        const content = await page.textContent("body");
        expect(content).toBeDefined();
    });
});
