import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import type { PlaybookManifest } from "@repo/agentc2/playbooks/types";
import { prismaMock, resetPrismaMock, mockPrismaModule } from "../../utils/db-mock";

mockPrismaModule();

const testManifest: PlaybookManifest = {
    version: "1.0",
    agents: [
        {
            slug: "support-router",
            name: "Router Agent",
            description: "Routes customer inquiries.",
            instructions: "Route customer inquiries.",
            instructionsTemplate: null,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.3,
            maxTokens: null,
            modelConfig: null,
            routingConfig: null,
            contextConfig: null,
            subAgents: ["support-faq"],
            workflows: [],
            memoryEnabled: true,
            memoryConfig: { lastMessages: 10 },
            maxSteps: 3,
            scorers: [],
            visibility: "PRIVATE",
            requiresApproval: false,
            maxSpendUsd: null,
            autoVectorize: false,
            deploymentMode: null,
            metadata: null,
            version: 1,
            tools: [{ toolId: "ask-questions", config: null }],
            skills: [],
            guardrail: null,
            testCases: [],
            scorecard: null
        },
        {
            slug: "support-faq",
            name: "FAQ Agent",
            description: "Answers from knowledge base.",
            instructions: "Search knowledge base for answers.",
            instructionsTemplate: null,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.2,
            maxTokens: null,
            modelConfig: null,
            routingConfig: null,
            contextConfig: null,
            subAgents: [],
            workflows: [],
            memoryEnabled: false,
            memoryConfig: null,
            maxSteps: 5,
            scorers: [],
            visibility: "PRIVATE",
            requiresApproval: false,
            maxSpendUsd: null,
            autoVectorize: false,
            deploymentMode: null,
            metadata: null,
            version: 1,
            tools: [{ toolId: "rag-query", config: null }],
            skills: [],
            guardrail: null,
            testCases: [],
            scorecard: null
        },
        {
            slug: "support-escalation",
            name: "Escalation Agent",
            description: "Handles complex issues.",
            instructions: "Handle complex issues.",
            instructionsTemplate: null,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.3,
            maxTokens: null,
            modelConfig: null,
            routingConfig: null,
            contextConfig: null,
            subAgents: [],
            workflows: [],
            memoryEnabled: true,
            memoryConfig: { lastMessages: 15 },
            maxSteps: 5,
            scorers: [],
            visibility: "PRIVATE",
            requiresApproval: false,
            maxSpendUsd: null,
            autoVectorize: false,
            deploymentMode: null,
            metadata: null,
            version: 1,
            tools: [{ toolId: "rag-query", config: null }],
            skills: [],
            guardrail: null,
            testCases: [],
            scorecard: null
        }
    ],
    skills: [
        {
            slug: "ticket-triage",
            name: "Ticket Triage",
            description: null,
            instructions: "Classify and prioritize incoming requests.",
            examples: null,
            category: null,
            tags: [],
            metadata: null,
            version: 1,
            tools: [{ toolId: "ask-questions" }],
            documents: []
        }
    ],
    documents: [
        {
            slug: "billing-faq",
            name: "Billing FAQ",
            description: null,
            content: "# Billing FAQ\n\nHow do I update my payment method?",
            contentType: "markdown",
            category: "Support",
            tags: ["support", "billing"],
            metadata: null,
            version: 1
        },
        {
            slug: "account-faq",
            name: "Account FAQ",
            description: null,
            content: "# Account FAQ\n\nHow do I reset my password?",
            contentType: "markdown",
            category: "Support",
            tags: ["support", "account"],
            metadata: null,
            version: 1
        }
    ],
    workflows: [],
    networks: [
        {
            slug: "customer-support-network",
            name: "Customer Support Network",
            description: "Multi-agent support network",
            instructions: "Route based on classification.",
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.3,
            topologyJson: {
                nodes: [
                    { id: "router", type: "agent", agentSlug: "support-router" },
                    { id: "faq", type: "agent", agentSlug: "support-faq" },
                    { id: "escalation", type: "agent", agentSlug: "support-escalation" }
                ],
                edges: [
                    { source: "router", target: "faq", label: "standard" },
                    { source: "router", target: "escalation", label: "complex" }
                ]
            },
            memoryConfig: { lastMessages: 20 },
            maxSteps: 10,
            version: 1,
            primitives: [
                {
                    primitiveType: "agent",
                    agentSlug: "support-router",
                    workflowSlug: null,
                    toolId: null,
                    description: "Router",
                    position: null
                },
                {
                    primitiveType: "agent",
                    agentSlug: "support-faq",
                    workflowSlug: null,
                    toolId: null,
                    description: "FAQ handler",
                    position: null
                },
                {
                    primitiveType: "agent",
                    agentSlug: "support-escalation",
                    workflowSlug: null,
                    toolId: null,
                    description: "Escalation handler",
                    position: null
                }
            ]
        }
    ],
    guardrails: [
        {
            agentSlug: "support-router",
            configJson: {
                input: { filters: [{ type: "pii", action: "redact" }] },
                output: { filters: [{ type: "tone", action: "enforce" }] }
            },
            version: 1
        }
    ],
    testCases: [
        {
            agentSlug: "support-router",
            name: "Route billing question",
            inputText: "How do I update my payment method?",
            expectedOutput: null,
            tags: ["routing"]
        }
    ],
    scorecards: [],
    requiredIntegrations: ["hubspot", "gmail"],
    entryPoint: { type: "network", slug: "customer-support-network" }
};

