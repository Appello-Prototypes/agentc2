import { McpToolDefinition, McpToolRoute } from "./types";

export const workflowConfigToolDefinitions: McpToolDefinition[] = [
    {
        name: "workflow-generate",
        description: "Generate a workflow definition from a prompt.",
        inputSchema: {
            type: "object",
            properties: {
                prompt: { type: "string", description: "Prompt to generate a workflow" }
            },
            required: ["prompt"]
        },
        invoke_url: "/api/mcp",
        category: "workflow-config"
    },
    {
        name: "workflow-validate",
        description: "Validate a workflow definition.",
        inputSchema: {
            type: "object",
            properties: {
                definitionJson: { type: "object", description: "Workflow definition JSON" }
            },
            required: ["definitionJson"]
        },
        invoke_url: "/api/mcp",
        category: "workflow-config"
    },
    {
        name: "workflow-designer-chat",
        description: "Generate a JSON Patch proposal for workflow updates.",
        inputSchema: {
            type: "object",
            properties: {
                workflowSlug: { type: "string", description: "Workflow slug or ID" },
                prompt: { type: "string", description: "Requested change" },
                definitionJson: {
                    type: "object",
                    description: "Current workflow definition JSON"
                },
                selected: { type: "object", description: "Optional selected node" }
            },
            required: ["workflowSlug", "prompt", "definitionJson"]
        },
        invoke_url: "/api/mcp",
        category: "workflow-config"
    }
];

export const workflowConfigToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "workflow-generate",
        method: "POST",
        path: "/api/workflows/generate",
        bodyParams: ["prompt"]
    },
    {
        kind: "internal",
        name: "workflow-validate",
        method: "POST",
        path: "/api/workflows/validate",
        bodyParams: ["definitionJson"]
    },
    {
        kind: "internal",
        name: "workflow-designer-chat",
        method: "POST",
        path: "/api/workflows/{workflowSlug}/designer-chat",
        pathParams: ["workflowSlug"],
        bodyParams: ["prompt", "definitionJson", "selected"]
    }
];
