import { faker } from "@faker-js/faker";

/**
 * Base mock simulation session for testing
 */
export const mockSimulationSession = {
    id: "test-session-uuid",
    agentId: "test-agent-uuid",
    theme: "Customer service questions about timesheets",
    status: "PENDING" as const,
    targetCount: 100,
    concurrency: 5,
    completedCount: 0,
    failedCount: 0,
    avgQualityScore: null,
    avgDurationMs: null,
    successRate: null,
    totalCostUsd: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date("2024-01-15T10:00:00Z")
};

/**
 * Running simulation session
 */
export const mockRunningSession = {
    ...mockSimulationSession,
    id: "running-session-uuid",
    status: "RUNNING" as const,
    completedCount: 34,
    failedCount: 2,
    startedAt: new Date("2024-01-15T10:00:00Z")
};

/**
 * Completed simulation session
 */
export const mockCompletedSession = {
    ...mockSimulationSession,
    id: "completed-session-uuid",
    status: "COMPLETED" as const,
    completedCount: 98,
    failedCount: 2,
    avgQualityScore: 0.82,
    avgDurationMs: 1500,
    successRate: 0.98,
    totalCostUsd: 0.45,
    startedAt: new Date("2024-01-15T10:00:00Z"),
    completedAt: new Date("2024-01-15T10:15:00Z")
};

/**
 * Failed simulation session
 */
export const mockFailedSession = {
    ...mockSimulationSession,
    id: "failed-session-uuid",
    status: "FAILED" as const,
    completedCount: 10,
    failedCount: 90,
    startedAt: new Date("2024-01-15T10:00:00Z"),
    completedAt: new Date("2024-01-15T10:05:00Z")
};

/**
 * Cancelled simulation session
 */
export const mockCancelledSession = {
    ...mockSimulationSession,
    id: "cancelled-session-uuid",
    status: "CANCELLED" as const,
    completedCount: 25,
    failedCount: 0,
    startedAt: new Date("2024-01-15T10:00:00Z"),
    completedAt: new Date("2024-01-15T10:02:00Z")
};

/**
 * Generate a random simulation session
 */
export function generateSession(overrides: Partial<typeof mockSimulationSession> = {}) {
    const statuses = ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const;
    const status = faker.helpers.arrayElement(statuses);
    const targetCount = faker.number.int({ min: 10, max: 500 });
    const completedCount =
        status === "PENDING" ? 0 : faker.number.int({ min: 0, max: targetCount });
    const failedCount =
        status === "PENDING" ? 0 : faker.number.int({ min: 0, max: targetCount - completedCount });

    return {
        id: faker.string.uuid(),
        agentId: overrides.agentId || faker.string.uuid(),
        theme: faker.lorem.sentence(),
        status,
        targetCount,
        concurrency: faker.number.int({ min: 1, max: 10 }),
        completedCount,
        failedCount,
        avgQualityScore: status === "COMPLETED" ? faker.number.float({ min: 0.5, max: 1 }) : null,
        avgDurationMs: status === "COMPLETED" ? faker.number.int({ min: 500, max: 3000 }) : null,
        successRate:
            status === "COMPLETED" ? completedCount / (completedCount + failedCount) : null,
        totalCostUsd: status === "COMPLETED" ? faker.number.float({ min: 0.1, max: 2 }) : null,
        startedAt: status === "PENDING" ? null : faker.date.recent(),
        completedAt: ["COMPLETED", "FAILED", "CANCELLED"].includes(status)
            ? faker.date.recent()
            : null,
        createdAt: faker.date.recent(),
        ...overrides
    };
}

/**
 * Generate multiple simulation sessions
 */
export function generateSessions(
    count: number,
    overrides: Partial<typeof mockSimulationSession> = {}
) {
    return Array.from({ length: count }, () => generateSession(overrides));
}

/**
 * Mock simulation run (AgentRun with source="simulation")
 */
export const mockSimulationRun = {
    id: "sim-run-uuid",
    agentId: "test-agent-uuid",
    tenantId: null,
    status: "COMPLETED" as const,
    runType: "TEST" as const,
    inputText: "Hey, I submitted my timesheet last Friday but it still shows as pending.",
    outputText: "I'll look into that for you. Can you confirm which pay period this is for?",
    durationMs: 1200,
    promptTokens: 150,
    completionTokens: 80,
    totalTokens: 230,
    costUsd: 0.003,
    modelProvider: "anthropic",
    modelName: "claude-sonnet-4-20250514",
    source: "simulation",
    sessionId: "test-session-uuid",
    versionId: null,
    userId: null,
    contextVarsJson: null,
    startedAt: new Date("2024-01-15T10:00:00Z"),
    completedAt: new Date("2024-01-15T10:00:01.2Z"),
    createdAt: new Date("2024-01-15T10:00:00Z")
};

/**
 * Generate simulation runs for a session
 */
export function generateSimulationRuns(count: number, sessionId: string, agentId: string) {
    return Array.from({ length: count }, (_, i) => ({
        id: faker.string.uuid(),
        agentId,
        tenantId: null,
        status: faker.helpers.weightedArrayElement([
            { value: "COMPLETED", weight: 9 },
            { value: "FAILED", weight: 1 }
        ]) as "COMPLETED" | "FAILED",
        runType: "TEST" as const,
        inputText: faker.lorem.sentence(),
        outputText: faker.lorem.paragraph(),
        durationMs: faker.number.int({ min: 500, max: 3000 }),
        promptTokens: faker.number.int({ min: 100, max: 500 }),
        completionTokens: faker.number.int({ min: 50, max: 300 }),
        totalTokens: faker.number.int({ min: 150, max: 800 }),
        costUsd: faker.number.float({ min: 0.001, max: 0.01 }),
        modelProvider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        source: "simulation",
        sessionId,
        versionId: null,
        userId: null,
        contextVarsJson: null,
        startedAt: faker.date.recent(),
        completedAt: faker.date.recent(),
        createdAt: faker.date.recent()
    }));
}
