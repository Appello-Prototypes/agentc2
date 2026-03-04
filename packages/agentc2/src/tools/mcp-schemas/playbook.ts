import { McpToolDefinition, McpToolRoute } from "./types";

export const playbookToolDefinitions: McpToolDefinition[] = [
    // Consumer tools (existing)
    {
        name: "playbook-search",
        description: "Search published playbooks in the marketplace by category, tags, or query.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search term" },
                category: { type: "string", description: "Filter by category" },
                limit: { type: "number", description: "Max results (default: 10)" }
            },
            required: []
        },
        invoke_url: "/api/mcp",
        category: "playbook"
    },
    {
        name: "playbook-detail",
        description:
            "Get full details of a published playbook: description, components, integrations, reviews.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" }
            },
            required: ["slug"]
        },
        invoke_url: "/api/mcp",
        category: "playbook"
    },
    {
        name: "playbook-list-installed",
        description: "List playbooks installed in a workspace.",
        inputSchema: {
            type: "object",
            properties: {
                organizationId: { type: "string", description: "Organization ID" }
            },
            required: ["organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook"
    },
    {
        name: "playbook-deploy",
        description: "Deploy a playbook into a workspace.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" },
                workspaceId: { type: "string", description: "Target workspace ID" },
                organizationId: { type: "string", description: "Buyer organization ID" },
                userId: { type: "string", description: "User initiating deploy" }
            },
            required: ["slug", "workspaceId", "organizationId", "userId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook"
    },

    // Publisher tools (new)
    {
        name: "playbook-list-mine",
        description: "List playbooks published by the caller's organization.",
        inputSchema: {
            type: "object",
            properties: {
                organizationId: { type: "string", description: "Publisher organization ID" }
            },
            required: ["organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-get-full",
        description:
            "Get full publisher view of a playbook: metadata, boot doc, boot tasks, components, versions.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" }
            },
            required: ["slug"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-update-metadata",
        description:
            "Update playbook metadata: name, tagline, description, category, tags, pricing.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" },
                organizationId: { type: "string", description: "Publisher organization ID" },
                name: { type: "string", description: "New name" },
                tagline: { type: "string", description: "New tagline" },
                description: { type: "string", description: "New description" },
                longDescription: { type: "string", description: "New long description" },
                category: { type: "string", description: "New category" },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "New tags"
                },
                coverImageUrl: { type: "string", description: "Cover image URL" },
                iconUrl: { type: "string", description: "Icon URL" },
                pricingModel: {
                    type: "string",
                    enum: ["FREE", "ONE_TIME", "SUBSCRIPTION", "PER_USE"],
                    description: "Pricing model"
                },
                priceUsd: { type: "number", description: "Price in USD" },
                monthlyPriceUsd: { type: "number", description: "Monthly price in USD" },
                perUsePriceUsd: { type: "number", description: "Per-use price in USD" }
            },
            required: ["slug", "organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-get-boot-document",
        description: "Get the boot document (markdown runbook) for a playbook.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" }
            },
            required: ["slug"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-set-boot-document",
        description:
            "Create or update the boot document (markdown runbook) for a playbook. Embedded into RAG on deploy.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" },
                organizationId: { type: "string", description: "Publisher organization ID" },
                content: { type: "string", description: "Boot document content (markdown)" }
            },
            required: ["slug", "organizationId", "content"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-add-boot-task",
        description:
            "Add a structural boot task template. Created as BacklogTasks on the deployed agent.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" },
                organizationId: { type: "string", description: "Publisher organization ID" },
                title: { type: "string", description: "Task title" },
                description: { type: "string", description: "Task description" },
                priority: { type: "number", description: "Priority 0-10 (default: 5)" },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tags"
                }
            },
            required: ["slug", "organizationId", "title"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-list-boot-tasks",
        description: "List all boot task templates for a playbook.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" }
            },
            required: ["slug"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-update-boot-task",
        description: "Update a boot task template.",
        inputSchema: {
            type: "object",
            properties: {
                taskId: { type: "string", description: "Boot task ID" },
                organizationId: { type: "string", description: "Publisher organization ID" },
                title: { type: "string", description: "New title" },
                description: { type: "string", description: "New description" },
                priority: { type: "number", description: "New priority 0-10" },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "New tags"
                },
                sortOrder: { type: "number", description: "New sort order" }
            },
            required: ["taskId", "organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-remove-boot-task",
        description: "Delete a boot task template from a playbook.",
        inputSchema: {
            type: "object",
            properties: {
                taskId: { type: "string", description: "Boot task ID" },
                organizationId: { type: "string", description: "Publisher organization ID" }
            },
            required: ["taskId", "organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-package",
        description:
            "Package a playbook: snapshot agent system into a new version. Modes: full, components-only, boot-only.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" },
                organizationId: { type: "string", description: "Publisher organization ID" },
                userId: { type: "string", description: "User triggering package" },
                entryType: {
                    type: "string",
                    enum: ["agent", "workflow", "network"],
                    description: "Entry point type"
                },
                entryId: { type: "string", description: "Entry point entity ID" },
                mode: {
                    type: "string",
                    enum: ["full", "components-only", "boot-only"],
                    description: "Repackage mode (default: full)"
                },
                changelog: { type: "string", description: "Version changelog" },
                includeSkills: { type: "boolean", description: "Include skills (default: true)" },
                includeDocuments: {
                    type: "boolean",
                    description: "Include documents (default: true)"
                }
            },
            required: ["slug", "organizationId", "userId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-submit-review",
        description: "Submit a playbook for marketplace review.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" },
                organizationId: { type: "string", description: "Publisher organization ID" }
            },
            required: ["slug", "organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },
    {
        name: "playbook-set-auto-boot",
        description:
            "Enable/disable auto-boot. When enabled, deployed agents self-configure from the boot document.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" },
                organizationId: { type: "string", description: "Publisher organization ID" },
                enabled: { type: "boolean", description: "Whether auto-boot is enabled" }
            },
            required: ["slug", "organizationId", "enabled"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },

    {
        name: "playbook-set-setup-config",
        description:
            "Set the installation wizard setup config for a playbook. Defines optional config steps that buyers complete during installation.",
        inputSchema: {
            type: "object",
            properties: {
                slug: { type: "string", description: "Playbook slug" },
                organizationId: { type: "string", description: "Publisher organization ID" },
                setupConfig: {
                    type: "object",
                    description:
                        "Setup config object with headline, description, and steps array. Pass null to clear.",
                    properties: {
                        headline: { type: "string", description: "Wizard headline" },
                        description: { type: "string", description: "Wizard description" },
                        steps: {
                            type: "array",
                            description: "Array of setup steps",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string", description: "Unique step ID" },
                                    type: {
                                        type: "string",
                                        description:
                                            "Step type: repo-select, webhook-create, text-input, number-input, channel-select, integration-prompt"
                                    },
                                    label: { type: "string", description: "Display label" },
                                    description: { type: "string", description: "Help text" },
                                    provider: {
                                        type: "string",
                                        description: "Integration provider key (optional)"
                                    },
                                    config: {
                                        type: "object",
                                        description: "Additional step configuration (optional)"
                                    }
                                },
                                required: ["id", "type", "label", "description"]
                            }
                        }
                    }
                }
            },
            required: ["slug", "organizationId", "setupConfig"]
        },
        invoke_url: "/api/mcp",
        category: "playbook-publishing"
    },

    // Setup Wizard tools
    {
        name: "playbook-installation-setup",
        description:
            "Get the current setup state for a playbook installation: integration status, config step progress, readiness.",
        inputSchema: {
            type: "object",
            properties: {
                installationId: { type: "string", description: "Installation ID" },
                organizationId: { type: "string", description: "Organization ID" }
            },
            required: ["installationId", "organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook"
    },
    {
        name: "playbook-installation-verify",
        description:
            "Test all connected integrations for a playbook installation. Returns per-integration test results.",
        inputSchema: {
            type: "object",
            properties: {
                installationId: { type: "string", description: "Installation ID" },
                organizationId: { type: "string", description: "Organization ID" },
                userId: { type: "string", description: "User ID for MCP server testing" }
            },
            required: ["installationId", "organizationId", "userId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook"
    },
    {
        name: "playbook-installation-activate",
        description:
            "Activate a playbook installation after all integrations are connected and config steps are complete.",
        inputSchema: {
            type: "object",
            properties: {
                installationId: { type: "string", description: "Installation ID" },
                organizationId: { type: "string", description: "Organization ID" }
            },
            required: ["installationId", "organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook"
    },
    {
        name: "playbook-installation-configure",
        description:
            "Complete a custom configuration step for a playbook installation. For repo-select: { repository }. For webhook-create: { repository, webhookPath }.",
        inputSchema: {
            type: "object",
            properties: {
                installationId: { type: "string", description: "Installation ID" },
                organizationId: { type: "string", description: "Organization ID" },
                stepId: { type: "string", description: "Config step ID to complete" },
                data: {
                    type: "object",
                    description: "Step-specific data (e.g. { repository: 'owner/repo' })"
                }
            },
            required: ["installationId", "organizationId", "stepId", "data"]
        },
        invoke_url: "/api/mcp",
        category: "playbook"
    },
    {
        name: "playbook-installation-repos",
        description:
            "List GitHub repositories available to the organization for use with a playbook installation.",
        inputSchema: {
            type: "object",
            properties: {
                organizationId: { type: "string", description: "Organization ID" }
            },
            required: ["organizationId"]
        },
        invoke_url: "/api/mcp",
        category: "playbook"
    }
];

export const playbookToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "playbook-search" },
    { kind: "registry", name: "playbook-detail" },
    { kind: "registry", name: "playbook-list-installed", enforceOrg: true },
    { kind: "registry", name: "playbook-deploy", enforceOrg: true, enforceUser: true },
    { kind: "registry", name: "playbook-list-mine", enforceOrg: true },
    { kind: "registry", name: "playbook-get-full" },
    { kind: "registry", name: "playbook-update-metadata", enforceOrg: true },
    { kind: "registry", name: "playbook-get-boot-document" },
    { kind: "registry", name: "playbook-set-boot-document", enforceOrg: true },
    { kind: "registry", name: "playbook-add-boot-task", enforceOrg: true },
    { kind: "registry", name: "playbook-list-boot-tasks" },
    { kind: "registry", name: "playbook-update-boot-task", enforceOrg: true },
    { kind: "registry", name: "playbook-remove-boot-task", enforceOrg: true },
    { kind: "registry", name: "playbook-package", enforceOrg: true, enforceUser: true },
    { kind: "registry", name: "playbook-submit-review", enforceOrg: true },
    { kind: "registry", name: "playbook-set-auto-boot", enforceOrg: true },
    { kind: "registry", name: "playbook-set-setup-config", enforceOrg: true },
    { kind: "registry", name: "playbook-installation-setup", enforceOrg: true },
    { kind: "registry", name: "playbook-installation-verify", enforceOrg: true, enforceUser: true },
    { kind: "registry", name: "playbook-installation-activate", enforceOrg: true },
    { kind: "registry", name: "playbook-installation-configure", enforceOrg: true },
    { kind: "registry", name: "playbook-installation-repos", enforceOrg: true }
];
