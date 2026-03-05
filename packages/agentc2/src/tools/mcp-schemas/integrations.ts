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
    },
    {
        name: "integration-tools-list",
        description:
            "List all discovered tools for a provider with enable/disable status, health, and usage counts. " +
            "Returns IntegrationTool records (auto-populated on connection). " +
            "Use this to see what capabilities an integration exposes and which are enabled.",
        inputSchema: {
            type: "object",
            properties: {
                providerKey: {
                    type: "string",
                    description:
                        "Provider key (e.g. 'hubspot', 'github', 'slack'). Use integration-providers-list to find keys."
                }
            },
            required: ["providerKey"]
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-tools-toggle",
        description:
            "Enable or disable one or more tools for an integration. " +
            "Disabled tools are blocked at runtime and will not be available to agents. " +
            "Returns warnings if disabling tools that active agents depend on.",
        inputSchema: {
            type: "object",
            properties: {
                providerKey: {
                    type: "string",
                    description: "Provider key (e.g. 'hubspot')"
                },
                toolIds: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        "Array of tool IDs to toggle (e.g. ['hubspot_hubspot-get-contacts']). Use integration-tools-list to find IDs."
                },
                isEnabled: {
                    type: "boolean",
                    description: "true to enable, false to disable"
                }
            },
            required: ["providerKey", "toolIds", "isEnabled"]
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-tools-rediscover",
        description:
            "Trigger tool re-discovery for a provider. Refreshes the list of available tools from the MCP server " +
            "and syncs IntegrationTool records. Use after connecting or when tools seem stale.",
        inputSchema: {
            type: "object",
            properties: {
                providerKey: {
                    type: "string",
                    description: "Provider key (e.g. 'hubspot')"
                }
            },
            required: ["providerKey"]
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-used-by",
        description:
            "Show which agents, skills, and playbooks depend on tools from this integration. " +
            "Useful before disconnecting or disabling tools to understand impact.",
        inputSchema: {
            type: "object",
            properties: {
                providerKey: {
                    type: "string",
                    description: "Provider key (e.g. 'hubspot')"
                }
            },
            required: ["providerKey"]
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "integration-runtime-config",
        description:
            "View the compiled runtime MCP server configuration for a connection (secrets redacted). " +
            "Shows transport type, server ID, credential shape, OAuth status, and tool count.",
        inputSchema: {
            type: "object",
            properties: {
                connectionId: {
                    type: "string",
                    description: "Connection ID. Use integration-connections-list to find IDs."
                }
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
    },
    {
        kind: "internal",
        name: "integration-tools-list",
        method: "GET",
        path: "/api/integrations/providers/{providerKey}/tools",
        pathParams: ["providerKey"]
    },
    {
        kind: "internal",
        name: "integration-tools-toggle",
        method: "PATCH",
        path: "/api/integrations/providers/{providerKey}/tools",
        pathParams: ["providerKey"],
        bodyParams: ["toolIds", "isEnabled"]
    },
    {
        kind: "internal",
        name: "integration-tools-rediscover",
        method: "POST",
        path: "/api/integrations/providers/{providerKey}/tools",
        pathParams: ["providerKey"]
    },
    {
        kind: "internal",
        name: "integration-used-by",
        method: "GET",
        path: "/api/integrations/providers/{providerKey}/used-by",
        pathParams: ["providerKey"]
    },
    {
        kind: "internal",
        name: "integration-runtime-config",
        method: "GET",
        path: "/api/integrations/connections/{connectionId}/runtime",
        pathParams: ["connectionId"]
    }
];
