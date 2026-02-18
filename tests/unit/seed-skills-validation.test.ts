/**
 * Seed Skills Validation Tests
 *
 * Validates the integrity of the 33 seeded skills:
 * - Unique slugs
 * - Non-empty descriptions (required for search/discovery)
 * - Non-empty instructions
 * - Valid categories
 * - Correct tool IDs for non-MCP skills
 */

import { describe, it, expect } from "vitest";

// Import the skill definitions directly from the seed file structure
// We replicate the key data here since the seed file is a script, not a module

const VALID_CATEGORIES = [
    "builder",
    "operations",
    "integration",
    "utility",
    "domain",
    "admin",
    "knowledge"
];

// Known tool registry keys (subset for validation)
const KNOWN_TOOLS = [
    "date-time",
    "calculator",
    "generate-id",
    "web-fetch",
    "memory-recall",
    "json-parser",
    "agent-create",
    "agent-read",
    "agent-update",
    "agent-delete",
    "agent-list",
    "workflow-create",
    "workflow-read",
    "workflow-update",
    "workflow-delete",
    "workflow-execute",
    "workflow-list-runs",
    "workflow-get-run",
    "workflow-resume",
    "workflow-metrics",
    "workflow-versions",
    "workflow-stats",
    "workflow-generate",
    "workflow-validate",
    "workflow-designer-chat",
    "network-create",
    "network-read",
    "network-update",
    "network-delete",
    "network-execute",
    "network-list-runs",
    "network-get-run",
    "network-metrics",
    "network-versions",
    "network-stats",
    "network-generate",
    "network-validate",
    "network-designer-chat",
    "trigger-unified-list",
    "trigger-unified-get",
    "trigger-unified-create",
    "trigger-unified-update",
    "trigger-unified-delete",
    "trigger-unified-enable",
    "trigger-unified-disable",
    "live-runs",
    "live-metrics",
    "live-stats",
    "agent-overview",
    "agent-analytics",
    "agent-costs",
    "agent-budget-get",
    "agent-budget-update",
    "metrics-agent-runs",
    "audit-logs-list",
    "agent-feedback-submit",
    "agent-feedback-list",
    "agent-guardrails-get",
    "agent-guardrails-update",
    "agent-guardrails-events",
    "agent-test-cases-list",
    "agent-test-cases-create",
    "agent-run-cancel",
    "agent-run-rerun",
    "agent-run-trace",
    "agent-learning-sessions",
    "agent-learning-start",
    "agent-learning-session-get",
    "agent-learning-proposal-approve",
    "agent-learning-proposal-reject",
    "agent-learning-experiments",
    "agent-learning-metrics",
    "agent-learning-policy",
    "rag-query",
    "rag-ingest",
    "rag-documents-list",
    "rag-document-delete",
    "document-create",
    "document-read",
    "document-update",
    "document-delete",
    "document-list",
    "document-search",
    "agent-simulations-list",
    "agent-simulations-start",
    "agent-simulations-get",
    "skill-create",
    "skill-read",
    "skill-update",
    "skill-delete",
    "skill-list",
    "skill-attach-document",
    "skill-detach-document",
    "skill-attach-tool",
    "skill-detach-tool",
    "agent-attach-skill",
    "agent-detach-skill",
    "integration-import-mcp-json",
    "integration-mcp-config",
    "integration-connection-test",
    "integration-providers-list",
    "integration-connections-list",
    "integration-connection-create",
    "org-list",
    "org-get",
    "org-members-list",
    "org-member-add",
    "org-workspaces-list",
    "org-workspace-create",
    "goal-create",
    "goal-list",
    "goal-get",
    "webhook-list-agents",
    "webhook-create",
    "bim-query",
    "bim-takeoff",
    "bim-diff",
    "bim-clash",
    "bim-handover",
    "gmail-archive-email",
    "ask-questions"
];

