import { McpToolDefinition, McpToolRoute } from "./types";

export const outputActionToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-output-actions-list",
        description: "List output actions for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "output-actions"
    },
    {
        name: "agent-output-action-create",
        description:
            "Create an output action for an agent. Output actions handle plumbing (WEBHOOK, CHAIN_AGENT). Agents handle their own communication via MCP tools.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                name: { type: "string", description: "Action name" },
                type: {
                    type: "string",
                    description: "Action type: WEBHOOK or CHAIN_AGENT"
                },
                configJson: {
                    type: "object",
                    description:
                        "Action config. WEBHOOK: {url, headers?, secret?}. CHAIN_AGENT: {agentSlug, inputTemplate?}"
                },
                isActive: { type: "boolean" }
            },
            required: ["agentId", "name", "type", "configJson"]
        },
        invoke_url: "/api/mcp",
        category: "output-actions"
    },
    {
        name: "agent-output-action-update",
        description: "Update an output action for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                actionId: { type: "string", description: "Output action ID" },
                name: { type: "string" },
                type: { type: "string" },
                configJson: { type: "object" },
                isActive: { type: "boolean" }
            },
            required: ["agentId", "actionId"]
        },
        invoke_url: "/api/mcp",
        category: "output-actions"
    },
    {
        name: "agent-output-action-delete",
        description: "Delete an output action for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                actionId: { type: "string", description: "Output action ID" }
            },
            required: ["agentId", "actionId"]
        },
        invoke_url: "/api/mcp",
        category: "output-actions"
    },
    {
        name: "agent-output-action-test",
        description:
            "Test an output action by executing it against the agent's most recent completed run.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                actionId: { type: "string", description: "Output action ID" }
            },
            required: ["agentId", "actionId"]
        },
        invoke_url: "/api/mcp",
        category: "output-actions"
    }
];

export const outputActionToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-output-actions-list",
        method: "GET",
        path: "/api/agents/{agentId}/output-actions",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "agent-output-action-create",
        method: "POST",
        path: "/api/agents/{agentId}/output-actions",
        pathParams: ["agentId"],
        bodyParams: ["name", "type", "configJson", "isActive"]
    },
    {
        kind: "internal",
        name: "agent-output-action-update",
        method: "PATCH",
        path: "/api/agents/{agentId}/output-actions/{actionId}",
        pathParams: ["agentId", "actionId"],
        bodyParams: ["name", "type", "configJson", "isActive"]
    },
    {
        kind: "internal",
        name: "agent-output-action-delete",
        method: "DELETE",
        path: "/api/agents/{agentId}/output-actions/{actionId}",
        pathParams: ["agentId", "actionId"]
    },
    {
        kind: "internal",
        name: "agent-output-action-test",
        method: "POST",
        path: "/api/agents/{agentId}/output-actions/{actionId}/test",
        pathParams: ["agentId", "actionId"]
    }
];
