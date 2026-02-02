import { Page, Locator, expect } from "@playwright/test";
import { TIMEOUTS } from "../fixtures/test-data";

/**
 * Runs Page Object Model
 *
 * Encapsulates interactions with the Agent Runs page (/workspace/[agentSlug]/runs)
 */
export class RunsPage {
    readonly page: Page;

    // Main elements
    readonly header: Locator;
    readonly searchInput: Locator;
    readonly statusFilter: Locator;
    readonly exportButton: Locator;

    // Runs list
    readonly runsList: Locator;
    readonly runItems: Locator;

    // Run detail panel
    readonly detailPanel: Locator;
    readonly detailStatus: Locator;
    readonly detailInput: Locator;
    readonly detailOutput: Locator;

    // Actions
    readonly viewTraceButton: Locator;
    readonly rerunButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Header elements - page title is "Run History"
        this.header = page.locator('h1:has-text("Run History")');
        this.searchInput = page.locator(
            '[data-testid="runs-search"], input[placeholder*="Search"]'
        );
        this.statusFilter = page
            .locator('[data-testid="status-filter"], button:has-text("Status")')
            .first();
        this.exportButton = page.locator('button:has-text("Export")');

        // Runs list
        this.runsList = page.locator('[data-testid="runs-list"], .space-y-2');
        this.runItems = page.locator('[data-testid="run-item"], .rounded-lg.border.p-3');

        // Detail panel
        this.detailPanel = page.locator('[data-testid="run-detail"], .lg\\:col-span-2');
        this.detailStatus = page.locator('[data-testid="run-status"]');
        this.detailInput = page.locator('[data-testid="run-input"]');
        this.detailOutput = page.locator('[data-testid="run-output"]');

        // Actions
        this.viewTraceButton = page.locator('button:has-text("View Full Trace")');
        this.rerunButton = page.locator('button:has-text("Re-run")');
    }

    /**
     * Navigate to the runs page for a specific agent
     * Note: Agent app runs on port 3001 in dev:local mode (without /agent prefix)
     */
    async goto(agentSlug: string) {
        const agentBaseUrl = process.env.PLAYWRIGHT_AGENT_URL || "http://localhost:3001";
        const pathPrefix = agentBaseUrl.includes("catalyst.localhost") ? "/agent" : "";
        await this.page.goto(`${agentBaseUrl}${pathPrefix}/workspace/${agentSlug}/runs`);
        await this.page.waitForLoadState("networkidle");
        await expect(this.header).toBeVisible({ timeout: TIMEOUTS.medium });
    }

    /**
     * Get the count of runs in the list
     */
    async getRunCount(): Promise<number> {
        return await this.runItems.count();
    }

    /**
     * Check if a run exists with specific input text
     */
    async hasRunWithInput(inputText: string): Promise<boolean> {
        const runs = await this.runItems.all();
        for (const run of runs) {
            const text = await run.textContent();
            if (text && text.includes(inputText)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Click on a run to view details
     */
    async selectRun(index: number) {
        const runs = await this.runItems.all();
        if (index < runs.length) {
            await runs[index].click();
            await this.page.waitForTimeout(300);
        }
    }

    /**
     * Select a run by input text
     */
    async selectRunByInput(inputText: string) {
        const run = this.runItems.filter({ hasText: inputText }).first();
        await run.click();
        await this.page.waitForTimeout(300);
    }

    /**
     * Search for runs
     */
    async search(query: string) {
        await this.searchInput.fill(query);
        await this.page.waitForTimeout(500);
    }

    /**
     * Clear search
     */
    async clearSearch() {
        await this.searchInput.clear();
        await this.page.waitForTimeout(500);
    }

    /**
     * Filter by status
     */
    async filterByStatus(status: "all" | "completed" | "failed" | "timeout") {
        await this.statusFilter.click();
        await this.page.locator(`[role="option"]:has-text("${status}")`).click();
        await this.page.waitForTimeout(500);
    }

    /**
     * Get the first run's status
     */
    async getFirstRunStatus(): Promise<string> {
        const firstRun = this.runItems.first();
        const badge = firstRun.locator('[class*="Badge"], .inline-flex');
        return (await badge.textContent()) || "";
    }

    /**
     * View the trace for the selected run
     */
    async viewTrace() {
        await this.viewTraceButton.click();
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Re-run the selected run
     */
    async rerun() {
        await this.rerunButton.click();
        await this.page.waitForTimeout(500);
    }

    /**
     * Check if the page is loaded
     */
    async isLoaded(): Promise<boolean> {
        return await this.header.isVisible();
    }

    /**
     * Wait for runs to load
     */
    async waitForRuns(timeout: number = TIMEOUTS.medium) {
        await expect(this.runItems.first()).toBeVisible({ timeout });
    }

    /**
     * Get the most recent run's timestamp
     */
    async getMostRecentRunTime(): Promise<string | null> {
        const firstRun = this.runItems.first();
        const timeElement = firstRun.locator("time, .text-muted-foreground");
        return await timeElement.textContent();
    }
}