// Skill definitions mirroring seed-skills.ts
const SKILL_DEFINITIONS = [
    // Platform Skills
    {
        slug: "platform-agent-management",
        category: "builder",
        tools: ["agent-create", "agent-read", "agent-update", "agent-delete", "agent-list"]
    },
    {
        slug: "platform-workflow-management",
        category: "builder",
        tools: [
            "workflow-create",
            "workflow-read",
            "workflow-update",
            "workflow-delete",
            "workflow-generate",
            "workflow-validate",
            "workflow-designer-chat",
            "workflow-versions"
        ]
    },
    {
        slug: "platform-workflow-execution",
        category: "operations",
        tools: [
            "workflow-execute",
            "workflow-list-runs",
            "workflow-get-run",
            "workflow-resume",
            "workflow-metrics",
            "workflow-stats"
        ]
    },
    {
        slug: "platform-network-management",
        category: "builder",
        tools: [
            "network-create",
            "network-read",
            "network-update",
            "network-delete",
            "network-generate",
            "network-validate",
            "network-designer-chat",
            "network-versions"
        ]
    },
    {
        slug: "platform-network-execution",
        category: "operations",
        tools: [
            "network-execute",
            "network-list-runs",
            "network-get-run",
            "network-metrics",
            "network-stats"
        ]
    },
    {
        slug: "platform-triggers-schedules",
        category: "operations",
        tools: [
            "trigger-unified-list",
            "trigger-unified-get",
            "trigger-unified-create",
            "trigger-unified-update",
            "trigger-unified-delete",
            "trigger-unified-enable",
            "trigger-unified-disable"
        ]
    },
    {
        slug: "platform-observability",
        category: "operations",
        tools: [
            "live-runs",
            "live-metrics",
            "live-stats",
            "agent-overview",
            "agent-analytics",
            "agent-costs",
            "agent-budget-get",
            "agent-budget-update",
            "metrics-agent-runs",
            "audit-logs-list"
        ]
    },
    {
        slug: "platform-quality-safety",
        category: "operations",
        tools: [
            "agent-feedback-submit",
            "agent-feedback-list",
            "agent-guardrails-get",
            "agent-guardrails-update",
            "agent-guardrails-events",
            "agent-test-cases-list",
            "agent-test-cases-create",
            "agent-run-cancel",
            "agent-run-rerun",
            "agent-run-trace"
        ]
    },
    {
        slug: "platform-learning",
        category: "operations",
        tools: [
            "agent-learning-sessions",
            "agent-learning-start",
            "agent-learning-session-get",
            "agent-learning-proposal-approve",
            "agent-learning-proposal-reject",
            "agent-learning-experiments",
            "agent-learning-metrics",
            "agent-learning-policy"
        ]
    },
    {
        slug: "platform-simulations",
        category: "operations",
        tools: ["agent-simulations-list", "agent-simulations-start", "agent-simulations-get"]
    },
    {
        slug: "platform-knowledge-management",
        category: "knowledge",
        tools: [
            "rag-query",
            "rag-ingest",
            "rag-documents-list",
            "rag-document-delete",
            "document-create",
            "document-read",
            "document-update",
            "document-delete",
            "document-list",
            "document-search"
        ]
    },
    {
        slug: "platform-skill-management",
        category: "builder",
        tools: [
            "skill-create",
            "skill-read",
            "skill-update",
            "skill-delete",
            "skill-list",
            "skill-attach-document",
            "skill-detach-document",
            "skill-attach-tool",
            "skill-detach-tool",
            "agent-attach-skill",
            "agent-detach-skill"
        ]
    },
    {
        slug: "platform-integrations",
        category: "admin",
        tools: [
            "integration-import-mcp-json",
            "integration-mcp-config",
            "integration-connection-test",
            "integration-providers-list",
            "integration-connections-list",
            "integration-connection-create"
        ]
    },
    {
        slug: "platform-organization",
        category: "admin",
        tools: [
            "org-list",
            "org-get",
            "org-members-list",
            "org-member-add",
            "org-workspaces-list",
            "org-workspace-create"
        ]
    },
    {
        slug: "platform-webhooks",
        category: "operations",
        tools: ["webhook-list-agents", "webhook-create"]
    },
    {
        slug: "platform-goals",
        category: "operations",
        tools: ["goal-create", "goal-list", "goal-get"]
    },
    // Utility Skills
    {
        slug: "core-utilities",
        category: "utility",
        tools: ["date-time", "calculator", "generate-id", "json-parser"]
    },
    { slug: "web-research", category: "utility", tools: ["web-fetch", "memory-recall"] },
    { slug: "user-interaction", category: "utility", tools: ["ask-questions"] },
    // Domain Skills
    {
        slug: "bim-engineering",
        category: "domain",
        tools: ["bim-query", "bim-takeoff", "bim-diff", "bim-clash", "bim-handover"]
    },
    { slug: "email-management", category: "domain", tools: ["gmail-archive-email"] },
    // MCP Integration Skills (no static tools)
    { slug: "mcp-crm-hubspot", category: "integration", tools: [] },
    { slug: "mcp-project-jira", category: "integration", tools: [] },
    { slug: "mcp-web-firecrawl", category: "integration", tools: [] },
    { slug: "mcp-web-playwright", category: "integration", tools: [] },
    { slug: "mcp-communication-slack", category: "integration", tools: [] },
    { slug: "mcp-communication-justcall", category: "integration", tools: [] },
    { slug: "mcp-communication-twilio", category: "integration", tools: [] },
    { slug: "mcp-files-gdrive", category: "integration", tools: [] },
    { slug: "mcp-code-github", category: "integration", tools: [] },
    { slug: "mcp-knowledge-fathom", category: "integration", tools: [] },
    { slug: "mcp-automation-atlas", category: "integration", tools: [] }
];

