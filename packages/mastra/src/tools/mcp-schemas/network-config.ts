import { McpToolDefinition, McpToolRoute } from "./types";

export const networkConfigToolDefinitions: McpToolDefinition[] = [
    {
        name: "network-generate",
        description: "Generate a network topology from a prompt.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: { type: "string", description: "Prompt to generate a network" }
            },
            required: ["prompt"]
        },
        invoke_url: "/api/mcp",
        category: "network-config"
    },
    {
        name: "network-validate",
        description: "Validate a network topology and primitives.",
        inputSchema: {
            type: "object",
            properties: {
                topologyJson: { type: "object", description: "Network topology JSON" },
                primitives: { type: "array", items: { type: "object" } }
            },
            required: ["topologyJson"]
        },
        invoke_url: "/api/mcp",
        category: "network-config"
    },
    {
        name: "network-designer-chat",
        description: "Generate a JSON Patch proposal for network updates.",
        inputSchema: {
            type: "object",
            properties: {
                networkSlug: { type: "string", description: "Network slug or ID" },
                prompt: { type: "string", description: "Requested change" },
                topologyJson: {
                    type: "object",
                    description: "Current network topology JSON"
                },
                primitives: { type: "array", items: { type: "object" } },
                selected: { type: "object", description: "Optional selected node" }
            },
            required: ["networkSlug", "prompt", "topologyJson"]
        },
        invoke_url: "/api/mcp",
        category: "network-config"
    }
];

export const networkConfigToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "network-generate",
        method: "POST",
        path: "/api/networks/generate",
        bodyParams: ["prompt"]
    },
    {
        kind: "internal",
        name: "network-validate",
        method: "POST",
        path: "/api/networks/validate",
        bodyParams: ["topologyJson", "primitives"]
    },
    {
        kind: "internal",
        name: "network-designer-chat",
        method: "POST",
        path: "/api/networks/{networkSlug}/designer-chat",
        pathParams: ["networkSlug"],
        bodyParams: ["prompt", "topologyJson", "primitives", "selected"]
    }
];
