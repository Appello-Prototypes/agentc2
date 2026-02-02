import { Page, Locator, expect } from "@playwright/test";
import { TIMEOUTS } from "../fixtures/test-data";

/**
 * Workspace Page Object Model
 *
 * Encapsulates interactions with the Workspace pages:
 * - Agent list (/agent/workspace)
 * - Agent overview (/agent/workspace/[agentSlug]/overview)
 * - Navigation between workspace tabs
 */
export class WorkspacePage {
    readonly page: Page;

    // Agent list elements
    readonly agentListHeader: Locator;
    readonly agentCards: Locator;
    readonly searchInput: Locator;
    readonly createAgentButton: Locator;

    // Agent detail navigation
    readonly overviewTab: Locator;
    readonly configureTab: Locator;
    readonly testTab: Locator;
    readonly runsTab: Locator;
    readonly analyticsTab: Locator;
    readonly tracesTab: Locator;
    readonly evaluationsTab: Locator;
    readonly costsTab: Locator;
    readonly versionsTab: Locator;
    readonly guardrailsTab: Locator;

    // Overview elements
    readonly overviewHeader: Locator;
    readonly kpiCards: Locator;
    readonly recentActivity: Locator;
    readonly alertsPanel: Locator;

    constructor(page: Page) {
        this.page = page;

        // Agent list
        this.agentListHeader = page.locator('h1:has-text("Agent Workspace")');
        this.agentCards = page.locator('[data-testid="agent-card"]');
        this.searchInput = page.locator('input[placeholder*="Search agents"]');
        this.createAgentButton = page.locator('button:has-text("Create Agent")');

        // Navigation tabs - using sidebar navigation
        this.overviewTab = page.locator('a[href*="/overview"], [role="link"]:has-text("Overview")');
        this.configureTab = page.locator(
            'a[href*="/configure"], [role="link"]:has-text("Configure")'
        );
        this.testTab = page.locator('a[href*="/test"], [role="link"]:has-text("Test")');
        this.runsTab = page.locator('a[href*="/runs"], [role="link"]:has-text("Runs")');
        this.analyticsTab = page.locator(
            'a[href*="/analytics"], [role="link"]:has-text("Analytics")'
        );
        this.tracesTab = page.locator('a[href*="/traces"], [role="link"]:has-text("Traces")');
        this.evaluationsTab = page.locator(
            'a[href*="/evaluations"], [role="link"]:has-text("Evaluations")'
        );
        this.costsTab = page.locator('a[href*="/costs"], [role="link"]:has-text("Costs")');
        this.versionsTab = page.locator('a[href*="/versions"], [role="link"]:has-text("Versions")');
        this.guardrailsTab = page.locator(
            'a[href*="/guardrails"], [role="link"]:has-text("Guardrails")'
        );

        // Overview elements
        this.overviewHeader = page.locator('h1:has-text("Overview")');
        this.kpiCards = page.locator('[data-testid="kpi-card"]');
        this.recentActivity = page.locator('[data-testid="recent-activity"]');
        this.alertsPanel = page.locator('[data-testid="alerts-panel"]');
    }

    /**
     * Get the agent app base URL
     * Note: Agent app runs on port 3001 in dev:local mode (without /agent prefix)
     */
    private getAgentBaseUrl(): string {
        return process.env.PLAYWRIGHT_AGENT_URL || "http://localhost:3001";
    }

    /**
     * Get the path prefix based on environment
     */
    private getPathPrefix(): string {
        return this.getAgentBaseUrl().includes("catalyst.localhost") ? "/agent" : "";
    }

    /**
     * Navigate to the workspace agent list
     */
    async gotoAgentList() {
        await this.page.goto(`${this.getAgentBaseUrl()}${this.getPathPrefix()}/workspace`);
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Navigate to a specific agent's overview
     */
    async gotoAgentOverview(agentSlug: string) {
        await this.page.goto(
            `${this.getAgentBaseUrl()}${this.getPathPrefix()}/workspace/${agentSlug}/overview`
        );
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Select an agent from the list by clicking its card
     */
    async selectAgent(agentSlug: string) {
        const agentCard = this.page
            .locator(
                `[data-testid="agent-card"][data-slug="${agentSlug}"], a[href*="${agentSlug}"]`
            )
            .first();
        await agentCard.click();
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Navigate to a workspace tab
     */
    async navigateToTab(
        tab:
            | "overview"
            | "configure"
            | "test"
            | "runs"
            | "analytics"
            | "traces"
            | "evaluations"
            | "costs"
            | "versions"
            | "guardrails"
    ) {
        const tabMap = {
            overview: this.overviewTab,
            configure: this.configureTab,
            test: this.testTab,
            runs: this.runsTab,
            analytics: this.analyticsTab,
            traces: this.tracesTab,
            evaluations: this.evaluationsTab,
            costs: this.costsTab,
            versions: this.versionsTab,
            guardrails: this.guardrailsTab
        };

        await tabMap[tab].click();
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Search for an agent
     */
    async searchAgent(query: string) {
        await this.searchInput.fill(query);
        await this.page.waitForTimeout(500);
    }

    /**
     * Get the count of agent cards
     */
    async getAgentCount(): Promise<number> {
        return await this.agentCards.count();
    }

    /**
     * Check if an agent exists in the list
     */
    async hasAgent(agentSlug: string): Promise<boolean> {
        const agent = this.page.locator(
            `[data-testid="agent-card"][data-slug="${agentSlug}"], a[href*="${agentSlug}"]`
        );
        return await agent.isVisible();
    }

    /**
     * Get the current URL path
     */
    getCurrentPath(): string {
        return new URL(this.page.url()).pathname;
    }

    /**
     * Check if we're on the agent list page
     */
    async isOnAgentList(): Promise<boolean> {
        return await this.agentListHeader.isVisible();
    }

    /**
     * Check if we're on an agent overview page
     */
    async isOnAgentOverview(): Promise<boolean> {
        return this.getCurrentPath().includes("/overview");
    }

    /**
     * Wait for the page to load
     */
    async waitForLoad(timeout: number = TIMEOUTS.medium) {
        await this.page.waitForLoadState("networkidle", { timeout });
    }
}
