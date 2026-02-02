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
