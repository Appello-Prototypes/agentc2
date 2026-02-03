import { Page, Locator, expect } from "@playwright/test";
import { TIMEOUTS } from "../fixtures/test-data";

/**
 * Test Page Object Model
 *
 * Encapsulates interactions with the Agent Test page (/workspace/[agentSlug]/test)
 */
export class TestPage {
    readonly page: Page;

    // Main elements
    readonly chatInput: Locator;
    readonly sendButton: Locator;
    readonly clearChatButton: Locator;
    readonly messagesContainer: Locator;

    // Message elements
    readonly userMessages: Locator;
    readonly assistantMessages: Locator;
    readonly sendingIndicator: Locator;

    // Tabs
    readonly chatTab: Locator;
    readonly testCasesTab: Locator;
    readonly comparisonTab: Locator;

    // Context variables
    readonly userIdInput: Locator;
    readonly userNameInput: Locator;
    readonly userEmailInput: Locator;

    // Test cases
    readonly runAllTestsButton: Locator;
    readonly addTestCaseButton: Locator;

    // Feedback buttons
    readonly feedbackThumbsUp: Locator;
    readonly feedbackThumbsDown: Locator;

    constructor(page: Page) {
        this.page = page;

        // Chat elements - using data-testid attributes
        this.chatInput = page.locator('[data-testid="chat-input"]');
        this.sendButton = page.locator('[data-testid="send-button"]');
        this.clearChatButton = page.locator('[data-testid="clear-chat"]');
        this.messagesContainer = page.locator('[data-testid="messages-container"]');

        // Messages
        this.userMessages = page.locator('[data-testid="user-message"]');
        this.assistantMessages = page.locator('[data-testid="assistant-message"]');
        this.sendingIndicator = page.locator('[data-testid="sending-indicator"]');

        // Tabs
        this.chatTab = page.locator('[role="tab"]:has-text("Interactive Chat")');
        this.testCasesTab = page.locator('[role="tab"]:has-text("Test Cases")');
        this.comparisonTab = page.locator('[role="tab"]:has-text("A/B Comparison")');

        // Context variables
        this.userIdInput = page.locator("input").filter({
            has: page.locator(":scope").locator("..").locator('label:has-text("User ID")')
        });
        this.userNameInput = page.locator("input").filter({
            has: page.locator(":scope").locator("..").locator('label:has-text("User Name")')
        });
        this.userEmailInput = page.locator("input").filter({
            has: page.locator(":scope").locator("..").locator('label:has-text("User Email")')
        });

        // Test cases tab
        this.runAllTestsButton = page.locator('button:has-text("Run All Tests")');
        this.addTestCaseButton = page.locator('button:has-text("Add Test Case")');

        // Feedback buttons - only visible on the last assistant message
        this.feedbackThumbsUp = page.locator('[data-testid="feedback-thumbs-up"]');
        this.feedbackThumbsDown = page.locator('[data-testid="feedback-thumbs-down"]');
    }

    /**
     * Navigate to the test page for a specific agent
     * Note: Agent app runs on port 3001 in dev:local mode (without /agent prefix)
     * With Caddy (catalyst.localhost), routes include /agent prefix
     */
    async goto(agentSlug: string) {
        const agentBaseUrl = process.env.PLAYWRIGHT_AGENT_URL || "http://localhost:3001";
        // In dev:local mode, no /agent prefix; with Caddy, use /agent prefix
        const pathPrefix = agentBaseUrl.includes("catalyst.localhost") ? "/agent" : "";
        await this.page.goto(`${agentBaseUrl}${pathPrefix}/workspace/${agentSlug}/test`);
        await this.page.waitForLoadState("networkidle");
        // Wait for the page to finish loading
        await expect(this.page.locator('h1:has-text("Testing Sandbox")')).toBeVisible({
            timeout: TIMEOUTS.medium
        });
    }

    /**
     * Send a message in the chat
     */
    async sendMessage(message: string) {
        await this.chatInput.fill(message);
        await expect(this.sendButton).toBeEnabled();
        await this.sendButton.click();
    }

