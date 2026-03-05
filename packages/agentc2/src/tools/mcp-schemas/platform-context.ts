import { McpToolDefinition, McpToolRoute } from "./types";

export const platformContextToolDefinitions: McpToolDefinition[] = [
    {
        name: "platform-context",
        description:
            "CALL FIRST: Returns a compact manifest of every agent, network, workflow, skill, MCP server, and tool category on the platform. " +
            "Use this to discover valid slugs/IDs before calling agent-read, network-read, network-execute, agent-invoke-dynamic, etc. " +
            "Eliminates slug-guessing failures. No parameters required.",
        inputSchema: {
            type: "object",
            properties: {
                includeTools: {
                    type: "boolean",
                    description:
                        "Include per-category tool ID lists (default: false — only counts are returned)"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "platform"
    }
];

export const platformContextToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "platform-context" }
];
