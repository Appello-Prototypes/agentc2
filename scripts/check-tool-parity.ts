#!/usr/bin/env bun
/**
 * Tool Parity Check Script
 *
 * Compares three sources of truth:
 *   1. Tool Registry (packages/agentc2/src/tools/registry.ts) — all tools available to agents
 *   2. MCP Schema (packages/agentc2/src/tools/mcp-schemas/index.ts) — tools exposed via MCP to Cursor IDE
 *   3. Workspace Concierge agent (live API) — tools actually attached to the Concierge
 *
 * Reports gaps between each pair and exits with code 1 if any are found.
 *
 * Usage:
 *   bun run scripts/check-tool-parity.ts
 *   bun run scripts/check-tool-parity.ts --json          # JSON output
 *   bun run scripts/check-tool-parity.ts --skip-api      # Skip live Concierge check
 */

import { toolRegistry, toolCategoryMap } from "../packages/agentc2/src/tools/registry";
import { mcpToolDefinitions } from "../packages/agentc2/src/tools/mcp-schemas/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const skipApi = args.has("--skip-api");

/**
 * Normalise MCP schema names to registry-style hyphenated IDs.
 *
 * Known naming discrepancies between MCP schema and registry:
 *   - Schedules: MCP "agent_schedule_create" -> registry "schedule-create"
 *   - Execution triggers: MCP "agent_trigger_unified_list" -> registry "trigger-unified-list"
 *   - Legacy triggers: MCP "agent_trigger_create" -> registry (no equivalent, skip)
 *   - Workflow ops: MCP "workflow.execute" -> registry "workflow-execute"
 *   - Network ops: MCP "network.execute" -> registry "network-execute"
 */
const mcpToRegistryOverrides: Record<string, string> = {
    // Schedule tools (MCP uses agent_ prefix, registry does not)
    agent_schedule_create: "schedule-create",
    agent_schedule_list: "schedule-list",
    agent_schedule_update: "schedule-update",
    agent_schedule_delete: "schedule-delete",

    // Execution trigger tools (MCP uses agent_trigger_ prefix, registry uses trigger-)
    agent_trigger_unified_list: "trigger-unified-list",
    agent_trigger_unified_get: "trigger-unified-get",
    agent_trigger_unified_create: "trigger-unified-create",
    agent_trigger_unified_update: "trigger-unified-update",
    agent_trigger_unified_delete: "trigger-unified-delete",
    agent_trigger_unified_enable: "trigger-unified-enable",
    agent_trigger_unified_disable: "trigger-unified-disable",
    agent_trigger_test: "trigger-test",
    agent_trigger_execute: "trigger-execute",

    // Legacy triggers (MCP uses agent_trigger_ prefix; these are superseded)
    agent_trigger_create: "__legacy_trigger_create",
    agent_trigger_list: "__legacy_trigger_list",
    agent_trigger_update: "__legacy_trigger_update",
    agent_trigger_delete: "__legacy_trigger_delete",

    // Workflow ops with dot notation
    "workflow.execute": "workflow-execute",
    "workflow.list-runs": "workflow-list-runs",
    "workflow.get-run": "workflow-get-run",

    // Network ops with dot notation
    "network.execute": "network-execute",
    "network.list-runs": "network-list-runs",
    "network.get-run": "network-get-run"
};

/** Legacy MCP tools that are intentionally NOT in the registry */
const legacyMcpTools = new Set([
    "__legacy_trigger_create",
    "__legacy_trigger_list",
    "__legacy_trigger_update",
    "__legacy_trigger_delete"
]);

function normaliseToRegistryId(mcpName: string): string {
    // Check explicit overrides first
    if (mcpToRegistryOverrides[mcpName]) {
        return mcpToRegistryOverrides[mcpName];
    }
    // Default: replace underscores with hyphens
    return mcpName.replace(/_/g, "-");
}

/** Fetch Concierge tools from the platform API */
async function fetchConciergeTools(): Promise<string[]> {
    const baseUrl =
        process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const apiKey = process.env.MCP_API_KEY;
    const orgSlug = process.env.MCP_API_ORGANIZATION_SLUG || "default";

    if (!apiKey) {
        console.warn("[Parity] MCP_API_KEY not set — skipping live Concierge check");
        return [];
    }

    const url = `${baseUrl}/api/agents/workspace-concierge`;
    const resp = await fetch(url, {
        headers: {
            "x-api-key": apiKey,
            "x-organization-slug": orgSlug
        }
    });

    if (!resp.ok) {
        console.warn(`[Parity] Failed to fetch Concierge agent: ${resp.status} ${resp.statusText}`);
        return [];
    }

    const data = (await resp.json()) as {
        tools?: Array<{ toolId?: string; name?: string }>;
    };
    if (!data.tools || !Array.isArray(data.tools)) return [];

    return data.tools.map((t) => t.toolId || t.name || "").filter(Boolean);
}

// ---------------------------------------------------------------------------
// Gather sources
// ---------------------------------------------------------------------------

// 1. Registry tool IDs
const registryIds = new Set(Object.keys(toolRegistry));

