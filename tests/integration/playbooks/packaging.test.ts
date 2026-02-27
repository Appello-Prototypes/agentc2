import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: { JsonNull: "DbNull", InputJsonValue: {} }
}));

import { validateManifest, isValidManifest } from "@repo/agentc2/playbooks/manifest";
import { sanitizeManifest, detectHardcodedUrls } from "@repo/agentc2/playbooks/sanitizer";
import type { PlaybookManifest } from "@repo/agentc2/playbooks/types";

const validManifest: PlaybookManifest = {
    version: "1.0",
    agents: [
        {
            slug: "support-router",
            name: "Router Agent",
            description: "Routes customer inquiries to specialists.",
            instructions: "Route customer inquiries to the appropriate specialist.",
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
            testCases: [
                {
                    agentSlug: "support-router",
                    name: "Route billing question",
                    inputText: "How do I update my payment method?",
                    expectedOutput: null,
                    tags: ["routing", "billing"]
                }
            ],
            scorecard: null
        },
        {
            slug: "support-faq",
            name: "FAQ Agent",
            description: "Answers common questions from the knowledge base.",
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
            memoryEnabled: true,
            memoryConfig: { lastMessages: 10 },
            maxSteps: 5,
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
    skills: [],
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
        }
    ],
    workflows: [],
    networks: [
        {
            slug: "support-network",
            name: "Support Network",
            description: "Multi-agent support network",
            instructions: "Route based on classification.",
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.3,
            topologyJson: {
                nodes: [
                    { id: "router", type: "agent", agentSlug: "support-router" },
                    { id: "faq", type: "agent", agentSlug: "support-faq" }
                ],
                edges: [{ source: "router", target: "faq", label: "standard" }]
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
                }
            ]
        }
    ],
    guardrails: [],
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
    requiredIntegrations: [],
    entryPoint: { type: "network", slug: "support-network" }
};

