import type { McpToolDefinition, McpToolRoute } from "./types";

export const instanceToolDefinitions: McpToolDefinition[] = [
    {
        name: "instance-list",
        description:
            "List agent instances for the organization. Optionally filter by agent, " +
            "context type, or active status.",
        inputSchema: {
            type: "object",
            properties: {
                organizationId: {
                    type: "string",
                    description: "Organization ID"
                },
                agentId: {
                    type: "string",
                    description: "Filter by parent agent ID"
                },
                agentSlug: {
                    type: "string",
                    description: "Filter by parent agent slug (alternative to agentId)"
                },
                contextType: {
                    type: "string",
                    description: "Filter by context type (deal, customer, project)"
                },
                isActive: {
                    type: "boolean",
                    description: "Filter by active status"
                }
            },
            required: ["organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "instances"
    },
    {
        name: "instance-get",
        description:
            "Get full details of an agent instance including channel bindings, " +
            "instruction overrides, context data, and memory namespace.",
        inputSchema: {
            type: "object",
            properties: {
                instanceId: {
                    type: "string",
                    description: "Instance ID"
                },
                instanceSlug: {
                    type: "string",
                    description: "Instance slug (alternative to instanceId)"
                },
                organizationId: {
                    type: "string",
                    description: "Organization ID (required with slug)"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "instances"
    },
    {
        name: "instance-create",
        description:
            "Create a new agent instance with isolated memory and optional instruction overrides. " +
            "Each instance gets its own memory namespace for conversation isolation.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: {
                    type: "string",
                    description: "Parent agent ID"
                },
                agentSlug: {
                    type: "string",
                    description: "Parent agent slug (alternative to agentId)"
                },
                organizationId: {
                    type: "string",
                    description: "Organization ID"
                },
                name: {
                    type: "string",
                    description: "Human-readable name (e.g., 'Owens Insulation Bot')"
                },
                slug: {
                    type: "string",
                    description:
                        "URL-safe slug (e.g., 'owens-insulation'). Must be unique within the org."
                },
                contextType: {
                    type: "string",
                    description: "Context type: deal, customer, project, or custom"
                },
                contextId: {
                    type: "string",
                    description: "External ID for context (e.g., HubSpot deal ID)"
                },
                contextData: {
                    type: "object",
                    description: "Cached context data (e.g., company name, deal stage)"
                },
                instructionOverrides: {
                    type: "string",
                    description: "Additional instructions appended to the base agent's instructions"
                },
                temperatureOverride: {
                    type: "number",
                    description: "Override the agent's temperature"
                },
                maxStepsOverride: {
                    type: "number",
                    description: "Override the agent's maxSteps"
                }
            },
            required: ["organizationId", "name", "slug"]
        },
        invoke_url: "/api/mcp",
        category: "instances"
    },
    {
        name: "instance-update",
        description:
            "Update an agent instance's configuration (name, context, instruction overrides, " +
            "temperature, maxSteps, active status).",
        inputSchema: {
            type: "object",
            properties: {
                instanceId: {
                    type: "string",
                    description: "Instance ID"
                },
                name: { type: "string" },
                contextType: { type: "string" },
                contextId: { type: "string" },
                contextData: { type: "object" },
                instructionOverrides: { type: "string" },
                temperatureOverride: { type: "number" },
                maxStepsOverride: { type: "number" },
                isActive: { type: "boolean" },
                metadata: { type: "object" }
            },
            required: ["instanceId"]
        },
        invoke_url: "/api/mcp",
        category: "instances"
    },
    {
        name: "instance-delete",
        description: "Delete an agent instance and all its channel bindings.",
        inputSchema: {
            type: "object",
            properties: {
                instanceId: {
                    type: "string",
                    description: "Instance ID to delete"
                }
            },
            required: ["instanceId"]
        },
        invoke_url: "/api/mcp",
        category: "instances"
    },
    {
        name: "instance-bind-channel",
        description:
            "Bind an agent instance to a communication channel (Slack, email, WhatsApp, etc.). " +
            "Messages in this channel will be routed to the instance's agent with its " +
            "specific memory namespace and instruction overrides.",
        inputSchema: {
            type: "object",
            properties: {
                instanceId: {
                    type: "string",
                    description: "Instance ID"
                },
                channelType: {
                    type: "string",
                    enum: ["slack", "email", "whatsapp", "web", "voice"],
                    description: "Channel type"
                },
                channelIdentifier: {
                    type: "string",
                    description: "Channel identifier (e.g., Slack channel ID like C0123456789)"
                },
                channelName: {
                    type: "string",
                    description: "Human-readable channel name (e.g., '#big-jim-2')"
                },
                triggerOnAllMessages: {
                    type: "boolean",
                    description:
                        "Respond to all messages without requiring @mention (default: false)"
                },
                triggerKeywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Keywords that trigger a response (case-insensitive)"
                },
                triggerOnFileUpload: {
                    type: "boolean",
                    description: "Trigger on file uploads (default: false)"
                },
                allowedUserIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Restrict to these user IDs (empty = allow all)"
                },
                blockedUserIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Block these user IDs"
                }
            },
            required: ["instanceId", "channelType", "channelIdentifier"]
        },
        invoke_url: "/api/mcp",
        category: "instances"
    },
    {
        name: "instance-unbind-channel",
        description: "Remove a channel binding from an agent instance.",
        inputSchema: {
            type: "object",
            properties: {
                bindingId: {
                    type: "string",
                    description: "Channel binding ID to remove"
                }
            },
            required: ["bindingId"]
        },
        invoke_url: "/api/mcp",
        category: "instances"
    }
];

export const instanceToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "instance-list" },
    { kind: "registry", name: "instance-get" },
    { kind: "registry", name: "instance-create" },
    { kind: "registry", name: "instance-update" },
    { kind: "registry", name: "instance-delete" },
    { kind: "registry", name: "instance-bind-channel" },
    { kind: "registry", name: "instance-unbind-channel" }
];
