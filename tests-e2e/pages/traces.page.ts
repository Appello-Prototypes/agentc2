import { Page, Locator, expect } from "@playwright/test";
import { TIMEOUTS } from "../fixtures/test-data";

/**
 * Traces Page Object Model
 *
 * Encapsulates interactions with the Agent Traces page (/workspace/[agentSlug]/traces)
 */
export class TracesPage {
    readonly page: Page;

    // Main elements
    readonly header: Locator;
    readonly searchInput: Locator;

    // Trace list
    readonly traceList: Locator;
    readonly traceItems: Locator;

    // Trace detail
    readonly detailPanel: Locator;
    readonly timeline: Locator;
    readonly timelineSteps: Locator;
    readonly toolCallsAccordion: Locator;

    // Actions
    readonly replayButton: Locator;
    readonly exportButton: Locator;
    readonly copyJsonButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Header elements
        this.header = page.locator('h1:has-text("Trace Explorer")');
        this.searchInput = page.locator('input[placeholder*="Search"]');

        // Trace list
        this.traceList = page.locator('[data-testid="trace-list"]');
        this.traceItems = page.locator('[data-testid="trace-item"], .rounded-lg.border.p-3');

        // Trace detail
        this.detailPanel = page.locator('[data-testid="trace-detail"]');
        this.timeline = page.locator('[data-testid="execution-timeline"]');
        this.timelineSteps = page.locator('[data-testid="timeline-step"]');
        this.toolCallsAccordion = page.locator('[data-testid="tool-calls"]');

        // Actions
        this.replayButton = page.locator('button:has-text("Replay")');
        this.exportButton = page.locator('button:has-text("Export")');
        this.copyJsonButton = page.locator('button:has-text("Copy JSON")');
    }

    /**
     * Navigate to the traces page for a specific agent
     * Note: Agent app runs on port 3001 in dev:local mode (without /agent prefix)
     */
    async goto(agentSlug: string) {
        const agentBaseUrl = process.env.PLAYWRIGHT_AGENT_URL || "http://localhost:3001";
        const pathPrefix = agentBaseUrl.includes("catalyst.localhost") ? "/agent" : "";
        await this.page.goto(`${agentBaseUrl}${pathPrefix}/workspace/${agentSlug}/traces`);
        await this.page.waitForLoadState("networkidle");
        await expect(this.header).toBeVisible({ timeout: TIMEOUTS.medium });
    }

    /**
     * Get the count of traces in the list
     */
    async getTraceCount(): Promise<number> {
        return await this.traceItems.count();
    }

    /**
     * Select a trace by index
     */
    async selectTrace(index: number) {
        const traces = await this.traceItems.all();
        if (index < traces.length) {
            await traces[index].click();
            await this.page.waitForTimeout(300);
        }
    }

    /**
     * Search for traces
     */
    async search(query: string) {
        await this.searchInput.fill(query);
        await this.page.waitForTimeout(500);
    }

    /**
     * Get the number of steps in the timeline
     */
    async getTimelineStepCount(): Promise<number> {
        return await this.timelineSteps.count();
    }

    /**
     * Check if the trace detail is visible
     */
    async isDetailVisible(): Promise<boolean> {
        return await this.detailPanel.isVisible();
    }

    /**
     * Check if the page is loaded
     */
    async isLoaded(): Promise<boolean> {
        return await this.header.isVisible();
    }

    /**
     * Wait for traces to load
     */
    async waitForTraces(timeout: number = TIMEOUTS.medium) {
        await expect(this.traceItems.first()).toBeVisible({ timeout });
    }
}
