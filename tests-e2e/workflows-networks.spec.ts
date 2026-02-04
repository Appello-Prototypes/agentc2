import { test, expect } from "./fixtures/auth.fixture";
import {
    SEEDED_NETWORK_NAME,
    SEEDED_NETWORK_SLUG,
    SEEDED_WORKFLOW_NAME,
    SEEDED_WORKFLOW_SLUG,
    SAMPLE_NETWORK_MESSAGE,
    SAMPLE_WORKFLOW_INPUT,
    TIMEOUTS
} from "./fixtures/test-data";

const getAgentBaseUrl = () => {
    const agentBaseUrl = process.env.PLAYWRIGHT_AGENT_URL || "http://localhost:3001";
    const pathPrefix = agentBaseUrl.includes("catalyst.localhost") ? "/agent" : "";
    return `${agentBaseUrl}${pathPrefix}`;
};

test.describe("Workflow and Network Workspaces", () => {
    test("should load seeded workflows and execute a run", async ({ page }) => {
        test.setTimeout(TIMEOUTS.long * 3);
        const agentBaseUrl = getAgentBaseUrl();

        await page.goto(`${agentBaseUrl}/workflows`);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("h1")).toContainText("Workflows");
        await expect(page.locator("body")).toContainText(SEEDED_WORKFLOW_NAME);

        await page.goto(`${agentBaseUrl}/workflows/${SEEDED_WORKFLOW_SLUG}/test`);
        await page.waitForLoadState("networkidle");

        const inputArea = page.locator("textarea").first();
        await inputArea.fill(JSON.stringify(SAMPLE_WORKFLOW_INPUT, null, 2));
        await page.getByRole("button", { name: "Run workflow" }).click();

        await expect(page.getByRole("heading", { name: "Output" })).toBeVisible({
            timeout: TIMEOUTS.long
        });
        await expect(page.locator("pre")).toContainText("42", { timeout: TIMEOUTS.long });

        await page.goto(`${agentBaseUrl}/workflows/${SEEDED_WORKFLOW_SLUG}/runs`);
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
        await expect(page.getByPlaceholder("Search runs...")).toBeVisible();
        await expect(page.getByRole("button", { name: "Pause refresh" })).toBeVisible();
        await expect(page.locator("text=Steps:")).toBeVisible({ timeout: TIMEOUTS.long });

        await page.goto(`${agentBaseUrl}/workflows/${SEEDED_WORKFLOW_SLUG}/traces`);
        await page.waitForLoadState("networkidle");
        const workflowRunButton = page.locator("button").first();
        await expect(workflowRunButton).toBeVisible({ timeout: TIMEOUTS.long });
        await workflowRunButton.click();
        await expect(page.locator("text=Trace detail")).toBeVisible();
        await expect(page.locator("text=calculate")).toBeVisible();
    });

    test("should load seeded networks and execute a run", async ({ page }) => {
        test.setTimeout(TIMEOUTS.long * 3);
        const agentBaseUrl = getAgentBaseUrl();

        await page.goto(`${agentBaseUrl}/networks`);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("h1")).toContainText("Networks");
        await expect(page.locator("body")).toContainText(SEEDED_NETWORK_NAME);

        await page.goto(`${agentBaseUrl}/networks/${SEEDED_NETWORK_SLUG}/test`);
        await page.waitForLoadState("networkidle");

        const messageArea = page.locator("textarea").first();
        await messageArea.fill(SAMPLE_NETWORK_MESSAGE);
        await page.getByRole("button", { name: "Run network" }).click();

        await expect(page.getByRole("heading", { name: "Output" })).toBeVisible({
            timeout: TIMEOUTS.long
        });
        await expect(page.locator("pre")).not.toBeEmpty();

        await page.goto(`${agentBaseUrl}/networks/${SEEDED_NETWORK_SLUG}/runs`);
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
        await expect(page.getByPlaceholder("Search runs...")).toBeVisible();
        await expect(page.getByRole("button", { name: "Pause refresh" })).toBeVisible();
        await expect(page.locator("text=Steps:")).toBeVisible({ timeout: TIMEOUTS.long });

        await page.goto(`${agentBaseUrl}/networks/${SEEDED_NETWORK_SLUG}/traces`);
        await page.waitForLoadState("networkidle");
        const networkRunButton = page.locator("button").first();
        await expect(networkRunButton).toBeVisible({ timeout: TIMEOUTS.long });
        await networkRunButton.click();
        await expect(page.locator("text=Trace detail")).toBeVisible();
    });
});