    /**
     * Wait for the assistant to respond
     */
    async waitForResponse(timeout: number = TIMEOUTS.response) {
        // Wait for sending indicator to appear
        await expect(this.sendingIndicator)
            .toBeVisible({ timeout: TIMEOUTS.short })
            .catch(() => {
                // Indicator might have already disappeared if response was fast
            });

        // Wait for sending indicator to disappear
        await expect(this.sendingIndicator).not.toBeVisible({ timeout });

        // Wait a bit for the message to render
        await this.page.waitForTimeout(500);
    }

    /**
     * Get the last assistant message content
     */
    async getLastAssistantMessage(): Promise<string> {
        const messages = await this.assistantMessages.all();
        if (messages.length === 0) {
            return "";
        }
        const lastMessage = messages[messages.length - 1];
        return (await lastMessage.textContent()) || "";
    }

    /**
     * Get the count of assistant messages
     */
    async getAssistantMessageCount(): Promise<number> {
        return await this.assistantMessages.count();
    }

    /**
     * Get the count of user messages
     */
    async getUserMessageCount(): Promise<number> {
        return await this.userMessages.count();
    }

    /**
     * Clear the chat
     */
    async clearChat() {
        await this.clearChatButton.click();
    }

    /**
     * Check if the chat is empty
     */
    async isChatEmpty(): Promise<boolean> {
        const userCount = await this.getUserMessageCount();
        const assistantCount = await this.getAssistantMessageCount();
        return userCount === 0 && assistantCount === 0;
    }

    /**
     * Switch to a specific tab
     */
    async switchToTab(tab: "chat" | "cases" | "comparison") {
        switch (tab) {
            case "chat":
                await this.chatTab.click();
                break;
            case "cases":
                await this.testCasesTab.click();
                break;
            case "comparison":
                await this.comparisonTab.click();
                break;
        }
        await this.page.waitForTimeout(300);
    }

    /**
     * Set context variable value
     */
    async setContextVariable(variable: "userId" | "userName" | "userEmail", value: string) {
        const input = {
            userId: this.userIdInput,
            userName: this.userNameInput,
            userEmail: this.userEmailInput
        }[variable];

        await input.clear();
        await input.fill(value);
    }

    /**
     * Run all test cases
     */
    async runAllTestCases() {
        await this.switchToTab("cases");
        await this.runAllTestsButton.click();
        // Wait for tests to complete
        await expect(this.runAllTestsButton).toBeEnabled({ timeout: TIMEOUTS.long });
    }

    /**
     * Check if the page is loaded
     */
    async isLoaded(): Promise<boolean> {
        return await this.page.locator('h1:has-text("Testing Sandbox")').isVisible();
    }

    /**
     * Submit positive feedback (thumbs up) on the last assistant message
     */
    async submitPositiveFeedback() {
        await expect(this.feedbackThumbsUp).toBeVisible({ timeout: TIMEOUTS.short });
        await this.feedbackThumbsUp.click();
        // Wait for the feedback to be submitted (button gets green color)
        await this.page.waitForTimeout(300);
    }

    /**
     * Submit negative feedback (thumbs down) on the last assistant message
     */
    async submitNegativeFeedback() {
        await expect(this.feedbackThumbsDown).toBeVisible({ timeout: TIMEOUTS.short });
        await this.feedbackThumbsDown.click();
        // Wait for the feedback to be submitted (button gets red color)
        await this.page.waitForTimeout(300);
    }

    /**
     * Check if feedback buttons are visible
     */
    async areFeedbackButtonsVisible(): Promise<boolean> {
        const thumbsUpVisible = await this.feedbackThumbsUp.isVisible();
        const thumbsDownVisible = await this.feedbackThumbsDown.isVisible();
        return thumbsUpVisible && thumbsDownVisible;
    }

    /**
     * Check if positive feedback is selected (has green color)
     */
    async isPositiveFeedbackSelected(): Promise<boolean> {
        const className = await this.feedbackThumbsUp.locator("svg").getAttribute("class");
        return className?.includes("text-green-500") ?? false;
    }

    /**
     * Check if negative feedback is selected (has red color)
     */
    async isNegativeFeedbackSelected(): Promise<boolean> {
        const className = await this.feedbackThumbsDown.locator("svg").getAttribute("class");
        return className?.includes("text-red-500") ?? false;
    }
}
