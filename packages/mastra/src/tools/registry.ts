/**
 * Tool Registry
 *
 * Central registry of all available tools that can be attached to stored agents.
 * Tools are referenced by their registry key (e.g., "calculator", "web-fetch").
 * Also supports MCP tools dynamically via getMcpTools().
 */

import { dateTimeTool, calculatorTool, generateIdTool } from "./example-tools";
import { webFetchTool } from "./web-fetch";
import { memoryRecallTool } from "./memory-recall";
import { jsonParserTool } from "./json-parser";
import { workflowExecuteTool, workflowGetRunTool, workflowListRunsTool } from "./workflow-tools";
import { networkExecuteTool, networkGetRunTool, networkListRunsTool } from "./network-tools";
import {
    bimQueryTool,
    bimTakeoffTool,
    bimDiffTool,
    bimClashTool,
    bimHandoverTool
} from "./bim-tools";
import { getMcpTools } from "../mcp/client";

/**
 * Tool registry mapping names to tool instances.
 * Add new tools here to make them available for stored agents.
 * Using Record<string, unknown> to avoid complex Mastra Tool typing issues.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toolRegistry: Record<string, any> = {
    // Example tools
    "date-time": dateTimeTool,
    calculator: calculatorTool,
    "generate-id": generateIdTool,

    // Utility tools
    "web-fetch": webFetchTool,
    "memory-recall": memoryRecallTool,
    "json-parser": jsonParserTool,

    // Workflow and network tools
    "workflow-execute": workflowExecuteTool,
    "workflow-list-runs": workflowListRunsTool,
    "workflow-get-run": workflowGetRunTool,
    "network-execute": networkExecuteTool,
    "network-list-runs": networkListRunsTool,
    "network-get-run": networkGetRunTool,

    // BIM tools
    "bim-query": bimQueryTool,
    "bim-takeoff": bimTakeoffTool,
    "bim-diff": bimDiffTool,
    "bim-clash": bimClashTool,
    "bim-handover": bimHandoverTool
};

/**
 * Get MCP tools (cached for performance)
 * Returns an empty object if MCP is not available
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cachedMcpToolsByOrg = new Map<string, { tools: Record<string, any>; loadedAt: number }>();
const MCP_CACHE_TTL = 60000; // 1 minute cache

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMcpToolsCached(organizationId?: string | null): Promise<Record<string, any>> {
    const cacheKey = organizationId || "__default__";
    const now = Date.now();
    const cached = cachedMcpToolsByOrg.get(cacheKey);
    if (cached && now - cached.loadedAt < MCP_CACHE_TTL) {
        return cached.tools;
    }

    try {
        const tools = await getMcpTools(organizationId);
        cachedMcpToolsByOrg.set(cacheKey, { tools, loadedAt: now });
        return tools;
    } catch (error) {
        console.warn("[Tool Registry] Failed to load MCP tools:", error);
        return {};
    }
}

/**
 * Get tool metadata for UI display
 */
export interface ToolInfo {
    id: string;
    name: string;
    description: string;
}

/**
 * List all available tools with their metadata
 */
export function listAvailableTools(): ToolInfo[] {
    return Object.entries(toolRegistry).map(([id, tool]) => ({
        id,
        name: id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        description: (tool as any).description || ""
    }));
}

/**
 * Get tools by their registry names (sync - static tools only)
 *
 * @param names - Array of tool registry names (e.g., ["calculator", "web-fetch"])
 * @returns Record of tool name to tool instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getToolsByNames(names: string[]): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};

    for (const name of names) {
        const tool = toolRegistry[name];
        if (tool) {
            result[name] = tool;
        }
    }

    return result;
}

/**
 * Get tools by their names (async - includes MCP tools)
 *
 * Checks both the static registry and MCP tools.
 * MCP tools are identified by underscore naming: serverName_toolName
 *
 * @param names - Array of tool names (e.g., ["calculator", "hubspot_hubspot-get-contacts"])
 * @returns Record of tool name to tool instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getToolsByNamesAsync(
    names: string[],
    organizationId?: string | null
): Promise<Record<string, any>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};

    // First, get static tools
    for (const name of names) {
        const tool = toolRegistry[name];
        if (tool) {
            result[name] = tool;
        }
    }

    // Find names not in static registry (likely MCP tools)
    const unresolvedNames = names.filter((name) => !result[name]);

    if (unresolvedNames.length > 0) {
        // Load MCP tools and check for matches
        const mcpTools = await getMcpToolsCached(organizationId);

        for (const name of unresolvedNames) {
            if (mcpTools[name]) {
                result[name] = mcpTools[name];
            }
        }
    }

    return result;
}

/**
 * Check if a tool exists in the registry
 */
export function hasToolInRegistry(name: string): boolean {
    return name in toolRegistry;
}

/**
 * Get a single tool by name
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getToolByName(name: string): any | undefined {
    return toolRegistry[name];
}

/**
 * Get all available MCP tools (cached)
 *
 * Use this to attach all MCP tools to MCP-enabled agents.
 * Returns an empty object if MCP is not available.
 *
 * @returns Record of MCP tool name to tool instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAllMcpTools(organizationId?: string | null): Promise<Record<string, any>> {
    return getMcpToolsCached(organizationId);
}
