import { faker } from "@faker-js/faker";

/**
 * Base mock run for testing
 */
export const mockRun = {
    id: "test-run-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    status: "COMPLETED" as const,
    runType: "INTERACTIVE" as const,
    inputText: "Hello, how can you help me today?",
    outputText: "I'm a helpful AI assistant. I can help you with various tasks.",
    durationMs: 1500,
    promptTokens: 150,
    completionTokens: 200,
    totalTokens: 350,
    costUsd: 0.005,
    modelName: "claude-sonnet-4-20250514",
    versionId: null,
    userId: "test-user-id",
    sessionId: null,
    contextVarsJson: null,
    startedAt: new Date("2024-01-15T10:00:00Z"),
    completedAt: new Date("2024-01-15T10:00:01.5Z"),
    createdAt: new Date("2024-01-15T10:00:00Z")
};

/**
 * Running run (in progress)
 */
export const mockRunningRun = {
    ...mockRun,
    id: "running-run-uuid",
    status: "RUNNING" as const,
    outputText: null,
    completedAt: null,
    durationMs: null
};

/**
 * Failed run
 */
export const mockFailedRun = {
    ...mockRun,
    id: "failed-run-uuid",
    status: "FAILED" as const,
    outputText: null,
    completedAt: new Date("2024-01-15T10:00:02Z"),
    durationMs: 2000
};

/**
 * Generate a random run
 */
export function generateRun(overrides: Partial<typeof mockRun> = {}) {
    const startedAt = faker.date.recent();
    const durationMs = faker.number.int({ min: 500, max: 5000 });
    const completedAt = new Date(startedAt.getTime() + durationMs);

    return {
        ...mockRun,
        id: faker.string.uuid(),
        inputText: faker.lorem.sentence(),
        outputText: faker.lorem.paragraph(),
        durationMs,
        promptTokens: faker.number.int({ min: 100, max: 500 }),
        completionTokens: faker.number.int({ min: 100, max: 1000 }),
        totalTokens: faker.number.int({ min: 200, max: 1500 }),
        costUsd: faker.number.float({ min: 0.001, max: 0.05, fractionDigits: 4 }),
        startedAt,
        completedAt,
        createdAt: startedAt,
        ...overrides
    };
}

/**
 * Generate multiple runs
 */
export function generateRuns(count: number, overrides: Partial<typeof mockRun> = {}) {
    return Array.from({ length: count }, () => generateRun(overrides));
}

/**
 * Mock trace for a run
 */
export const mockTrace = {
    id: "test-trace-uuid",
    runId: "test-run-uuid",
    agentId: "test-agent-uuid",
    tenantId: "test-tenant",
    status: "COMPLETED" as const,
    inputText: "Hello, how can you help me today?",
    outputText: "I'm a helpful AI assistant.",
    durationMs: 1500,
    tokensJson: { promptTokens: 150, completionTokens: 200, totalTokens: 350 },
    metadata: null,
    startedAt: new Date("2024-01-15T10:00:00Z"),
    completedAt: new Date("2024-01-15T10:00:01.5Z"),
    createdAt: new Date("2024-01-15T10:00:00Z")
};

/**
 * Mock trace step
 */
export const mockTraceStep = {
    id: "test-step-uuid",
    traceId: "test-trace-uuid",
    stepOrder: 1,
    stepType: "LLM_CALL" as const,
    name: "generate-response",
    inputJson: { prompt: "Hello" },
    outputJson: { response: "Hi there!" },
    durationMs: 1200,
    status: "COMPLETED" as const,
    error: null,
    startedAt: new Date("2024-01-15T10:00:00Z"),
    completedAt: new Date("2024-01-15T10:00:01.2Z"),
    createdAt: new Date("2024-01-15T10:00:00Z")
};

/**
 * Mock tool call
 */
export const mockToolCall = {
    id: "test-tool-call-uuid",
    traceId: "test-trace-uuid",
    stepId: "test-step-uuid",
    toolName: "web-search",
    callOrder: 1,
    inputJson: { query: "weather today" },
    outputJson: { results: ["Sunny, 72°F"] },
    durationMs: 500,
    status: "SUCCESS" as const,
    error: null,
    startedAt: new Date("2024-01-15T10:00:00.5Z"),
    completedAt: new Date("2024-01-15T10:00:01Z"),
    createdAt: new Date("2024-01-15T10:00:00.5Z")
};
