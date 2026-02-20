import { McpToolDefinition, McpToolRoute } from "./types";

export const integrationToolDefinitions: McpToolDefinition[] = [
    {
        name: "integration-mcp-config",
        description: "Read MCP config, preview impact, and apply updates with confirmation gating.",
        inputSchema: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["read", "plan", "apply"],
                    description:
                        "Action to perform. 'read' exports current config, 'plan' previews impact, 'apply' applies changes."
                },
                config: {
                    type: "object",
                    description: "MCP config object (with mcpServers key)"
                },
                rawText: {
                    type: "string",
                    description: "Raw MCP JSON or text containing MCP JSON"
                },
                mode: {
                    type: "string",
                    enum: ["replace", "merge"],
                    description:
                        "How to apply config. 'replace' removes unlisted servers, 'merge' keeps existing. Default: replace."
                },
                confirm: {
                    type: "boolean",
                    description:
                        "Must be true to apply changes when impact is detected. Omit to get confirmation prompt."
                },
                organizationId: { type: "string" },
                userId: { type: "string" }
            }
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-providers-list",
        description: "List available integration providers with connection status.",
        inputSchema: {
            type: "object",
            properties: {}
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-connections-list",
        description: "List integration connections for the organization.",
        inputSchema: {
            type: "object",
            properties: {
                providerKey: { type: "string", description: "Filter by provider key" },
                scope: { type: "string", description: "Filter by scope" }
            }
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-connection-create",
        description: "Create a new integration connection.",
        inputSchema: {
            type: "object",
            properties: {
                providerKey: { type: "string", description: "Provider key" },
                name: { type: "string", description: "Connection name" },
                scope: { type: "string", description: "Connection scope" },
                credentials: { type: "object", description: "Credentials payload" },
                metadata: { type: "object", description: "Connection metadata" },
                isDefault: { type: "boolean", description: "Set as default connection" }
            },
            required: ["providerKey", "name"]
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-connection-update",
        description: "Update an integration connection (name, credentials, active status).",
        inputSchema: {
            type: "object",
            properties: {
                connectionId: { type: "string", description: "Connection ID" },
                name: { type: "string", description: "New connection name" },
                isDefault: { type: "boolean", description: "Set as default connection" },
                isActive: { type: "boolean", description: "Enable or disable the connection" },
                credentials: { type: "object", description: "Updated credentials payload" },
                metadata: { type: "object", description: "Updated metadata" }
            },
            required: ["connectionId"]
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-connection-delete",
        description: "Delete an integration connection and its associated triggers.",
        inputSchema: {
            type: "object",
            properties: {
                connectionId: { type: "string", description: "Connection ID to delete" }
            },
            required: ["connectionId"]
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-connection-test",
        description: "Test an integration connection by validating credentials and connectivity.",
        inputSchema: {
            type: "object",
            properties: {
                connectionId: { type: "string", description: "Connection ID to test" }
            },
            required: ["connectionId"]
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    }
];

export const integrationToolRoutes: McpToolRoute[] = [
    {
        kind: "registry",
        name: "integration-mcp-config",
        injectOrg: true,
        injectUser: true
    },
    {
        kind: "internal",
        name: "integration-providers-list",
        method: "GET",
        path: "/api/integrations/providers"
    },
    {
        kind: "internal",
        name: "integration-connections-list",
        method: "GET",
        path: "/api/integrations/connections",
        queryParams: ["providerKey", "scope"]
    },
    {
        kind: "internal",
        name: "integration-connection-create",
        method: "POST",
        path: "/api/integrations/connections",
        bodyParams: ["providerKey", "name", "scope", "credentials", "metadata", "isDefault"]
    },
    {
        kind: "internal",
        name: "integration-connection-update",
        method: "PATCH",
        path: "/api/integrations/connections/{connectionId}",
        pathParams: ["connectionId"],
        bodyParams: ["name", "isDefault", "isActive", "credentials", "metadata"]
    },
    {
        kind: "internal",
        name: "integration-connection-delete",
        method: "DELETE",
        path: "/api/integrations/connections/{connectionId}",
        pathParams: ["connectionId"]
    },
    {
        kind: "internal",
        name: "integration-connection-test",
        method: "POST",
        path: "/api/integrations/connections/{connectionId}/test",
        pathParams: ["connectionId"]
    }
];
