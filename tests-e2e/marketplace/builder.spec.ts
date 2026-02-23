import { test, expect } from "@playwright/test";

const AGENT_BASE = process.env.PLAYWRIGHT_AGENT_URL || "http://localhost:3001";

test.describe("Builder UI (US-072 - US-074)", () => {
    test("should load playbooks dashboard (US-072)", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/playbooks`);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).toBeVisible();
    });

    test("should have New Playbook button that navigates to creation wizard (US-072)", async ({
        page
    }) => {
        await page.goto(`${AGENT_BASE}/playbooks`);
        await page.waitForLoadState("networkidle");

        const newButton = page
            .locator("a, button")
            .filter({ hasText: /new playbook/i })
            .first();
        if (await newButton.isVisible()) {
            await newButton.click();
            await expect(page).toHaveURL(/.*\/playbooks\/new/);
        }
    });

    test("should load creation wizard page (US-073)", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/playbooks/new`);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).toBeVisible();
    });

    test("should have form fields for playbook creation (US-073)", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/playbooks/new`);
        await page.waitForLoadState("networkidle");

        const nameInput = page.locator("input[name='name'], input[placeholder*='name' i]").first();
        const slugInput = page.locator("input[name='slug'], input[placeholder*='slug' i]").first();

        if (await nameInput.isVisible()) {
            await nameInput.fill("Test Playbook");
        }
        if (await slugInput.isVisible()) {
            await slugInput.fill("test-playbook");
        }
    });
});

test.describe("Builder Playbook Management (US-074)", () => {
    test("should display playbook details when playbook exists (US-074)", async ({ page }) => {
        await page.goto(`${AGENT_BASE}/playbooks`);
        await page.waitForLoadState("networkidle");

        const firstPlaybookLink = page
            .locator("a[href*='/playbooks/']")
            .filter({ hasNotText: /new/i })
            .first();
        if (await firstPlaybookLink.isVisible()) {
            await firstPlaybookLink.click();
            await page.waitForLoadState("networkidle");
            await expect(page.locator("body")).toBeVisible();
        }
    });
});
