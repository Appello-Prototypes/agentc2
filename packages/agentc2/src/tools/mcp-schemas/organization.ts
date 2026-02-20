import { McpToolDefinition, McpToolRoute } from "./types";

export const organizationToolDefinitions: McpToolDefinition[] = [
    {
        name: "org-list",
        description: "List organizations.",
        inputSchema: {
            type: "object",
            properties: {}
        },
        invoke_url: "/api/mcp",
        category: "organization"
    },
    {
        name: "org-get",
        description: "Get a single organization.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: { type: "string", description: "Organization ID or slug" }
            },
            required: ["orgId"]
        },
        invoke_url: "/api/mcp",
        category: "organization"
    },
    {
        name: "org-members-list",
        description: "List members of an organization.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: { type: "string", description: "Organization ID or slug" }
            },
            required: ["orgId"]
        },
        invoke_url: "/api/mcp",
        category: "organization"
    },
    {
        name: "org-member-add",
        description: "Add a member to an organization.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: { type: "string", description: "Organization ID or slug" },
                userId: { type: "string", description: "User ID to add" },
                role: { type: "string", description: "Member role" }
            },
            required: ["orgId", "userId"]
        },
        invoke_url: "/api/mcp",
        category: "organization"
    },
    {
        name: "org-workspaces-list",
        description: "List workspaces for an organization.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: { type: "string", description: "Organization ID or slug" }
            },
            required: ["orgId"]
        },
        invoke_url: "/api/mcp",
        category: "organization"
    },
    {
        name: "org-workspace-create",
        description: "Create a new workspace in an organization.",
        inputSchema: {
            type: "object",
            properties: {
                orgId: { type: "string", description: "Organization ID or slug" },
                name: { type: "string", description: "Workspace name" },
                slug: { type: "string", description: "Workspace slug" },
                environment: { type: "string", description: "Workspace environment" },
                description: { type: "string", description: "Workspace description" },
                isDefault: { type: "boolean", description: "Set as default workspace" }
            },
            required: ["orgId", "name"]
        },
        invoke_url: "/api/mcp",
        category: "organization"
    }
];

export const organizationToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "org-list",
        method: "GET",
        path: "/api/organizations"
    },
    {
        kind: "internal",
        name: "org-get",
        method: "GET",
        path: "/api/organizations/{orgId}",
        pathParams: ["orgId"]
    },
    {
        kind: "internal",
        name: "org-members-list",
        method: "GET",
        path: "/api/organizations/{orgId}/members",
        pathParams: ["orgId"]
    },
    {
        kind: "internal",
        name: "org-member-add",
        method: "POST",
        path: "/api/organizations/{orgId}/members",
        pathParams: ["orgId"],
        bodyParams: ["userId", "role"]
    },
    {
        kind: "internal",
        name: "org-workspaces-list",
        method: "GET",
        path: "/api/organizations/{orgId}/workspaces",
        pathParams: ["orgId"]
    },
    {
        kind: "internal",
        name: "org-workspace-create",
        method: "POST",
        path: "/api/organizations/{orgId}/workspaces",
        pathParams: ["orgId"],
        bodyParams: ["name", "slug", "environment", "description", "isDefault"]
    }
];