// 2. MCP schema tool names (normalised), excluding legacy tools
const mcpIdsAll = mcpToolDefinitions.map((d) => normaliseToRegistryId(d.name));
const mcpIds = new Set(mcpIdsAll.filter((id) => !legacyMcpTools.has(id)));

// 3. Concierge tool IDs (live or empty)
let conciergeIds = new Set<string>();
if (!skipApi) {
    const tools = await fetchConciergeTools();
    conciergeIds = new Set(tools);
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

// A. MCP tools missing from Registry
const mcpNotInRegistry = [...mcpIds].filter((id) => !registryIds.has(id)).sort();

// B. Registry tools missing from MCP Schema (informational — some are intentionally registry-only)
const registryNotInMcp = [...registryIds].filter((id) => !mcpIds.has(id)).sort();

// C. Registry tools missing from Concierge
const registryNotOnConcierge =
    conciergeIds.size > 0 ? [...registryIds].filter((id) => !conciergeIds.has(id)).sort() : [];

// D. MCP tools missing from Concierge
const mcpNotOnConcierge =
    conciergeIds.size > 0 ? [...mcpIds].filter((id) => !conciergeIds.has(id)).sort() : [];

// E. Concierge tools not in Registry (stale references)
const conciergeNotInRegistry =
    conciergeIds.size > 0 ? [...conciergeIds].filter((id) => !registryIds.has(id)).sort() : [];

// ---------------------------------------------------------------------------
// Categorise registry-only tools (expected exclusions)
// ---------------------------------------------------------------------------

// Tools that are intentionally registry-only (not exposed via MCP)
const knownRegistryOnlyPrefixes = [
    "bim-", // BIM tools — domain-specific
    "gmail-", // Native OAuth tools — not MCP-proxied
    "google-calendar-",
    "google-drive-",
    "outlook-mail-",
    "outlook-calendar-",
    "dropbox-",
    "metrics-", // Internal metrics helpers
    "workspace-intent-",
    "webhook-",
    "search-skills", // Skill discovery meta-tools
    "activate-skill",
    "list-active-skills",
    "ask-questions", // Interactive UI tool
    "calculator", // Utility tools — agent-only, not MCP-exposed
    "date-time",
    "generate-id",
    "json-parser",
    "memory-recall",
    "web-fetch",
    "web-search",
    "web-scrape",
    "integration-import-mcp-json" // Internal import helper
];

const expectedRegistryOnly = registryNotInMcp.filter((id) =>
    knownRegistryOnlyPrefixes.some((p) => id.startsWith(p) || id === p)
);
const unexpectedRegistryOnly = registryNotInMcp.filter((id) => !expectedRegistryOnly.includes(id));

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const report = {
    counts: {
        registry: registryIds.size,
        mcpSchema: mcpIds.size,
        concierge: conciergeIds.size
    },
    gaps: {
        mcpNotInRegistry: mcpNotInRegistry,
        unexpectedRegistryNotInMcp: unexpectedRegistryOnly,
        expectedRegistryOnly: expectedRegistryOnly,
        registryNotOnConcierge: registryNotOnConcierge,
        mcpNotOnConcierge: mcpNotOnConcierge,
        conciergeStaleRefs: conciergeNotInRegistry
    },
    hasGaps:
        mcpNotInRegistry.length > 0 ||
        unexpectedRegistryOnly.length > 0 ||
        registryNotOnConcierge.length > 0 ||
        mcpNotOnConcierge.length > 0 ||
        conciergeNotInRegistry.length > 0
};

if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
} else {
    console.log("\n========================================");
    console.log("  AgentC2 Tool Parity Check");
    console.log("========================================\n");

    console.log(`Registry tools:   ${report.counts.registry}`);
    console.log(`MCP schema tools: ${report.counts.mcpSchema}`);
    console.log(`Concierge tools:  ${report.counts.concierge || "(skipped)"}\n`);

    const section = (title: string, items: string[], level: "error" | "warn" | "info") => {
        if (items.length === 0) {
            console.log(`✅ ${title}: 0`);
            return;
        }
        const icon = level === "error" ? "❌" : level === "warn" ? "⚠️ " : "ℹ️ ";
        console.log(`${icon} ${title}: ${items.length}`);
        items.forEach((id) => console.log(`   - ${id}`));
        console.log();
    };

    section("MCP tools missing from Registry", mcpNotInRegistry, "error");
    section("Registry tools missing from MCP (unexpected)", unexpectedRegistryOnly, "warn");
    section("Registry tools intentionally MCP-excluded", expectedRegistryOnly, "info");

    if (conciergeIds.size > 0) {
        section("Registry tools not on Concierge", registryNotOnConcierge, "error");
        section("MCP tools not on Concierge", mcpNotOnConcierge, "error");
        section("Concierge stale tool refs (not in Registry)", conciergeNotInRegistry, "warn");
    } else {
        console.log("(Concierge live check skipped — set MCP_API_KEY or remove --skip-api)\n");
    }

    console.log("========================================");
    if (report.hasGaps) {
        console.log("RESULT: GAPS FOUND — parity not achieved");
    } else {
        console.log("RESULT: PARITY ACHIEVED ✅");
    }
    console.log("========================================\n");
}

process.exit(report.hasGaps ? 1 : 0);
