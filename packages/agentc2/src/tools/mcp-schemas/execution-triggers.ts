import { McpToolDefinition, McpToolRoute } from "./types";

const workflowTriggerInputSchema = {
    type: "object" as const,
    properties: {
        workflowSlug: { type: "string" as const, description: "Workflow slug or ID" },
        type: {
            type: "string" as const,
            description: "Trigger type: scheduled, webhook, event, api, manual, test, mcp"
        },
        name: { type: "string" as const },
        description: { type: "string" as const },
        config: {
            type: "object" as const,
            description: "Type-specific config (e.g. { eventName } for event triggers)"
        },
        filter: { type: "object" as const },
        inputMapping: { type: "object" as const },
        isActive: { type: "boolean" as const }
    }
};

const networkTriggerInputSchema = {
    type: "object" as const,
    properties: {
        networkSlug: { type: "string" as const, description: "Network slug or ID" },
        type: {
            type: "string" as const,
            description: "Trigger type: scheduled, webhook, event, api, manual, test, mcp"
        },
        name: { type: "string" as const },
        description: { type: "string" as const },
        config: {
            type: "object" as const,
            description: "Type-specific config (e.g. { eventName } for event triggers)"
        },
        filter: { type: "object" as const },
        inputMapping: { type: "object" as const },
        isActive: { type: "boolean" as const }
    }
};