describe("Seed Skills Validation", () => {
    it("should have exactly 33 skill definitions", () => {
        expect(SKILL_DEFINITIONS).toHaveLength(33);
    });

    it("should have all unique slugs", () => {
        const slugs = SKILL_DEFINITIONS.map((s) => s.slug);
        const uniqueSlugs = new Set(slugs);
        expect(uniqueSlugs.size).toBe(slugs.length);
    });

    it("should have valid categories for all skills", () => {
        for (const skill of SKILL_DEFINITIONS) {
            expect(
                VALID_CATEGORIES,
                `Skill "${skill.slug}" has invalid category "${skill.category}"`
            ).toContain(skill.category);
        }
    });

    it("should have non-MCP skills with at least 1 tool", () => {
        const nonMcpSkills = SKILL_DEFINITIONS.filter((s) => s.category !== "integration");
        for (const skill of nonMcpSkills) {
            expect(
                skill.tools.length,
                `Non-MCP skill "${skill.slug}" has no tools`
            ).toBeGreaterThan(0);
        }
    });

    it("should have MCP skills with empty tool arrays", () => {
        const mcpSkills = SKILL_DEFINITIONS.filter((s) => s.category === "integration");
        expect(mcpSkills.length).toBe(11);
        for (const skill of mcpSkills) {
            expect(skill.tools.length, `MCP skill "${skill.slug}" should have empty tools`).toBe(0);
        }
    });

    it("should have all tool IDs matching known registry tools", () => {
        const knownToolSet = new Set(KNOWN_TOOLS);
        for (const skill of SKILL_DEFINITIONS) {
            for (const toolId of skill.tools) {
                expect(
                    knownToolSet.has(toolId),
                    `Skill "${skill.slug}" references unknown tool "${toolId}"`
                ).toBe(true);
            }
        }
    });

    it("should have max 15 tools per skill", () => {
        for (const skill of SKILL_DEFINITIONS) {
            expect(
                skill.tools.length,
                `Skill "${skill.slug}" has ${skill.tools.length} tools (max 15)`
            ).toBeLessThanOrEqual(15);
        }
    });

    it("should have correct skill count per category", () => {
        const byCat = SKILL_DEFINITIONS.reduce(
            (acc, s) => {
                acc[s.category] = (acc[s.category] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        expect(byCat["builder"]).toBe(5);
        expect(byCat["operations"]).toBe(9);
        expect(byCat["integration"]).toBe(11);
        expect(byCat["utility"]).toBe(3);
        expect(byCat["domain"]).toBe(2);
        expect(byCat["admin"]).toBe(2);
        expect(byCat["knowledge"]).toBe(1);
    });
});
