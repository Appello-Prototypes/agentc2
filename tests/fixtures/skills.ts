import { faker } from "@faker-js/faker";

/**
 * Base mock skill for testing
 */
export const mockSkill = {
    id: "test-skill-uuid",
    slug: "test-skill",
    name: "Test Skill",
    description: "A test skill for unit tests",
    instructions: "## Test Skill\n\nYou can use this skill to do test things.",
    examples: null,
    category: "utility",
    tags: ["test"],
    metadata: null,
    workspaceId: null,
    version: 1,
    type: "USER" as const,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    createdBy: null,
    documents: [],
    tools: [],
    agents: []
};

/**
 * SYSTEM skill mock
 */
export const mockSystemSkill = {
    ...mockSkill,
    id: "system-skill-uuid",
    slug: "platform-agent-management",
    name: "Agent Management",
    description: "Create, configure, and manage AI agents on the platform.",
    instructions:
        "## Agent Management\n\nYou can create, read, update, delete, and list AI agents.",
    category: "builder",
    tags: ["agents", "crud", "management"],
    type: "SYSTEM" as const,
    tools: [
        { toolId: "agent-create" },
        { toolId: "agent-read" },
        { toolId: "agent-update" },
        { toolId: "agent-delete" },
        { toolId: "agent-list" }
    ]
};

/**
 * Skill with tools mock
 */
export const mockSkillWithTools = {
    ...mockSkill,
    id: "skill-with-tools-uuid",
    slug: "skill-with-tools",
    name: "Skill With Tools",
    tools: [{ toolId: "date-time" }, { toolId: "calculator" }, { toolId: "generate-id" }]
};

/**
 * Skill with documents mock
 */
export const mockSkillWithDocuments = {
    ...mockSkill,
    id: "skill-with-docs-uuid",
    slug: "skill-with-docs",
    name: "Skill With Documents",
    documents: [
        {
            documentId: "doc-1",
            role: "reference",
            document: { id: "doc-1", slug: "doc-one", name: "Document One", category: "guide" }
        },
        {
            documentId: "doc-2",
            role: "procedure",
            document: { id: "doc-2", slug: "doc-two", name: "Document Two", category: "sop" }
        }
    ]
};

/**
 * MCP integration skill mock (no static tools)
 */
export const mockMcpSkill = {
    ...mockSkill,
    id: "mcp-skill-uuid",
    slug: "mcp-crm-hubspot",
    name: "HubSpot CRM",
    description: "CRM operations via HubSpot.",
    instructions: "## HubSpot CRM Integration\n\nAccess HubSpot through MCP tools.",
    category: "integration",
    tags: ["crm", "hubspot"],
    type: "SYSTEM" as const,
    tools: [] // MCP tools resolved dynamically
};

/**
 * Skill with agents attached
 */
export const mockSkillWithAgents = {
    ...mockSkill,
    id: "skill-with-agents-uuid",
    slug: "skill-with-agents",
    name: "Skill With Agents",
    agents: [
        {
            agentId: "agent-1",
            pinned: true,
            agent: { id: "agent-1", slug: "assistant", name: "AI Assistant" }
        },
        {
            agentId: "agent-2",
            pinned: false,
            agent: { id: "agent-2", slug: "workspace-concierge", name: "Workspace Concierge" }
        }
    ]
};

/**
 * Generate a random skill
 */
export function generateSkill(overrides: Partial<typeof mockSkill> = {}) {
    return {
        ...mockSkill,
        id: faker.string.uuid(),
        slug: faker.helpers.slugify(faker.lorem.words(3)).toLowerCase(),
        name: faker.lorem.words(3),
        description: faker.lorem.sentence(),
        instructions: faker.lorem.paragraphs(2),
        category: faker.helpers.arrayElement(["builder", "operations", "utility", "domain"]),
        tags: [faker.lorem.word(), faker.lorem.word()],
        version: faker.number.int({ min: 1, max: 10 }),
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        ...overrides
    };
}

/**
 * Thread skill state mock
 */
export const mockThreadSkillState = {
    id: "thread-state-uuid",
    threadId: "thread-123",
    agentId: "agent-1",
    skillSlugs: ["mcp-crm-hubspot", "core-utilities"],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01")
};

/**
 * Skill version mock
 */
export const mockSkillVersion = {
    id: "version-uuid",
    skillId: "test-skill-uuid",
    version: 1,
    instructions: "## Old Instructions\n\nPrevious version content.",
    configJson: { documents: [], tools: [{ toolId: "calculator" }] },
    changeSummary: "Updated instructions for clarity",
    createdAt: new Date("2024-01-01"),
    createdBy: null
};

/**
 * AgentSkill junction mock
 */
export const mockAgentSkill = {
    id: "agent-skill-uuid",
    agentId: "agent-1",
    skillId: "test-skill-uuid",
    pinned: true
};
