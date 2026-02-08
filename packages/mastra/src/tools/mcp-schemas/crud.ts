import { McpToolDefinition, McpToolRoute } from "./types";
import {
    agentCreateInputSchema,
    agentUpdateInputSchema,
    crudBaseResponseSchema,
    networkCreateInputSchema,
    networkUpdateInputSchema,
    workflowCreateInputSchema,
    workflowUpdateInputSchema
} from "./shared";

const crudBaseResponseProperties =
    (crudBaseResponseSchema as { properties?: Record<string, unknown> }).properties || {};

const buildCrudResponseSchema = (entityKey: string) => ({
    ...crudBaseResponseSchema,
    properties: {
        ...crudBaseResponseProperties,
        [entityKey]: { type: "object" }
    }
});

export const crudToolDefinitions: McpToolDefinition[] = [
    {
        name: "agent-create",
        description: "Create a new agent with full configuration.",
        inputSchema: agentCreateInputSchema,
        outputSchema: buildCrudResponseSchema("agent"),
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "agent-read",
        description: "Retrieve agent definition/state by ID or slug.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string" },
                include: {
                    type: "object",
                    properties: {
                        tools: { type: "boolean" },
                        versions: { type: "boolean" },
                        runs: { type: "boolean" },
                        schedules: { type: "boolean" },
                        triggers: { type: "boolean" }
                    }
                }
            },
            required: ["agentId"]
        },
        outputSchema: buildCrudResponseSchema("agent"),
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "agent-update",
        description: "Update an agent configuration with versioning and rollback support.",
        inputSchema: agentUpdateInputSchema,
        outputSchema: buildCrudResponseSchema("agent"),
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "agent-delete",
        description: "Delete or archive an agent safely.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string" },
                mode: { type: "string", enum: ["delete", "archive"] }
            },
            required: ["agentId"]
        },
        outputSchema: crudBaseResponseSchema,
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "workflow-create",
        description: "Create a workflow definition with full configuration.",
        inputSchema: workflowCreateInputSchema,
        outputSchema: buildCrudResponseSchema("workflow"),
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "workflow-read",
        description: "Retrieve a workflow definition/state by ID or slug.",
        inputSchema: {
            type: "object",
            properties: {
                workflowId: { type: "string" },
                include: {
                    type: "object",
                    properties: {
                        versions: { type: "boolean" },
                        runs: { type: "boolean" }
                    }
                }
            },
            required: ["workflowId"]
        },
        outputSchema: buildCrudResponseSchema("workflow"),
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "workflow-update",
        description: "Update a workflow definition with versioning and rollback support.",
        inputSchema: workflowUpdateInputSchema,
        outputSchema: buildCrudResponseSchema("workflow"),
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "workflow-delete",
        description: "Delete or archive a workflow safely.",
        inputSchema: {
            type: "object",
            properties: {
                workflowId: { type: "string" },
                mode: { type: "string", enum: ["delete", "archive"] }
            },
            required: ["workflowId"]
        },
        outputSchema: crudBaseResponseSchema,
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "network-create",
        description: "Create a network with routing instructions and primitives.",
        inputSchema: networkCreateInputSchema,
        outputSchema: buildCrudResponseSchema("network"),
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "network-read",
        description: "Retrieve a network definition/state by ID or slug.",
        inputSchema: {
            type: "object",
            properties: {
                networkId: { type: "string" },
                include: {
                    type: "object",
                    properties: {
                        primitives: { type: "boolean" },
                        versions: { type: "boolean" },
                        runs: { type: "boolean" }
                    }
                }
            },
            required: ["networkId"]
        },
        outputSchema: buildCrudResponseSchema("network"),
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "network-update",
        description:
            "Update a network topology or routing config with versioning and rollback support.",
        inputSchema: networkUpdateInputSchema,
        outputSchema: buildCrudResponseSchema("network"),
        invoke_url: "/api/mcp",
        category: "crud"
    },
    {
        name: "network-delete",
        description: "Delete or archive a network safely.",
        inputSchema: {
            type: "object",
            properties: {
                networkId: { type: "string" },
                mode: { type: "string", enum: ["delete", "archive"] }
            },
            required: ["networkId"]
        },
        outputSchema: crudBaseResponseSchema,
        invoke_url: "/api/mcp",
        category: "crud"
    }
];

export const crudToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "agent-create", applyDefaults: true },
    { kind: "registry", name: "agent-read" },
    { kind: "registry", name: "agent-update" },
    { kind: "registry", name: "agent-delete" },
    { kind: "registry", name: "workflow-create", applyDefaults: true },
    { kind: "registry", name: "workflow-read" },
    { kind: "registry", name: "workflow-update" },
    { kind: "registry", name: "workflow-delete" },
    { kind: "registry", name: "network-create", applyDefaults: true },
    { kind: "registry", name: "network-read" },
    { kind: "registry", name: "network-update" },
    { kind: "registry", name: "network-delete" }
];