export const executionTriggerToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-trigger-unified-list",
        description: "List all execution triggers for an agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-get",
        description: "Get a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-create",
        description: "Create a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                type: { type: "string", description: "Trigger type" },
                name: { type: "string" },
                description: { type: "string" },
                config: { type: "object" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                environment: { type: "string" },
                filter: { type: "object" },
                inputMapping: { type: "object" },
                isActive: { type: "boolean" }
            },
            required: ["agentId", "type", "name"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-update",
        description: "Update a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                name: { type: "string" },
                description: { type: "string" },
                config: { type: "object" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                environment: { type: "string" },
                filter: { type: "object" },
                inputMapping: { type: "object" },
                isActive: { type: "boolean" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-delete",
        description: "Delete a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-enable",
        description: "Enable a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-unified-disable",
        description: "Disable a unified execution trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-test",
        description: "Dry-run a unified trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                payload: { type: "object" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                environment: { type: "string" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "agent-trigger-execute",
        description: "Execute a unified trigger.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Agent slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                payload: { type: "object" },
                input: { type: "string" },
                context: { type: "object" },
                maxSteps: { type: "number" },
                environment: { type: "string" }
            },
            required: ["agentId", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },

    // ── Workflow Trigger Tools ──
    {
        name: "workflow-trigger-list",
        description:
            "List all execution triggers for a workflow. Returns webhook, event, API, and other triggers with their status and stats.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" }
            },
            required: ["workflowSlug"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "workflow-trigger-get",
        description: "Get details of a specific workflow trigger.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["workflowSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "workflow-trigger-create",
        description:
            "Create a trigger for a workflow. Use type='webhook' to generate a webhook URL and secret that external apps can POST to. Returns the webhook path and secret (shown only once).",
        inputSchema: {
            ...workflowTriggerInputSchema,
            required: ["workflowSlug", "type", "name"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "workflow-trigger-update",
        description:
            "Update a workflow trigger's name, description, filter, inputMapping, or config.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                name: { type: "string" },
                description: { type: "string" },
                config: { type: "object" },
                filter: { type: "object" },
                inputMapping: { type: "object" },
                isActive: { type: "boolean" },
                isArchived: { type: "boolean" }
            },
            required: ["workflowSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "workflow-trigger-delete",
        description: "Permanently delete a workflow trigger.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["workflowSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers",
        annotations: { destructiveHint: true }
    },
    {
        name: "workflow-trigger-enable",
        description: "Enable a workflow trigger.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["workflowSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "workflow-trigger-disable",
        description: "Disable a workflow trigger.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["workflowSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "workflow-trigger-test",
        description:
            "Dry-run a workflow trigger without creating a run. Tests filter matching and input mapping.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                payload: { type: "object", description: "Test payload to simulate" }
            },
            required: ["workflowSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "workflow-trigger-execute",
        description:
            "Fire a workflow trigger with an optional payload, creating a real workflow run.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                payload: { type: "object", description: "Payload to pass to the workflow" }
            },
            required: ["workflowSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },

    // ── Network Trigger Tools ──
    {
        name: "network-trigger-list",
        description:
            "List all execution triggers for a network. Returns webhook, event, API, and other triggers with their status and stats.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" }
            },
            required: ["networkSlug"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "network-trigger-get",
        description: "Get details of a specific network trigger.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["networkSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "network-trigger-create",
        description:
            "Create a trigger for a network. Use type='webhook' to generate a webhook URL and secret that external apps can POST to. Returns the webhook path and secret (shown only once).",
        inputSchema: {
            ...networkTriggerInputSchema,
            required: ["networkSlug", "type", "name"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "network-trigger-update",
        description:
            "Update a network trigger's name, description, filter, inputMapping, or config.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                name: { type: "string" },
                description: { type: "string" },
                config: { type: "object" },
                filter: { type: "object" },
                inputMapping: { type: "object" },
                isActive: { type: "boolean" },
                isArchived: { type: "boolean" }
            },
            required: ["networkSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "network-trigger-delete",
        description: "Permanently delete a network trigger.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["networkSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers",
        annotations: { destructiveHint: true }
    },
    {
        name: "network-trigger-enable",
        description: "Enable a network trigger.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["networkSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "network-trigger-disable",
        description: "Disable a network trigger.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" }
            },
            required: ["networkSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "network-trigger-test",
        description: "Dry-run a network trigger without creating a run. Tests filter matching.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                payload: { type: "object", description: "Test payload to simulate" }
            },
            required: ["networkSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    },
    {
        name: "network-trigger-execute",
        description:
            "Fire a network trigger with an optional payload, queuing a real network execution.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                triggerId: { type: "string", description: "Unified trigger ID" },
                payload: { type: "object", description: "Payload to pass to the network" }
            },
            required: ["networkSlug", "triggerId"]
        },
        invoke_url: "/api/mcp",
        category: "execution-triggers"
    }
];

export const executionTriggerToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "agent-trigger-unified-list",
        method: "GET",
        path: "/api/agents/{agentId}/execution-triggers",
        pathParams: ["agentId"]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-get",
        method: "GET",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-create",
        method: "POST",
        path: "/api/agents/{agentId}/execution-triggers",
        pathParams: ["agentId"],
        bodyParams: [
            "type",
            "name",
            "description",
            "config",
            "input",
            "context",
            "maxSteps",
            "environment",
            "filter",
            "inputMapping",
            "isActive"
        ]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-update",
        method: "PATCH",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"],
        bodyParams: [
            "name",
            "description",
            "config",
            "input",
            "context",
            "maxSteps",
            "environment",
            "filter",
            "inputMapping",
            "isActive"
        ]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-delete",
        method: "DELETE",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"]
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-enable",
        method: "PATCH",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"],
        staticBody: { isActive: true }
    },
    {
        kind: "internal",
        name: "agent-trigger-unified-disable",
        method: "PATCH",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}",
        pathParams: ["agentId", "triggerId"],
        staticBody: { isActive: false }
    },
    {
        kind: "internal",
        name: "agent-trigger-test",
        method: "POST",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}/test",
        pathParams: ["agentId", "triggerId"],
        bodyParams: ["payload", "input", "context", "maxSteps", "environment"]
    },
    {
        kind: "internal",
        name: "agent-trigger-execute",
        method: "POST",
        path: "/api/agents/{agentId}/execution-triggers/{triggerId}/execute",
        pathParams: ["agentId", "triggerId"],
        bodyParams: ["payload", "input", "context", "maxSteps", "environment"]
    },

    // ── Workflow Trigger Routes ──
    {
        kind: "internal",
        name: "workflow-trigger-list",
        method: "GET",
        path: "/api/workflows/{workflowSlug}/execution-triggers",
        pathParams: ["workflowSlug"]
    },
    {
        kind: "internal",
        name: "workflow-trigger-get",
        method: "GET",
        path: "/api/workflows/{workflowSlug}/execution-triggers/{triggerId}",
        pathParams: ["workflowSlug", "triggerId"]
    },
    {
        kind: "internal",
        name: "workflow-trigger-create",
        method: "POST",
        path: "/api/workflows/{workflowSlug}/execution-triggers",
        pathParams: ["workflowSlug"],
        bodyParams: ["type", "name", "description", "config", "filter", "inputMapping", "isActive"]
    },
    {
        kind: "internal",
        name: "workflow-trigger-update",
        method: "PATCH",
        path: "/api/workflows/{workflowSlug}/execution-triggers/{triggerId}",
        pathParams: ["workflowSlug", "triggerId"],
        bodyParams: [
            "name",
            "description",
            "config",
            "filter",
            "inputMapping",
            "isActive",
            "isArchived"
        ]
    },
    {
        kind: "internal",
        name: "workflow-trigger-delete",
        method: "DELETE",
        path: "/api/workflows/{workflowSlug}/execution-triggers/{triggerId}",
        pathParams: ["workflowSlug", "triggerId"]
    },
    {
        kind: "internal",
        name: "workflow-trigger-enable",
        method: "PATCH",
        path: "/api/workflows/{workflowSlug}/execution-triggers/{triggerId}",
        pathParams: ["workflowSlug", "triggerId"],
        staticBody: { isActive: true }
    },
    {
        kind: "internal",
        name: "workflow-trigger-disable",
        method: "PATCH",
        path: "/api/workflows/{workflowSlug}/execution-triggers/{triggerId}",
        pathParams: ["workflowSlug", "triggerId"],
        staticBody: { isActive: false }
    },
    {
        kind: "internal",
        name: "workflow-trigger-test",
        method: "POST",
        path: "/api/workflows/{workflowSlug}/execution-triggers/{triggerId}/test",
        pathParams: ["workflowSlug", "triggerId"],
        bodyParams: ["payload"]
    },
    {
        kind: "internal",
        name: "workflow-trigger-execute",
        method: "POST",
        path: "/api/workflows/{workflowSlug}/execution-triggers/{triggerId}/execute",
        pathParams: ["workflowSlug", "triggerId"],
        bodyParams: ["payload"]
    },

    // ── Network Trigger Routes ──
    {
        kind: "internal",
        name: "network-trigger-list",
        method: "GET",
        path: "/api/networks/{networkSlug}/execution-triggers",
        pathParams: ["networkSlug"]
    },
    {
        kind: "internal",
        name: "network-trigger-get",
        method: "GET",
        path: "/api/networks/{networkSlug}/execution-triggers/{triggerId}",
        pathParams: ["networkSlug", "triggerId"]
    },
    {
        kind: "internal",
        name: "network-trigger-create",
        method: "POST",
        path: "/api/networks/{networkSlug}/execution-triggers",
        pathParams: ["networkSlug"],
        bodyParams: ["type", "name", "description", "config", "filter", "inputMapping", "isActive"]
    },
    {
        kind: "internal",
        name: "network-trigger-update",
        method: "PATCH",
        path: "/api/networks/{networkSlug}/execution-triggers/{triggerId}",
        pathParams: ["networkSlug", "triggerId"],
        bodyParams: [
            "name",
            "description",
            "config",
            "filter",
            "inputMapping",
            "isActive",
            "isArchived"
        ]
    },
    {
        kind: "internal",
        name: "network-trigger-delete",
        method: "DELETE",
        path: "/api/networks/{networkSlug}/execution-triggers/{triggerId}",
        pathParams: ["networkSlug", "triggerId"]
    },
    {
        kind: "internal",
        name: "network-trigger-enable",
        method: "PATCH",
        path: "/api/networks/{networkSlug}/execution-triggers/{triggerId}",
        pathParams: ["networkSlug", "triggerId"],
        staticBody: { isActive: true }
    },
    {
        kind: "internal",
        name: "network-trigger-disable",
        method: "PATCH",
        path: "/api/networks/{networkSlug}/execution-triggers/{triggerId}",
        pathParams: ["networkSlug", "triggerId"],
        staticBody: { isActive: false }
    },
    {
        kind: "internal",
        name: "network-trigger-test",
        method: "POST",
        path: "/api/networks/{networkSlug}/execution-triggers/{triggerId}/test",
        pathParams: ["networkSlug", "triggerId"],
        bodyParams: ["payload"]
    },
    {
        kind: "internal",
        name: "network-trigger-execute",
        method: "POST",
        path: "/api/networks/{networkSlug}/execution-triggers/{triggerId}/execute",
        pathParams: ["networkSlug", "triggerId"],
        bodyParams: ["payload"]
    }
];
