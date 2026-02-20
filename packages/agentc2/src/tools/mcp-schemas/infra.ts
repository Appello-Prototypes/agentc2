import { McpToolDefinition, McpToolRoute } from "./types";

export const infraToolDefinitions: McpToolDefinition[] = [
    {
        name: "track-resource",
        description:
            "Record a provisioned infrastructure resource (droplet, database, domain, etc.) for lifecycle tracking and cost monitoring.",
        inputSchema: {
            type: "object",
            properties: {
                provider: {
                    type: "string",
                    description: "Cloud provider (e.g., 'digitalocean', 'supabase', 'custom')"
                },
                resourceType: {
                    type: "string",
                    description:
                        "Resource type (e.g., 'droplet', 'database', 'domain', 'ssh-key', 'app')"
                },
                externalId: {
                    type: "string",
                    description: "The provider's resource ID"
                },
                name: {
                    type: "string",
                    description: "Human-readable name for the resource"
                },
                metadata: {
                    type: "object",
                    description:
                        "Additional metadata (IP address, connection string, region, specs)"
                },
                monthlyCostUsd: {
                    type: "number",
                    description: "Estimated monthly cost in USD"
                },
                agentId: {
                    type: "string",
                    description: "Agent that created this resource"
                },
                runId: {
                    type: "string",
                    description: "Run ID that created this resource"
                },
                organizationId: {
                    type: "string",
                    description: "Organization ID (auto-detected if omitted)"
                }
            },
            required: ["provider", "resourceType", "externalId", "name"]
        },
        invoke_url: "/api/mcp",
        category: "infrastructure"
    },
    {
        name: "list-resources",
        description:
            "List all provisioned infrastructure resources. Filter by provider, type, or status.",
        inputSchema: {
            type: "object",
            properties: {
                provider: {
                    type: "string",
                    description: "Filter by provider (e.g., 'digitalocean')"
                },
                resourceType: {
                    type: "string",
                    description: "Filter by type (e.g., 'droplet')"
                },
                status: {
                    type: "string",
                    enum: ["active", "destroyed", "error"],
                    description: "Filter by status. Default: active"
                },
                organizationId: { type: "string" }
            }
        },
        invoke_url: "/api/mcp",
        category: "infrastructure"
    },
    {
        name: "destroy-resource",
        description:
            "Mark a provisioned resource as destroyed. Call AFTER tearing it down via the cloud provider CLI.",
        inputSchema: {
            type: "object",
            properties: {
                resourceId: {
                    type: "string",
                    description: "The platform resource ID (from list-resources)"
                }
            },
            required: ["resourceId"]
        },
        invoke_url: "/api/mcp",
        category: "infrastructure"
    }
];

export const infraToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "track-resource" },
    { kind: "registry", name: "list-resources" },
    { kind: "registry", name: "destroy-resource" }
];
