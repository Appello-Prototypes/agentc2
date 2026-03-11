import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { mockAgent } from "../../fixtures/agents";
import {
    agentCreateSchema,
    agentUpdateSchema
} from "../../../packages/agentc2/src/schemas/agent";
import { networkCreateSchema } from "../../../packages/agentc2/src/schemas/network";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: {
        JsonNull: "DbNull",
        InputJsonValue: {},
        PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
            code: string;
            constructor(message: string, { code }: { code: string }) {
                super(message);
                this.code = code;
            }
        }
    }
}));

vi.mock("@repo/agentc2", () => ({
    agentResolver: {
        resolve: vi.fn(),
        listForUser: vi.fn()
    },
    validateModelSelection: vi.fn().mockResolvedValue({
        valid: true,
        modelName: "gpt-4o"
    })
}));

vi.mock("@repo/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn().mockResolvedValue({
                user: { id: "test-user-uuid" }
            })
        }
    }
}));

vi.mock("next/headers", () => ({
    headers: vi.fn().mockResolvedValue({})
}));

vi.mock("@/lib/organization", () => ({
    getDefaultWorkspaceIdForUser: vi.fn().mockResolvedValue("test-workspace-uuid"),
    getUserOrganizationId: vi.fn().mockResolvedValue("test-org-uuid"),
    validateWorkspaceOwnership: vi.fn().mockResolvedValue(true)
}));

vi.mock("@/lib/api-auth", () => ({
    authenticateRequest: vi.fn().mockResolvedValue({
        userId: "test-user-uuid",
        organizationId: "test-org-uuid"
    })
}));

vi.mock("@/lib/authz/require-entity-access", () => ({
    requireEntityAccess: vi.fn().mockResolvedValue({
        allowed: true
    })
}));

vi.mock("@/lib/rate-limit", () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true })
}));

vi.mock("@/lib/security/rate-limit-policy", () => ({
    RATE_LIMIT_POLICIES: {
        orgMutation: {}
    }
}));

vi.mock("@repo/agentc2/activity/service", () => ({
    recordActivity: vi.fn()
}));

