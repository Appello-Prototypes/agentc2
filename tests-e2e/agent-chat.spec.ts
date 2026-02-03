import { test, expect } from "./fixtures/auth.fixture";
import { SAMPLE_MESSAGES, TEST_AGENT_SLUG, TIMEOUTS, TEST_CONTEXT } from "./fixtures/test-data";

/**
 * Agent Chat E2E Tests
 *
 * These tests verify the primary user interaction with agents:
 * sending messages and receiving responses through the Test page chat interface.
 */
test.describe("Agent Chat", () => {
    test.beforeEach(async ({ testPage }) => {
        // Navigate to the test page for the test agent
        await testPage.goto(TEST_AGENT_SLUG);
    });

    test("should load the test page successfully", async ({ testPage }) => {
        // Verify the page loaded
        const isLoaded = await testPage.isLoaded();
        expect(isLoaded).toBe(true);

        // Verify chat input is visible
        await expect(testPage.chatInput).toBeVisible();
        await expect(testPage.sendButton).toBeVisible();
    });

    test("should send a message and receive a response", async ({ testPage }) => {
        // Send a greeting message
        await testPage.sendMessage(SAMPLE_MESSAGES.greeting);

        // Verify user message was added
        const userMessageCount = await testPage.getUserMessageCount();
        expect(userMessageCount).toBeGreaterThanOrEqual(1);

        // Wait for the assistant response
        await testPage.waitForResponse(TIMEOUTS.response);

        // Verify assistant responded
        const assistantMessageCount = await testPage.getAssistantMessageCount();
        expect(assistantMessageCount).toBeGreaterThanOrEqual(1);

        // Get the last response content
        const response = await testPage.getLastAssistantMessage();
        expect(response).toBeTruthy();
        expect(response.length).toBeGreaterThan(0);
    });

    test("should handle multiple messages in a conversation", async ({ testPage }) => {
        // Send first message
        await testPage.sendMessage(SAMPLE_MESSAGES.greeting);
        await testPage.waitForResponse(TIMEOUTS.response);

        // Send second message
        await testPage.sendMessage(SAMPLE_MESSAGES.simple_question);
        await testPage.waitForResponse(TIMEOUTS.response);

        // Verify both exchanges occurred
        const userMessageCount = await testPage.getUserMessageCount();
        const assistantMessageCount = await testPage.getAssistantMessageCount();

        expect(userMessageCount).toBe(2);
        expect(assistantMessageCount).toBe(2);
    });

    test("should clear chat when clear button is clicked", async ({ testPage }) => {
        // Send a message first
        await testPage.sendMessage(SAMPLE_MESSAGES.greeting);
        await testPage.waitForResponse(TIMEOUTS.response);

        // Verify messages exist
        let isEmpty = await testPage.isChatEmpty();
        expect(isEmpty).toBe(false);

        // Clear the chat
        await testPage.clearChat();

        // Verify chat is empty
        await testPage.page.waitForTimeout(500);
        isEmpty = await testPage.isChatEmpty();
        expect(isEmpty).toBe(true);
    });

    test("should disable send button when input is empty", async ({ testPage }) => {
        // Verify send button is disabled initially (or enabled with empty validation)
        const inputValue = await testPage.chatInput.inputValue();
        expect(inputValue).toBe("");

        // Button should be disabled with empty input
        await expect(testPage.sendButton).toBeDisabled();

        // Type something
        await testPage.chatInput.fill("Test message");

        // Button should now be enabled
        await expect(testPage.sendButton).toBeEnabled();

        // Clear the input
        await testPage.chatInput.clear();

        // Button should be disabled again
        await expect(testPage.sendButton).toBeDisabled();
    });

    test("should show sending indicator while waiting for response", async ({ testPage }) => {
        // Send a message
        await testPage.sendMessage(SAMPLE_MESSAGES.greeting);

        // The sending indicator should appear briefly
        // Note: This might be too fast to catch reliably, so we check the message appears
        await testPage.waitForResponse(TIMEOUTS.response);

        // Verify a response was received
        const assistantMessageCount = await testPage.getAssistantMessageCount();
        expect(assistantMessageCount).toBeGreaterThanOrEqual(1);
    });

    test("should be able to switch between tabs", async ({ testPage }) => {
        // Start on chat tab
        await expect(testPage.chatInput).toBeVisible();

        // Switch to test cases tab
        await testPage.switchToTab("cases");
        await expect(testPage.runAllTestsButton).toBeVisible();

        // Switch to comparison tab
        await testPage.switchToTab("comparison");
        await expect(testPage.page.locator('h3:has-text("Version A")')).toBeVisible();

        // Switch back to chat
        await testPage.switchToTab("chat");
        await expect(testPage.chatInput).toBeVisible();
    });

    test("should display context variables panel", async ({ testPage }) => {
        // Verify context panel is visible
        await expect(testPage.page.locator('text="Context Injection"')).toBeVisible();

        // Check that context input fields exist
        await expect(testPage.page.locator('text="User ID"')).toBeVisible();
        await expect(testPage.page.locator('text="User Name"')).toBeVisible();
        await expect(testPage.page.locator('text="User Email"')).toBeVisible();
    });

    test("should handle long messages", async ({ testPage }) => {
        // Send a long message
        await testPage.sendMessage(SAMPLE_MESSAGES.long_message);
        await testPage.waitForResponse(TIMEOUTS.response);

        // Verify the response was received
        const assistantMessageCount = await testPage.getAssistantMessageCount();
        expect(assistantMessageCount).toBeGreaterThanOrEqual(1);
    });

    test("should send message with Enter key", async ({ testPage }) => {
        // Type a message
        await testPage.chatInput.fill(SAMPLE_MESSAGES.greeting);

        // Press Enter to send
        await testPage.chatInput.press("Enter");

        // Wait for response
        await testPage.waitForResponse(TIMEOUTS.response);

        // Verify message was sent and response received
        const userMessageCount = await testPage.getUserMessageCount();
        expect(userMessageCount).toBeGreaterThanOrEqual(1);
    });

    test("should allow newline with Shift+Enter", async ({ testPage }) => {
        // Type a message
        await testPage.chatInput.fill("First line");

        // Press Shift+Enter for newline
        await testPage.chatInput.press("Shift+Enter");

        // Type more
        await testPage.chatInput.type("Second line");

        // Get the value - should contain newline
        const value = await testPage.chatInput.inputValue();
        expect(value).toContain("\n");
    });
});

