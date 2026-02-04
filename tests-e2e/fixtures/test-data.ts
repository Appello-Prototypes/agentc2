/**
 * Test Data for E2E Tests
 *
 * Contains sample data used across E2E tests.
 * Update these values to match your test environment.
 */

/**
 * Test agent slug - should be an agent that exists in your test database
 * You can use the "assistant" system agent or create a test agent
 */
export const TEST_AGENT_SLUG = process.env.TEST_AGENT_SLUG || "assistant";

/**
 * Seeded workflow/network slugs used in workspace validation tests
 */
export const SEEDED_WORKFLOW_SLUG = process.env.TEST_WORKFLOW_SLUG || "sample-cost-estimate";
export const SEEDED_WORKFLOW_NAME = process.env.TEST_WORKFLOW_NAME || "Cost Estimate Calculator";
export const SEEDED_NETWORK_SLUG = process.env.TEST_NETWORK_SLUG || "sample-ops-router";
export const SEEDED_NETWORK_NAME = process.env.TEST_NETWORK_NAME || "Operations Support Router";

/**
 * Sample inputs for seeded workflow/network execution
 */
export const SAMPLE_WORKFLOW_INPUT = {
    expression: "21 + 21"
};

export const SAMPLE_NETWORK_MESSAGE = "Can you calculate 1250 / 5 and share the result?";

/**
 * Sample chat messages for testing
 */
export const SAMPLE_MESSAGES = {
    greeting: "Hello! How are you today?",
    simple_question: "What is 2 + 2?",
    tool_usage: "What's the weather like today?",
    long_message:
        "Can you explain the concept of machine learning in simple terms? " +
        "I'm particularly interested in understanding how neural networks work " +
        "and what makes them effective for pattern recognition tasks."
};

/**
 * Expected response patterns (for validation)
 */
export const EXPECTED_PATTERNS = {
    greeting_response: /hello|hi|greetings/i,
    math_response: /4|four/i,
    error_response: /error|sorry|unable/i
};

/**
 * Timeout values
 */
export const TIMEOUTS = {
    short: 5000,
    medium: 15000,
    long: 30000,
    response: 60000 // Agent responses can take a while
};

/**
 * Test user context variables
 */
export const TEST_CONTEXT = {
    userId: "test-user-123",
    userName: "Test User",
    userEmail: "test@example.com"
};
