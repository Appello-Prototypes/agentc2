import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

const prismaMock = mockDeep<PrismaClient>();

vi.mock("@repo/database", () => ({
    prisma: prismaMock,
    Prisma: { InputJsonValue: {} }
}));

const { recommendSkills } = await import("@repo/mastra");

const mockSkills = [
    {
        id: "s1",
        slug: "mcp-crm-hubspot",
        name: "HubSpot CRM",
        description: "CRM contacts, companies, deals via HubSpot",
        instructions: "Access HubSpot CRM",
        category: "integration",
        tags: ["crm", "hubspot", "sales", "contacts"],
        _count: { tools: 12 }
    },
    {
        id: "s2",
        slug: "mcp-project-jira",
        name: "Jira Project Management",
        description: "Issues, sprints, projects via Jira",
        instructions: "Access Jira",
        category: "integration",
        tags: ["jira", "project-management", "issues"],
        _count: { tools: 10 }
    },
    {
        id: "s3",
        slug: "core-utilities",
        name: "Core Utilities",
        description: "Date/time, math, ID generation, JSON parsing",
        instructions: "Utility tools",
        category: "utility",
        tags: ["utilities", "datetime", "math"],
        _count: { tools: 4 }
    },
    {
        id: "s4",
        slug: "bim-engineering",
        name: "BIM Engineering",
        description: "Building Information Modeling analysis",
        instructions: "BIM tools for construction",
        category: "domain",
        tags: ["bim", "engineering", "construction"],
        _count: { tools: 5 }
    }
];

describe("Skill Recommender", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        prismaMock.skill.findMany.mockResolvedValue(mockSkills as never);
    });

    it("should recommend CRM skill for CRM-related instructions", async () => {
        const results = await recommendSkills(
            "I need an agent that manages CRM contacts and deals in HubSpot"
        );

        expect(results.length).toBeGreaterThan(0);
        const hubspot = results.find((r) => r.slug === "mcp-crm-hubspot");
        expect(hubspot).toBeDefined();
        expect(hubspot!.confidence).toBeGreaterThan(0);
    });

    it("should recommend Jira skill for project management instructions", async () => {
        const results = await recommendSkills(
            "This agent creates and manages Jira issues for sprint planning"
        );

        const jira = results.find((r) => r.slug === "mcp-project-jira");
        expect(jira).toBeDefined();
        expect(jira!.confidence).toBeGreaterThan(0);
    });

    it("should boost utility skills", async () => {
        const results = await recommendSkills("A general purpose helper agent");

        const utilities = results.find((r) => r.slug === "core-utilities");
        expect(utilities).toBeDefined();
    });

    it("should recommend BIM skill for construction-related instructions", async () => {
        const results = await recommendSkills(
            "Analyze building models, compute takeoffs, and detect clashes in BIM data"
        );

        const bim = results.find((r) => r.slug === "bim-engineering");
        expect(bim).toBeDefined();
        expect(bim!.confidence).toBeGreaterThan(0);
    });

    it("should exclude already-attached skills", async () => {
        prismaMock.agentSkill.findMany.mockResolvedValue([{ skillId: "s1" } as never]);

        const results = await recommendSkills("CRM and contact management", {
            agentId: "agent-1",
            excludeAttached: true
        });

        const hubspot = results.find((r) => r.slug === "mcp-crm-hubspot");
        expect(hubspot).toBeUndefined();
    });

    it("should respect maxResults", async () => {
        const results = await recommendSkills("agent that does everything", {
            maxResults: 2
        });

        expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return confidence between 0 and 1", async () => {
        const results = await recommendSkills("CRM contacts HubSpot deals pipeline");

        for (const r of results) {
            expect(r.confidence).toBeGreaterThanOrEqual(0);
            expect(r.confidence).toBeLessThanOrEqual(1);
        }
    });

    it("should include rationale for each recommendation", async () => {
        const results = await recommendSkills("Manage Jira tickets and sprints");

        for (const r of results) {
            expect(r.rationale).toBeDefined();
            expect(typeof r.rationale).toBe("string");
        }
    });

    it("should handle empty instructions", async () => {
        const results = await recommendSkills("");

        // Should still return some results (utility boost)
        expect(Array.isArray(results)).toBe(true);
    });
});
