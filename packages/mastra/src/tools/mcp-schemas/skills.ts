import { McpToolDefinition, McpToolRoute } from "./types";

export const skillToolDefinitions: McpToolDefinition[] = [
    {
        name: "skill-create",
        description: "Create a skill (composable competency bundle).",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string" },
                name: { type: "string" },
                instructions: { type: "string", description: "Procedural knowledge" },
                description: { type: "string" },
                examples: { type: "string", description: "Reference outputs" },
                category: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                metadata: { type: "object", description: "Additional metadata" },
                workspaceId: { type: "string" },
                type: { type: "string", enum: ["USER", "SYSTEM"] },
                createdBy: { type: "string" }
            },
            required: ["slug", "name", "instructions"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "skill-read",
        description: "Read a skill by ID or slug with its documents and tools.",
        inputSchema: {
            type: "object",
            properties: { skillId: { type: "string" } },
            required: ["skillId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "skill-update",
        description: "Update a skill.",
        inputSchema: {
            type: "object",
            properties: {
                skillId: { type: "string" },
                name: { type: "string" },
                instructions: { type: "string" },
                description: { type: "string" },
                examples: { type: "string" },
                category: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                changeSummary: { type: "string" },
                metadata: { type: "object", description: "Additional metadata" },
                createdBy: { type: "string" }
            },
            required: ["skillId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "skill-delete",
        description: "Delete a skill.",
        inputSchema: {
            type: "object",
            properties: { skillId: { type: "string" } },
            required: ["skillId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "skill-list",
        description: "List skills with filters.",
        inputSchema: {
            type: "object",
            properties: {
                category: { type: "string" },
                tags: { type: "string" },
                type: { type: "string", enum: ["USER", "SYSTEM"] },
                workspaceId: { type: "string" },
                skip: { type: "number", description: "Pagination offset" },
                take: { type: "number", description: "Page size" }
            }
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "skill-attach-document",
        description: "Attach a document to a skill.",
        inputSchema: {
            type: "object",
            properties: {
                skillId: { type: "string" },
                documentId: { type: "string" },
                role: { type: "string", description: "reference, procedure, example, or context" }
            },
            required: ["skillId", "documentId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "skill-detach-document",
        description: "Detach a document from a skill.",
        inputSchema: {
            type: "object",
            properties: { skillId: { type: "string" }, documentId: { type: "string" } },
            required: ["skillId", "documentId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "skill-attach-tool",
        description: "Attach a tool to a skill. skillId accepts ID or slug.",
        inputSchema: {
            type: "object",
            properties: { skillId: { type: "string" }, toolId: { type: "string" } },
            required: ["skillId", "toolId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "skill-detach-tool",
        description: "Detach a tool from a skill. skillId accepts ID or slug.",
        inputSchema: {
            type: "object",
            properties: { skillId: { type: "string" }, toolId: { type: "string" } },
            required: ["skillId", "toolId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "agent-attach-skill",
        description:
            "Attach a skill to an agent. Set pinned=true to inject skill tools directly, or false (default) for discoverable via meta-tools.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string" },
                skillId: { type: "string" },
                pinned: {
                    type: "boolean",
                    description:
                        "Pin the skill (tools injected directly) vs discoverable (via meta-tools). Default: false."
                }
            },
            required: ["agentId", "skillId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "agent-skill-update",
        description:
            "Update a skill's attachment state on an agent (e.g. toggle pinned). skillId accepts ID or slug.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string" },
                skillId: { type: "string" },
                pinned: {
                    type: "boolean",
                    description:
                        "Pin the skill (tools injected directly) vs discoverable (via meta-tools)."
                }
            },
            required: ["agentId", "skillId", "pinned"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "agent-detach-skill",
        description: "Detach a skill from an agent.",
        inputSchema: {
            type: "object",
            properties: { agentId: { type: "string" }, skillId: { type: "string" } },
            required: ["agentId", "skillId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    },
    {
        name: "skill-get-versions",
        description: "Get version history for a skill.",
        inputSchema: {
            type: "object",
            properties: { skillId: { type: "string" } },
            required: ["skillId"]
        },
        invoke_url: "/api/mcp",
        category: "skills"
    }
];

export const skillToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "skill-create" },
    { kind: "registry", name: "skill-read" },
    { kind: "registry", name: "skill-update" },
    { kind: "registry", name: "skill-delete" },
    { kind: "registry", name: "skill-list" },
    { kind: "registry", name: "skill-attach-document" },
    { kind: "registry", name: "skill-detach-document" },
    { kind: "registry", name: "skill-attach-tool" },
    { kind: "registry", name: "skill-detach-tool" },
    { kind: "registry", name: "agent-attach-skill" },
    { kind: "registry", name: "agent-skill-update" },
    { kind: "registry", name: "agent-detach-skill" },
    { kind: "registry", name: "skill-get-versions" }
];