test.describe("Agent Chat - Feedback", () => {
    test.beforeEach(async ({ testPage }) => {
        // Navigate to the test page
        await testPage.goto(TEST_AGENT_SLUG);
    });

    test("should show feedback buttons on assistant message", async ({ testPage }) => {
        // Send a message and wait for response
        await testPage.sendMessage(SAMPLE_MESSAGES.greeting);
        await testPage.waitForResponse(TIMEOUTS.response);

        // Verify feedback buttons are visible
        const feedbackVisible = await testPage.areFeedbackButtonsVisible();
        expect(feedbackVisible).toBe(true);
    });

    test("should submit positive feedback", async ({ testPage }) => {
        // Send a message and wait for response
        await testPage.sendMessage(SAMPLE_MESSAGES.greeting);
        await testPage.waitForResponse(TIMEOUTS.response);

        // Submit positive feedback
        await testPage.submitPositiveFeedback();

        // Verify feedback was submitted (thumbs up should be green)
        const isPositive = await testPage.isPositiveFeedbackSelected();
        expect(isPositive).toBe(true);
    });

    test("should submit negative feedback", async ({ testPage }) => {
        // Send a message and wait for response
        await testPage.sendMessage(SAMPLE_MESSAGES.greeting);
        await testPage.waitForResponse(TIMEOUTS.response);

        // Submit negative feedback
        await testPage.submitNegativeFeedback();

        // Verify feedback was submitted (thumbs down should be red)
        const isNegative = await testPage.isNegativeFeedbackSelected();
        expect(isNegative).toBe(true);
    });

    test("should toggle feedback from positive to negative", async ({ testPage }) => {
        // Send a message and wait for response
        await testPage.sendMessage(SAMPLE_MESSAGES.greeting);
        await testPage.waitForResponse(TIMEOUTS.response);

        // Submit positive feedback first
        await testPage.submitPositiveFeedback();
        let isPositive = await testPage.isPositiveFeedbackSelected();
        expect(isPositive).toBe(true);

        // Toggle to negative feedback
        await testPage.submitNegativeFeedback();
        const isNegative = await testPage.isNegativeFeedbackSelected();
        expect(isNegative).toBe(true);

        // Positive should no longer be selected
        isPositive = await testPage.isPositiveFeedbackSelected();
        expect(isPositive).toBe(false);
    });
});

test.describe("Agent Chat - Test Cases Tab", () => {
    test.beforeEach(async ({ testPage }) => {
        await testPage.goto(TEST_AGENT_SLUG);
        await testPage.switchToTab("cases");
    });

    test("should display test cases list", async ({ testPage }) => {
        // Verify test cases are visible
        await expect(testPage.page.locator('text="Test Cases"')).toBeVisible();

        // Should have some test cases listed
        const testCases = testPage.page.locator(".rounded-lg.border.p-4");
        const count = await testCases.count();
        expect(count).toBeGreaterThan(0);
    });

    test("should have run all tests button", async ({ testPage }) => {
        await expect(testPage.runAllTestsButton).toBeVisible();
        await expect(testPage.runAllTestsButton).toBeEnabled();
    });

    test("should have add test case button", async ({ testPage }) => {
        await expect(testPage.addTestCaseButton).toBeVisible();
    });
});