describe("Packaging Engine", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    // US-039: Manifest validation
    describe("Manifest Validation (US-039)", () => {
        it("should validate a correctly formed manifest", () => {
            const result = validateManifest(validManifest);
            expect(result).toBeDefined();
            expect(result.agents).toHaveLength(2);
            expect(result.documents).toHaveLength(1);
            expect(result.networks).toHaveLength(1);
            expect(result.entryPoint.type).toBe("network");
        });

        it("should reject a manifest missing agents", () => {
            const invalid = { ...validManifest, agents: undefined };
            expect(() => validateManifest(invalid)).toThrow();
        });

        it("should reject a manifest missing entryPoint", () => {
            const invalid = { ...validManifest, entryPoint: undefined };
            expect(() => validateManifest(invalid)).toThrow();
        });

        it("should reject a manifest with invalid entryPoint type", () => {
            const invalid = {
                ...validManifest,
                entryPoint: { type: "invalid", slug: "test" }
            };
            expect(() => validateManifest(invalid)).toThrow();
        });

        it("should return false for invalid manifest via isValidManifest", () => {
            expect(isValidManifest({})).toBe(false);
            expect(isValidManifest(null)).toBe(false);
            expect(isValidManifest(undefined)).toBe(false);
        });

        it("should return true for valid manifest via isValidManifest", () => {
            expect(isValidManifest(validManifest)).toBe(true);
        });
    });

    // US-035: Secret stripping
    describe("Manifest Sanitization - Secrets (US-035)", () => {
        it("should strip API key patterns from instructions", () => {
            const apiKey = "sk-abc123def456ghi789jkl012mno345pqr678";
            const manifest: PlaybookManifest = {
                ...validManifest,
                agents: [
                    {
                        ...validManifest.agents[0],
                        instructions: `Use API key ${apiKey} to access the service.`
                    }
                ]
            };
            const result = sanitizeManifest(manifest, "org-123");
            expect(result.manifest.agents[0].instructions).not.toContain(apiKey);
        });

        it("should strip HubSpot access token patterns", () => {
            const hubspotToken = "pat-na1-abc123def456ghi789jkl012mno345p";
            const manifest: PlaybookManifest = {
                ...validManifest,
                agents: [
                    {
                        ...validManifest.agents[0],
                        instructions: `HubSpot token: ${hubspotToken}`
                    }
                ]
            };
            const result = sanitizeManifest(manifest, "org-123");
            expect(result.manifest.agents[0].instructions).not.toContain(hubspotToken);
        });

        it("should strip Slack bot tokens", () => {
            const manifest: PlaybookManifest = {
                ...validManifest,
                agents: [
                    {
                        ...validManifest.agents[0],
                        instructions: "Use xoxb-1234567890-abcdefghij for Slack."
                    }
                ]
            };
            const result = sanitizeManifest(manifest, "org-123");
            expect(result.manifest.agents[0].instructions).not.toContain(
                "xoxb-1234567890-abcdefghij"
            );
        });
    });

    // US-036: PII removal
    describe("Manifest Sanitization - PII (US-036)", () => {
        it("should strip email addresses from document content", () => {
            const manifest: PlaybookManifest = {
                ...validManifest,
                documents: [
                    {
                        ...validManifest.documents[0],
                        content: "Send inquiries to admin@builder.com"
                    }
                ]
            };
            const result = sanitizeManifest(manifest, "org-123");
            expect(result.manifest.documents[0].content).not.toContain("admin@builder.com");
        });

        it("should strip phone numbers from document content", () => {
            const manifest: PlaybookManifest = {
                ...validManifest,
                documents: [
                    {
                        ...validManifest.documents[0],
                        content: "Call us at +1-555-123-4567 for support."
                    }
                ]
            };
            const result = sanitizeManifest(manifest, "org-123");
            expect(result.manifest.documents[0].content).not.toContain("+1-555-123-4567");
        });
    });

    // US-037: Connection ID stripping
    describe("Manifest Sanitization - Org IDs (US-037)", () => {
        it("should strip organizationId references", () => {
            const manifest: PlaybookManifest = {
                ...validManifest,
                agents: [
                    {
                        ...validManifest.agents[0],
                        instructions: "This agent belongs to org org-123 in workspace ws-456."
                    }
                ]
            };
            const result = sanitizeManifest(manifest, "org-123");
            expect(result.manifest.agents[0].instructions).not.toContain("org-123");
        });
    });

    // US-038: Hardcoded URL detection
    describe("Hardcoded URL Detection (US-038)", () => {
        it("should detect builder-specific URLs in instructions", () => {
            const manifest: PlaybookManifest = {
                ...validManifest,
                agents: [
                    {
                        ...validManifest.agents[0],
                        instructions: "Access our CRM at https://my-company.hubspot.com/contacts"
                    }
                ]
            };
            const urls = detectHardcodedUrls(manifest);
            expect(urls.length).toBeGreaterThan(0);
        });

        it("should not flag generic URLs", () => {
            const manifest: PlaybookManifest = {
                ...validManifest,
                agents: [
                    {
                        ...validManifest.agents[0],
                        instructions: "Search the web for answers to customer questions."
                    }
                ]
            };
            const urls = detectHardcodedUrls(manifest);
            expect(urls).toHaveLength(0);
        });
    });

    // US-031, US-032, US-033, US-034: Manifest content
    describe("Manifest Content (US-031 - US-034)", () => {
        it("should contain all required agent fields", () => {
            const result = validateManifest(validManifest);
            const agent = result.agents[0];
            expect(agent.slug).toBeDefined();
            expect(agent.name).toBeDefined();
            expect(agent.instructions).toBeDefined();
            expect(agent.modelProvider).toBeDefined();
            expect(agent.modelName).toBeDefined();
            expect(agent.version).toBeDefined();
            expect(agent.tools).toBeInstanceOf(Array);
            expect(agent.skills).toBeInstanceOf(Array);
        });

        it("should contain document snapshots with version", () => {
            const result = validateManifest(validManifest);
            expect(result.documents).toHaveLength(1);
            expect(result.documents[0].content).toBeDefined();
            expect(result.documents[0].slug).toBeDefined();
            expect(result.documents[0].version).toBe(1);
        });

        it("should contain network topology with primitives", () => {
            const result = validateManifest(validManifest);
            expect(result.networks).toHaveLength(1);
            expect(result.networks[0].topologyJson).toBeDefined();
            expect(result.networks[0].version).toBe(1);
            expect(result.networks[0].primitives).toHaveLength(2);
        });

        it("should contain test cases with agentSlug", () => {
            const result = validateManifest(validManifest);
            expect(result.testCases).toHaveLength(1);
            expect(result.testCases[0].inputText).toBeDefined();
            expect(result.testCases[0].agentSlug).toBe("support-router");
        });

        it("should contain entry point referencing existing component", () => {
            const result = validateManifest(validManifest);
            expect(result.entryPoint.type).toBe("network");
            expect(result.entryPoint.slug).toBe("support-network");
            const networkSlugs = result.networks.map((n) => n.slug);
            expect(networkSlugs).toContain(result.entryPoint.slug);
        });
    });
});