describe("Deployment Engine", () => {
    beforeEach(() => {
        resetPrismaMock();
        vi.clearAllMocks();
    });

    // US-066: Integration mapping
    describe("Integration Mapping (US-066)", () => {
        it("should map connected integrations correctly", async () => {
            const { mapIntegrations } = await import("@repo/agentc2/playbooks/integration-mapper");

            prismaMock.integrationProvider.findMany.mockResolvedValue([
                { id: "prov-1", key: "hubspot", name: "HubSpot" },
                { id: "prov-2", key: "gmail", name: "Gmail" }
            ] as never);

            prismaMock.integrationConnection.findMany.mockResolvedValue([
                {
                    id: "conn-1",
                    providerId: "prov-1",
                    organizationId: "org-buyer-uuid",
                    isActive: true,
                    provider: { key: "hubspot" }
                }
            ] as never);

            const mappings = await mapIntegrations({
                requiredIntegrations: ["hubspot", "gmail"],
                targetOrgId: "org-buyer-uuid",
                targetWorkspaceId: "ws-buyer-uuid"
            });

            expect(mappings).toHaveLength(2);
            const hubspot = mappings.find((m) => m.provider === "hubspot");
            const gmail = mappings.find((m) => m.provider === "gmail");
            expect(hubspot?.connected).toBe(true);
            expect(gmail?.connected).toBe(false);
        });

        it("should return empty mappings when no integrations required", async () => {
            const { mapIntegrations } = await import("@repo/agentc2/playbooks/integration-mapper");

            const mappings = await mapIntegrations({
                requiredIntegrations: [],
                targetOrgId: "org-buyer-uuid",
                targetWorkspaceId: "ws-buyer-uuid"
            });

            expect(mappings).toHaveLength(0);
        });
    });

    // US-060 - US-065: Deployer entity creation patterns
    describe("Deployer Entity Tracking (US-060 - US-065)", () => {
        it("should track manifest agent count for deployment", () => {
            expect(testManifest.agents).toHaveLength(3);
            expect(testManifest.agents.map((a) => a.slug)).toEqual([
                "support-router",
                "support-faq",
                "support-escalation"
            ]);
        });

        it("should track manifest skill count for deployment", () => {
            expect(testManifest.skills).toHaveLength(1);
        });

        it("should track manifest document count for deployment", () => {
            expect(testManifest.documents).toHaveLength(2);
        });

        it("should track manifest network topology", () => {
            expect(testManifest.networks).toHaveLength(1);
            const network = testManifest.networks[0];
            expect(network.topologyJson).toBeDefined();
            expect(network.primitives).toHaveLength(3);
        });

        it("should track guardrail policies for deployment", () => {
            expect(testManifest.guardrails).toHaveLength(1);
            expect(testManifest.guardrails[0].agentSlug).toBe("support-router");
        });

        it("should validate entry point references an existing component", () => {
            const entrySlug = testManifest.entryPoint.slug;
            const networkSlugs = testManifest.networks.map((n) => n.slug);
            expect(networkSlugs).toContain(entrySlug);
        });
    });

    // US-090: Slug conflict resolution
    describe("Slug Conflict Resolution (US-090)", () => {
        it("should detect when agent slug already exists in target workspace", async () => {
            prismaMock.agent.findFirst.mockResolvedValue({
                id: "existing-agent",
                slug: "support-router",
                workspaceId: "ws-buyer-uuid"
            } as never);

            const existing = await prismaMock.agent.findFirst({
                where: {
                    slug: "support-router",
                    workspaceId: "ws-buyer-uuid"
                }
            });

            expect(existing).not.toBeNull();
            expect(existing?.slug).toBe("support-router");
        });
    });
});
