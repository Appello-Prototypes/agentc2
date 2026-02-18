import { faker } from "@faker-js/faker";

/**
 * Base mock agent for testing
 */
export const mockAgent = {
    id: "test-agent-uuid",
    slug: "test-agent",
    name: "Test Agent",
    description: "A test agent for unit tests",
    tenantId: "test-tenant",
    type: "USER" as const,
    modelProvider: "anthropic",
    modelName: "claude-sonnet-4-20250514",
    instructions: "You are a helpful test agent. User ID: {{userId}}",
    instructionsTemplate: null,
    temperature: 0.7,
    maxTokens: null,
    modelConfig: null,
    memoryEnabled: false,
    memoryConfig: null,
    maxSteps: 5,
    scorers: [],
    visibility: "PRIVATE",
    metadata: null,
    version: 1,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    tools: []
};

/**
 * System agent mock
 */
export const mockSystemAgent = {
    ...mockAgent,
    id: "system-agent-uuid",
    slug: "assistant",
    name: "AI Assistant",
    type: "SYSTEM" as const,
    memoryEnabled: true,
    memoryConfig: { lastMessages: 10 }
};

/**
 * Generate a random agent
 */
export function generateAgent(overrides: Partial<typeof mockAgent> = {}) {
    return {
        ...mockAgent,
        id: faker.string.uuid(),
        slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
        name: faker.company.name(),
        description: faker.lorem.sentence(),
        tenantId: faker.string.uuid(),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        ...overrides
    };
}

/**
 * Generate multiple agents
 */
export function generateAgents(count: number, overrides: Partial<typeof mockAgent> = []) {
    return Array.from({ length: count }, () => generateAgent(overrides));
}

/**
 * Agent with tools
 */
export const mockAgentWithTools = {
    ...mockAgent,
    id: "agent-with-tools-uuid",
    slug: "agent-with-tools",
    tools: [
        { id: "tool-1", toolId: "web-search", config: {} },
        { id: "tool-2", toolId: "calculator", config: {} }
    ]
};

/**
 * Agent with scorers/evaluations
 */
export const mockAgentWithScorers = {
    ...mockAgent,
    id: "evaluated-agent-uuid",
    slug: "evaluated-agent",
    scorers: ["relevancy", "toxicity", "helpfulness"]
};
