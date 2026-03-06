import { McpToolDefinition, McpToolRoute } from "./types";

export const agentPermissionToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-permissions-list",
        description:
            "List all tool permission overrides for an agent. Returns per-tool permission levels and cost limits.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: {
                    type: "string",
                    description: "Agent ID or slug"
                }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "governance"
    },
    {
        name: "agent-permissions-set",
        description:
            "Set or update a tool permission override for an agent. Controls what level of access the agent has to a specific tool.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: {
                    type: "string",
                    description: "Agent ID or slug"
                },
                toolId: {
                    type: "string",
                    description: "Tool identifier to set permission for"
                },
                permission: {
                    type: "string",
                    description: "Permission level: 'read_only', 'write', 'spend', or 'full'"
                },
                maxCostUsd: {
                    type: "number",
                    description:
                        "Optional per-invocation cost limit in USD (only relevant for 'spend' permission)"
                }
            },
            required: ["agentId", "toolId", "permission"]
        },
        invoke_url: "/api/mcp",
        category: "governance"
    },
    {
        name: "agent-permissions-remove",
        description:
            "Remove a tool permission override for an agent, reverting to the default 'full' permission.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: {
                    type: "string",
                    description: "Agent ID or slug"
                },
                toolId: {
                    type: "string",
                    description: "Tool identifier to remove permission override for"
                }
            },
            required: ["agentId", "toolId"]
        },
        invoke_url: "/api/mcp",
        category: "governance"
    }
];

export const agentPermissionToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-permissions-list",
        method: "GET",
        path: "/api/agents/{agentId}/permissions",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "agent-permissions-set",
        method: "PUT",
        path: "/api/agents/{agentId}/permissions",
        pathParams: ["agentId"],
        bodyParams: ["toolId", "permission", "maxCostUsd"]
    },
    {
        kind: "internal",
        name: "agent-permissions-remove",
        method: "DELETE",
        path: "/api/agents/{agentId}/permissions",
        pathParams: ["agentId"],
        bodyParams: ["toolId"]
    }
];