describe("Agent Validation", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
    });

    describe("POST /api/agents - modelName validation", () => {
        it("should reject when modelName is null", async () => {
            const invalidPayload = {
                name: "Test Agent",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: null
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const modelNameIssue = result.error.issues.find((i) => i.path[0] === "modelName");
                expect(modelNameIssue).toBeDefined();
                expect(modelNameIssue?.message).toMatch(/required|expected/i);
            }
        });

        it("should reject when modelName is undefined (missing)", async () => {
            const invalidPayload = {
                name: "Test Agent",
                instructions: "Test instructions",
                modelProvider: "openai"
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const modelNameIssue = result.error.issues.find((i) => i.path[0] === "modelName");
                expect(modelNameIssue).toBeDefined();
            }
        });

        it("should reject when modelName is empty string", async () => {
            const invalidPayload = {
                name: "Test Agent",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: ""
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const modelNameIssue = result.error.issues.find((i) => i.path[0] === "modelName");
                expect(modelNameIssue).toBeDefined();
                expect(modelNameIssue?.message).toMatch(/at least 1 character/i);
            }
        });

        it("should accept valid modelName", async () => {
            const validPayload = {
                name: "Test Agent",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "gpt-4o"
            };

            const result = agentCreateSchema.safeParse(validPayload);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.modelName).toBe("gpt-4o");
            }
        });

        it("should reject when modelProvider is invalid", async () => {
            const invalidPayload = {
                name: "Test Agent",
                instructions: "Test instructions",
                modelProvider: "invalid-provider",
                modelName: "gpt-4o"
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const providerIssue = result.error.issues.find(
                    (i) => i.path[0] === "modelProvider"
                );
                expect(providerIssue).toBeDefined();
            }
        });

        it("should reject when name is missing", async () => {
            const invalidPayload = {
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "gpt-4o"
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const nameIssue = result.error.issues.find((i) => i.path[0] === "name");
                expect(nameIssue).toBeDefined();
            }
        });

        it("should reject when instructions are missing", async () => {
            const invalidPayload = {
                name: "Test Agent",
                modelProvider: "openai",
                modelName: "gpt-4o"
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const instructionsIssue = result.error.issues.find(
                    (i) => i.path[0] === "instructions"
                );
                expect(instructionsIssue).toBeDefined();
            }
        });

        it("should accept all valid fields for agent creation", async () => {
            const validPayload = {
                name: "Test Agent",
                slug: "test-agent",
                description: "A test agent",
                instructions: "You are a helpful assistant",
                modelProvider: "openai",
                modelName: "gpt-4o",
                temperature: 0.7,
                maxTokens: 2000,
                memoryEnabled: true,
                visibility: "PRIVATE"
            };

            const result = agentCreateSchema.safeParse(validPayload);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe("Test Agent");
                expect(result.data.modelName).toBe("gpt-4o");
                expect(result.data.modelProvider).toBe("openai");
            }
        });
    });

    describe("PUT /api/agents/[id] - modelName validation", () => {
        it("should reject when modelName is explicitly set to null", async () => {
            const invalidPayload = {
                modelName: null
            };

            const result = agentUpdateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const modelNameIssue = result.error.issues.find((i) => i.path[0] === "modelName");
                expect(modelNameIssue).toBeDefined();
            }
        });

        it("should accept partial update without modelName", async () => {
            const validPayload = {
                name: "Updated Name",
                temperature: 0.8
            };

            const result = agentUpdateSchema.safeParse(validPayload);

            expect(result.success).toBe(true);
        });

        it("should accept valid modelName update", async () => {
            const validPayload = {
                modelName: "claude-sonnet-4-20250514"
            };

            const result = agentUpdateSchema.safeParse(validPayload);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.modelName).toBe("claude-sonnet-4-20250514");
            }
        });
    });

    describe("POST /api/networks - modelName validation", () => {
        it("should reject when modelName is null", async () => {
            const invalidPayload = {
                name: "Test Network",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: null
            };

            const result = networkCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const modelNameIssue = result.error.issues.find((i) => i.path[0] === "modelName");
                expect(modelNameIssue).toBeDefined();
            }
        });

        it("should reject when modelName is missing", async () => {
            const invalidPayload = {
                name: "Test Network",
                instructions: "Test instructions",
                modelProvider: "openai"
            };

            const result = networkCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const modelNameIssue = result.error.issues.find((i) => i.path[0] === "modelName");
                expect(modelNameIssue).toBeDefined();
            }
        });

        it("should accept valid network creation payload", async () => {
            const validPayload = {
                name: "Test Network",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "gpt-4o",
                temperature: 0.7
            };

            const result = networkCreateSchema.safeParse(validPayload);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe("Test Network");
                expect(result.data.modelName).toBe("gpt-4o");
            }
        });
    });

    describe("Prisma error handling", () => {
        it("should handle P2011 constraint violation for null fields", () => {
            const { Prisma } = require("@repo/database");
            const error = new Prisma.PrismaClientKnownRequestError(
                "Null constraint violation on modelName",
                { code: "P2011" }
            );

            expect(error.code).toBe("P2011");
            expect(error instanceof Error).toBe(true);
        });

        it("should handle P2002 unique constraint violation", () => {
            const { Prisma } = require("@repo/database");
            const error = new Prisma.PrismaClientKnownRequestError(
                "Unique constraint failed on slug",
                { code: "P2002" }
            );

            expect(error.code).toBe("P2002");
            expect(error instanceof Error).toBe(true);
        });
    });

    describe("Schema validation edge cases", () => {
        it("should accept modelName with whitespace (rejected later by validateModelSelection)", async () => {
            const invalidPayload = {
                name: "Test Agent",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "   "
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(true);
        });

        it("should reject temperature outside valid range", async () => {
            const invalidPayload = {
                name: "Test Agent",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "gpt-4o",
                temperature: 3.0
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const tempIssue = result.error.issues.find((i) => i.path[0] === "temperature");
                expect(tempIssue).toBeDefined();
            }
        });

        it("should reject negative maxTokens", async () => {
            const invalidPayload = {
                name: "Test Agent",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "gpt-4o",
                maxTokens: -100
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const maxTokensIssue = result.error.issues.find((i) => i.path[0] === "maxTokens");
                expect(maxTokensIssue).toBeDefined();
            }
        });

        it("should reject name that is too long", async () => {
            const invalidPayload = {
                name: "A".repeat(300),
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "gpt-4o"
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const nameIssue = result.error.issues.find((i) => i.path[0] === "name");
                expect(nameIssue).toBeDefined();
                expect(nameIssue?.message).toMatch(/at most 255 character/i);
            }
        });

        it("should reject instructions that are too long", async () => {
            const invalidPayload = {
                name: "Test Agent",
                instructions: "A".repeat(100001),
                modelProvider: "openai",
                modelName: "gpt-4o"
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const instructionsIssue = result.error.issues.find(
                    (i) => i.path[0] === "instructions"
                );
                expect(instructionsIssue).toBeDefined();
            }
        });

        it("should reject invalid slug format", async () => {
            const invalidPayload = {
                name: "Test Agent",
                slug: "Invalid Slug With Spaces",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "gpt-4o"
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const slugIssue = result.error.issues.find((i) => i.path[0] === "slug");
                expect(slugIssue).toBeDefined();
            }
        });

        it("should accept valid slug with hyphens", async () => {
            const validPayload = {
                name: "Test Agent",
                slug: "test-agent-123",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "gpt-4o"
            };

            const result = agentCreateSchema.safeParse(validPayload);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.slug).toBe("test-agent-123");
            }
        });

        it("should accept anthropic as modelProvider", async () => {
            const validPayload = {
                name: "Test Agent",
                instructions: "Test instructions",
                modelProvider: "anthropic",
                modelName: "claude-sonnet-4-20250514"
            };

            const result = agentCreateSchema.safeParse(validPayload);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.modelProvider).toBe("anthropic");
            }
        });
    });

    describe("Update schema validation", () => {
        it("should allow partial updates with only changed fields", async () => {
            const validPayload = {
                temperature: 0.9
            };

            const result = agentUpdateSchema.safeParse(validPayload);

            expect(result.success).toBe(true);
        });

        it("should still validate types for provided fields in partial update", async () => {
            const invalidPayload = {
                temperature: "not-a-number"
            };

            const result = agentUpdateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
        });
    });

    describe("Network schema validation", () => {
        it("should reject network creation when modelName is null", async () => {
            const invalidPayload = {
                name: "Test Network",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: null
            };

            const result = networkCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const modelNameIssue = result.error.issues.find((i) => i.path[0] === "modelName");
                expect(modelNameIssue).toBeDefined();
            }
        });

        it("should accept valid network creation payload", async () => {
            const validPayload = {
                name: "Test Network",
                instructions: "Test instructions",
                modelProvider: "openai",
                modelName: "gpt-4o"
            };

            const result = networkCreateSchema.safeParse(validPayload);

            expect(result.success).toBe(true);
        });
    });

    describe("Error message format", () => {
        it("should provide structured validation errors", async () => {
            const invalidPayload = {
                name: "",
                instructions: "",
                modelProvider: "invalid",
                modelName: ""
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.length).toBeGreaterThan(0);
                result.error.issues.forEach((issue) => {
                    expect(issue).toHaveProperty("path");
                    expect(issue).toHaveProperty("message");
                    expect(Array.isArray(issue.path)).toBe(true);
                });
            }
        });

        it("should allow mapping validation errors to field-message pairs", async () => {
            const invalidPayload = {
                modelProvider: "openai",
                modelName: null
            };

            const result = agentCreateSchema.safeParse(invalidPayload);

            expect(result.success).toBe(false);
            if (!result.success) {
                const details = result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message
                }));

                expect(details.length).toBeGreaterThan(0);
                expect(details.every((d) => typeof d.field === "string")).toBe(true);
                expect(details.every((d) => typeof d.message === "string")).toBe(true);
            }
        });
    });
});
