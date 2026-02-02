import { faker } from "@faker-js/faker";

/**
 * Mock evaluation for testing
 */
export const mockEvaluation = {
    id: "test-eval-uuid",
    runId: "test-run-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    scorerName: "relevancy",
    score: 0.85,
    reason: "The response was relevant to the user's question.",
    metadata: null,
    createdAt: new Date("2024-01-15T10:00:02Z")
};

/**
 * Generate a random evaluation
 */
export function generateEvaluation(overrides: Partial<typeof mockEvaluation> = {}) {
    return {
        ...mockEvaluation,
        id: faker.string.uuid(),
        score: faker.number.float({ min: 0, max: 1, fractionDigits: 2 }),
        reason: faker.lorem.sentence(),
        createdAt: faker.date.recent(),
        ...overrides
    };
}

/**
 * Generate evaluations for different scorers
 */
export function generateEvaluationsForRun(
    runId: string,
    scorers: string[] = ["relevancy", "toxicity", "helpfulness"]
) {
    return scorers.map((scorerName) =>
        generateEvaluation({
            runId,
            scorerName,
            score: faker.number.float({ min: 0.6, max: 1, fractionDigits: 2 })
        })
    );
}

/**
 * Mock feedback
 */
export const mockFeedback = {
    id: "test-feedback-uuid",
    runId: "test-run-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    thumbs: true,
    rating: 5,
    comment: "Great response!",
    userId: "test-user-id",
    createdAt: new Date("2024-01-15T10:01:00Z"),
    updatedAt: new Date("2024-01-15T10:01:00Z")
};

/**
 * Generate random feedback
 */
export function generateFeedback(overrides: Partial<typeof mockFeedback> = {}) {
    return {
        ...mockFeedback,
        id: faker.string.uuid(),
        thumbs: faker.datatype.boolean(),
        rating: faker.number.int({ min: 1, max: 5 }),
        comment: faker.helpers.maybe(() => faker.lorem.sentence()) || null,
        createdAt: faker.date.recent(),
        updatedAt: faker.date.recent(),
        ...overrides
    };
}

/**
 * Mock budget policy
 */
export const mockBudgetPolicy = {
    id: "test-budget-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    enabled: true,
    monthlyLimitUsd: 100.0,
    alertAtPct: 80,
    hardLimit: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

/**
 * Mock cost event
 */
export const mockCostEvent = {
    id: "test-cost-uuid",
    runId: "test-run-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    modelName: "claude-sonnet-4-20250514",
    promptTokens: 150,
    completionTokens: 200,
    totalTokens: 350,
    costUsd: 0.005,
    createdAt: new Date("2024-01-15T10:00:01.5Z")
};

/**
 * Generate cost event
 */
export function generateCostEvent(overrides: Partial<typeof mockCostEvent> = {}) {
    return {
        ...mockCostEvent,
        id: faker.string.uuid(),
        promptTokens: faker.number.int({ min: 100, max: 500 }),
        completionTokens: faker.number.int({ min: 100, max: 1000 }),
        totalTokens: faker.number.int({ min: 200, max: 1500 }),
        costUsd: faker.number.float({ min: 0.001, max: 0.05, fractionDigits: 4 }),
        createdAt: faker.date.recent(),
        ...overrides
    };
}

/**
 * Mock guardrail policy
 */
export const mockGuardrailPolicy = {
    id: "test-guardrail-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    version: 1,
    configJson: {
        maxTokensPerRequest: 4000,
        maxRequestsPerMinute: 60,
        blockedTopics: ["violence", "illegal"],
        sensitiveDataFilters: ["ssn", "credit_card"]
    },
    createdBy: "test-user-id",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

/**
 * Mock guardrail event
 */
export const mockGuardrailEvent = {
    id: "test-guardrail-event-uuid",
    runId: "test-run-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    eventType: "BLOCKED" as const,
    ruleName: "blocked-topics",
    inputText: "Tell me how to...",
    outputText: null,
    metadata: { topic: "violence" },
    createdAt: new Date("2024-01-15T10:00:00Z")
};

/**
 * Mock agent alert
 */
export const mockAlert = {
    id: "test-alert-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    severity: "WARNING" as const,
    source: "BUDGET" as const,
    title: "Budget threshold reached",
    message: "Agent has used 80% of monthly budget",
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date("2024-01-15T10:00:00Z")
};

/**
 * Mock agent version
 */
export const mockVersion = {
    id: "test-version-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    version: 1,
    description: "Initial version",
    instructions: "You are a helpful assistant",
    modelProvider: "anthropic",
    modelName: "claude-sonnet-4-20250514",
    changesJson: null,
    snapshot: {
        name: "Test Agent",
        instructions: "You are a helpful assistant",
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        tools: []
    },
    createdBy: "test-user-id",
    createdAt: new Date("2024-01-01")
};

/**
 * Mock test case
 */
export const mockTestCase = {
    id: "test-case-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    name: "Basic greeting test",
    inputText: "Hello!",
    expectedOutput: "Hi there! How can I help you?",
    tags: ["greeting", "basic"],
    createdBy: "test-user-id",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};
