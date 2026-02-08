import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { getToolByName } from "@repo/mastra";
import { auth } from "@repo/auth";
import { getDefaultWorkspaceIdForUser, getUserOrganizationId } from "@/lib/organization";

/**
 * MCP Server Gateway
 *
 * Exposes all agents as MCP tools that can be invoked by external MCP clients.
 * This implements the inbound MCP gateway pattern where each agent becomes
 * a callable service.
 *
 * Protocol: Simplified MCP-like JSON-RPC
 *
 * Authentication:
 * - Session-based (cookies) for browser clients
 * - API Key via X-API-Key or Authorization: Bearer header for MCP clients
 *
 * Endpoints:
 * - GET /api/mcp - List available tools (agents)
 * - POST /api/mcp - Invoke a tool (agent)
 */

/**
 * Authenticate request via session or API key
 * Returns { userId, organizationId } on success, or null on failure
 */
async function authenticateRequest(
    request: NextRequest
): Promise<{ userId: string; organizationId: string } | null> {
    // Try API key authentication first (for MCP clients)
    const apiKey =
        request.headers.get("x-api-key") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (apiKey) {
        const orgSlugHeader = request.headers.get("x-organization-slug")?.trim();
        const resolveOrgContext = async (orgSlug: string) => {
            const org = await prisma.organization.findUnique({
                where: { slug: orgSlug },
                select: { id: true }
            });
            if (!org) {
                return null;
            }

            const membership = await prisma.membership.findFirst({
                where: { organizationId: org.id },
                select: { userId: true }
            });
            if (!membership) {
                return null;
            }

            return { userId: membership.userId, organizationId: org.id };
        };

        const validApiKey = process.env.MCP_API_KEY;
        if (validApiKey && apiKey === validApiKey) {
            const orgSlug = orgSlugHeader || process.env.MCP_API_ORGANIZATION_SLUG;
            if (orgSlug) {
                const context = await resolveOrgContext(orgSlug);
                if (context) {
                    return context;
                }
            }
        }

        if (orgSlugHeader) {
            const org = await prisma.organization.findUnique({
                where: { slug: orgSlugHeader },
                select: { id: true }
            });
            if (org) {
                const credential = await prisma.toolCredential.findUnique({
                    where: {
                        organizationId_toolId: {
                            organizationId: org.id,
                            toolId: "mastra-mcp-api"
                        }
                    },
                    select: { credentials: true, isActive: true }
                });
                const credentialPayload = credential?.credentials;
                const storedKey =
                    credentialPayload &&
                    typeof credentialPayload === "object" &&
                    !Array.isArray(credentialPayload)
                        ? (credentialPayload as { apiKey?: string }).apiKey
                        : undefined;
                if (credential?.isActive && storedKey && storedKey === apiKey) {
                    const context = await resolveOrgContext(orgSlugHeader);
                    if (context) {
                        return context;
                    }
                }
            }
        }

        return null;
    }

    // Fall back to session authentication (for browser clients)
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user) {
        return null;
    }

    const organizationId = await getUserOrganizationId(session.user.id);
    if (!organizationId) {
        return null;
    }

    return { userId: session.user.id, organizationId };
}

/**
 * GET /api/mcp
 *
 * Lists all agents as MCP tools.
 * Returns tool definitions with metadata for discovery.
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { organizationId } = authResult;

        const { searchParams } = new URL(request.url);
        const includeInactive = searchParams.get("includeInactive") === "true";
        const normalizeSchema = (
            schema: unknown,
            fallback: Record<string, unknown>
        ): Record<string, unknown> => {
            if (schema && typeof schema === "object" && !Array.isArray(schema)) {
                return schema as Record<string, unknown>;
            }
            return fallback;
        };

        // Get all agents from database
        const agents = await prisma.agent.findMany({
            where: {
                ...(includeInactive ? {} : { isActive: true }),
                workspace: { organizationId }
            },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                modelProvider: true,
                modelName: true,
                isActive: true,
                isPublic: true,
                maxSteps: true,
                requiresApproval: true,
                version: true,
                workspace: {
                    select: {
                        slug: true,
                        environment: true,
                        organization: {
                            select: {
                                slug: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: "asc" }
        });

        const workflows = await prisma.workflow.findMany({
            where: { isActive: true, workspace: { organizationId } },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                version: true,
                isActive: true,
                isPublished: true,
                inputSchemaJson: true,
                outputSchemaJson: true,
                workspace: {
                    select: {
                        slug: true,
                        environment: true,
                        organization: {
                            select: {
                                slug: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: "asc" }
        });

        const networks = await prisma.network.findMany({
            where: { isActive: true, workspace: { organizationId } },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                version: true,
                isActive: true,
                isPublished: true,
                maxSteps: true,
                workspace: {
                    select: {
                        slug: true,
                        environment: true,
                        organization: {
                            select: {
                                slug: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { name: "asc" }
        });

        // Transform agents to MCP tool definitions
        const tools = agents.map((agent) => ({
            name: `agent.${agent.slug}`,
            description: agent.description || `Agent: ${agent.name}`,
            version: agent.version.toString(),
            metadata: {
                agent_id: agent.id,
                agent_slug: agent.slug,
                agent_name: agent.name,
                model: `${agent.modelProvider}/${agent.modelName}`,
                is_active: agent.isActive,
                is_public: agent.isPublic,
                requires_approval: agent.requiresApproval,
                max_steps: agent.maxSteps,
                workspace: agent.workspace?.slug,
                environment: agent.workspace?.environment,
                organization: agent.workspace?.organization?.slug
            },
            inputSchema: {
                type: "object",
                properties: {
                    input: {
                        type: "string",
                        description: "The input message or task for the agent"
                    },
                    context: {
                        type: "object",
                        description: "Optional context variables",
                        additionalProperties: true
                    },
                    maxSteps: {
                        type: "number",
                        description: "Maximum tool-use steps (optional)"
                    }
                },
                required: ["input"]
            },
            outputSchema: {
                type: "object",
                properties: {
                    run_id: { type: "string" },
                    output: { type: "string" },
                    usage: { type: "object" },
                    cost_usd: { type: "number" },
                    duration_ms: { type: "number" },
                    model: { type: "string" }
                }
            },
            invoke_url: `/api/agents/${agent.slug}/invoke`
        }));

        const workflowDefaultInputSchema = {
            type: "object",
            properties: {
                input: {
                    type: "object",
                    description: "Workflow input payload"
                },
                source: {
                    type: "string",
                    description: "Source channel (api, webhook, test, etc.)"
                },
                environment: {
                    type: "string",
                    description: "Environment (development, staging, production)"
                },
                triggerType: {
                    type: "string",
                    description: "Trigger type (manual, api, scheduled, webhook, tool, test, retry)"
                },
                requestContext: {
                    type: "object",
                    description: "Optional request context"
                }
            },
            required: ["input"]
        };
        const workflowDefaultOutputSchema = {
            type: "object",
            properties: {
                runId: { type: "string" },
                status: { type: "string" },
                output: { type: "object" },
                error: { type: "string" }
            }
        };
        const workflowTools = workflows.map((workflow) => ({
            name: `workflow-${workflow.slug}`,
            description: workflow.description || `Workflow: ${workflow.name}`,
            version: workflow.version.toString(),
            metadata: {
                workflow_id: workflow.id,
                workflow_slug: workflow.slug,
                workflow_name: workflow.name,
                is_active: workflow.isActive,
                is_published: workflow.isPublished,
                workspace: workflow.workspace?.slug,
                environment: workflow.workspace?.environment,
                organization: workflow.workspace?.organization?.slug
            },
            inputSchema: normalizeSchema(workflow.inputSchemaJson, workflowDefaultInputSchema),
            outputSchema: normalizeSchema(workflow.outputSchemaJson, workflowDefaultOutputSchema),
            invoke_url: `/api/workflows/${workflow.slug}/execute`
        }));

        const networkDefaultInputSchema = {
            type: "object",
            properties: {
                message: { type: "string", description: "Message to route" },
                input: { type: "string", description: "Alias for message" },
                source: {
                    type: "string",
                    description: "Source channel (api, webhook, test, etc.)"
                },
                environment: {
                    type: "string",
                    description: "Environment (development, staging, production)"
                },
                triggerType: {
                    type: "string",
                    description: "Trigger type (manual, api, scheduled, webhook, tool, test, retry)"
                },
                threadId: { type: "string", description: "Optional thread ID" },
                resourceId: { type: "string", description: "Optional resource ID" }
            },
            required: ["message"]
        };
        const networkDefaultOutputSchema = {
            type: "object",
            properties: {
                runId: { type: "string" },
                outputText: { type: "string" },
                outputJson: { type: "object" },
                steps: { type: "number" }
            }
        };
        const networkTools = networks.map((network) => ({
            name: `network-${network.slug}`,
            description: network.description || `Network: ${network.name}`,
            version: network.version.toString(),
            metadata: {
                network_id: network.id,
                network_slug: network.slug,
                network_name: network.name,
                is_active: network.isActive,
                is_published: network.isPublished,
                max_steps: network.maxSteps,
                workspace: network.workspace?.slug,
                environment: network.workspace?.environment,
                organization: network.workspace?.organization?.slug
            },
            inputSchema: networkDefaultInputSchema,
            outputSchema: networkDefaultOutputSchema,
            invoke_url: `/api/networks/${network.slug}/execute`
        }));

        const crudBaseResponseSchema = {
            type: "object",
            properties: {
                success: { type: "boolean" },
                error: { type: "string" }
            }
        };

        const modelConfigSchema = {
            type: "object",
            properties: {
                reasoning: {
                    type: "object",
                    properties: { type: { type: "string", enum: ["enabled", "disabled"] } }
                },
                toolChoice: {
                    oneOf: [
                        { type: "string", enum: ["auto", "required", "none"] },
                        {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["tool"] },
                                toolName: { type: "string" }
                            },
                            required: ["type", "toolName"]
                        }
                    ]
                },
                thinking: {
                    type: "object",
                    properties: {
                        type: { type: "string", enum: ["enabled", "disabled"] },
                        budget_tokens: { type: "number" }
                    }
                },
                parallelToolCalls: { type: "boolean" },
                reasoningEffort: { type: "string", enum: ["low", "medium", "high"] },
                cacheControl: {
                    type: "object",
                    properties: { type: { type: "string", enum: ["ephemeral"] } }
                }
            },
            additionalProperties: true
        };

        const memoryConfigSchema = {
            type: "object",
            properties: {
                lastMessages: { type: "number" },
                semanticRecall: {
                    oneOf: [
                        { type: "boolean", enum: [false] },
                        {
                            type: "object",
                            properties: {
                                topK: { type: "number" },
                                messageRange: { type: "number" }
                            },
                            additionalProperties: true
                        }
                    ]
                },
                workingMemory: {
                    type: "object",
                    properties: {
                        enabled: { type: "boolean" },
                        template: { type: "string" }
                    },
                    additionalProperties: true
                }
            },
            additionalProperties: true
        };

        const agentToolBindingSchema = {
            type: "object",
            properties: {
                toolId: { type: "string" },
                config: { type: "object", additionalProperties: true }
            },
            required: ["toolId"]
        };

        const workflowDefinitionSchema = {
            type: "object",
            properties: {
                steps: { type: "array", items: { type: "object", additionalProperties: true } }
            },
            required: ["steps"],
            additionalProperties: true
        };

        const networkTopologySchema = {
            type: "object",
            properties: {
                nodes: { type: "array", items: { type: "object", additionalProperties: true } },
                edges: { type: "array", items: { type: "object", additionalProperties: true } },
                viewport: { type: "object", additionalProperties: true }
            },
            required: ["nodes", "edges"],
            additionalProperties: true
        };

        const networkPrimitiveSchema = {
            type: "object",
            properties: {
                primitiveType: { type: "string", enum: ["agent", "workflow", "tool"] },
                agentId: { type: "string" },
                workflowId: { type: "string" },
                toolId: { type: "string" },
                description: { type: "string" },
                position: { type: "object", additionalProperties: true }
            },
            required: ["primitiveType"]
        };

        const agentCreateInputSchema = {
            type: "object",
            properties: {
                name: { type: "string" },
                slug: { type: "string" },
                description: { type: "string" },
                instructions: { type: "string" },
                instructionsTemplate: { type: "string" },
                modelProvider: { type: "string" },
                modelName: { type: "string" },
                temperature: { type: "number" },
                maxTokens: { type: "number" },
                modelConfig: modelConfigSchema,
                extendedThinking: { type: "boolean" },
                thinkingBudget: { type: "number" },
                parallelToolCalls: { type: "boolean" },
                reasoningEffort: { type: "string", enum: ["low", "medium", "high"] },
                cacheControl: { type: "boolean" },
                toolChoice: modelConfigSchema.properties?.toolChoice,
                reasoning: modelConfigSchema.properties?.reasoning,
                memoryEnabled: { type: "boolean" },
                memoryConfig: memoryConfigSchema,
                maxSteps: { type: "number" },
                subAgents: { type: "array", items: { type: "string" } },
                workflows: { type: "array", items: { type: "string" } },
                scorers: { type: "array", items: { type: "string" } },
                toolIds: { type: "array", items: { type: "string" } },
                tools: { type: "array", items: agentToolBindingSchema },
                type: { type: "string", enum: ["USER", "SYSTEM"] },
                tenantId: { type: "string" },
                workspaceId: { type: "string" },
                ownerId: { type: "string" },
                isPublic: { type: "boolean" },
                requiresApproval: { type: "boolean" },
                maxSpendUsd: { type: "number" },
                metadata: { type: "object", additionalProperties: true },
                isActive: { type: "boolean" },
                createdBy: { type: "string" }
            },
            required: ["name", "instructions", "modelProvider", "modelName"],
            additionalProperties: true
        };

        const agentUpdateInputSchema = {
            type: "object",
            properties: {
                agentId: { type: "string" },
                restoreVersionId: { type: "string" },
                restoreVersion: { type: "number" },
                versionDescription: { type: "string" },
                createdBy: { type: "string" },
                data: agentCreateInputSchema
            },
            required: ["agentId"],
            additionalProperties: true
        };

        const workflowCreateInputSchema = {
            type: "object",
            properties: {
                name: { type: "string" },
                slug: { type: "string" },
                description: { type: "string" },
                definitionJson: workflowDefinitionSchema,
                compiledJson: { type: "object", additionalProperties: true },
                compiledAt: { type: "string" },
                compiledHash: { type: "string" },
                inputSchemaJson: { type: "object", additionalProperties: true },
                outputSchemaJson: { type: "object", additionalProperties: true },
                maxSteps: { type: "number" },
                timeout: { type: "number" },
                retryConfig: { type: "object", additionalProperties: true },
                isPublished: { type: "boolean" },
                isActive: { type: "boolean" },
                workspaceId: { type: "string" },
                ownerId: { type: "string" },
                type: { type: "string", enum: ["USER", "SYSTEM"] },
                versionDescription: { type: "string" },
                createdBy: { type: "string" }
            },
            required: ["name"],
            additionalProperties: true
        };

        const workflowUpdateInputSchema = {
            type: "object",
            properties: {
                workflowId: { type: "string" },
                restoreVersionId: { type: "string" },
                restoreVersion: { type: "number" },
                versionDescription: { type: "string" },
                createdBy: { type: "string" },
                data: workflowCreateInputSchema
            },
            required: ["workflowId"],
            additionalProperties: true
        };

        const networkCreateInputSchema = {
            type: "object",
            properties: {
                name: { type: "string" },
                slug: { type: "string" },
                description: { type: "string" },
                instructions: { type: "string" },
                modelProvider: { type: "string" },
                modelName: { type: "string" },
                temperature: { type: "number" },
                topologyJson: networkTopologySchema,
                memoryConfig: memoryConfigSchema,
                maxSteps: { type: "number" },
                isPublished: { type: "boolean" },
                isActive: { type: "boolean" },
                workspaceId: { type: "string" },
                ownerId: { type: "string" },
                type: { type: "string", enum: ["USER", "SYSTEM"] },
                primitives: { type: "array", items: networkPrimitiveSchema },
                versionDescription: { type: "string" },
                createdBy: { type: "string" }
            },
            required: ["name", "instructions", "modelProvider", "modelName"],
            additionalProperties: true
        };

        const networkUpdateInputSchema = {
            type: "object",
            properties: {
                networkId: { type: "string" },
                restoreVersionId: { type: "string" },
                restoreVersion: { type: "number" },
                versionDescription: { type: "string" },
                createdBy: { type: "string" },
                data: networkCreateInputSchema
            },
            required: ["networkId"],
            additionalProperties: true
        };

        const crudTools = [
            {
                name: "agent-create",
                description: "Create a new agent with full configuration.",
                inputSchema: agentCreateInputSchema,
                outputSchema: {
                    ...crudBaseResponseSchema,
                    properties: { ...crudBaseResponseSchema.properties, agent: { type: "object" } }
                },
                invoke_url: "/api/mcp"
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
                outputSchema: {
                    ...crudBaseResponseSchema,
                    properties: { ...crudBaseResponseSchema.properties, agent: { type: "object" } }
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent-update",
                description: "Update an agent configuration with versioning and rollback support.",
                inputSchema: agentUpdateInputSchema,
                outputSchema: {
                    ...crudBaseResponseSchema,
                    properties: { ...crudBaseResponseSchema.properties, agent: { type: "object" } }
                },
                invoke_url: "/api/mcp"
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
                invoke_url: "/api/mcp"
            },
            {
                name: "workflow-create",
                description: "Create a workflow definition with full configuration.",
                inputSchema: workflowCreateInputSchema,
                outputSchema: {
                    ...crudBaseResponseSchema,
                    properties: {
                        ...crudBaseResponseSchema.properties,
                        workflow: { type: "object" }
                    }
                },
                invoke_url: "/api/mcp"
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
                outputSchema: {
                    ...crudBaseResponseSchema,
                    properties: {
                        ...crudBaseResponseSchema.properties,
                        workflow: { type: "object" }
                    }
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "workflow-update",
                description: "Update a workflow definition with versioning and rollback support.",
                inputSchema: workflowUpdateInputSchema,
                outputSchema: {
                    ...crudBaseResponseSchema,
                    properties: {
                        ...crudBaseResponseSchema.properties,
                        workflow: { type: "object" }
                    }
                },
                invoke_url: "/api/mcp"
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
                invoke_url: "/api/mcp"
            },
            {
                name: "network-create",
                description: "Create a network with routing instructions and primitives.",
                inputSchema: networkCreateInputSchema,
                outputSchema: {
                    ...crudBaseResponseSchema,
                    properties: {
                        ...crudBaseResponseSchema.properties,
                        network: { type: "object" }
                    }
                },
                invoke_url: "/api/mcp"
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
                outputSchema: {
                    ...crudBaseResponseSchema,
                    properties: {
                        ...crudBaseResponseSchema.properties,
                        network: { type: "object" }
                    }
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "network-update",
                description:
                    "Update a network topology or routing config with versioning and rollback support.",
                inputSchema: networkUpdateInputSchema,
                outputSchema: {
                    ...crudBaseResponseSchema,
                    properties: {
                        ...crudBaseResponseSchema.properties,
                        network: { type: "object" }
                    }
                },
                invoke_url: "/api/mcp"
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
                invoke_url: "/api/mcp"
            }
        ];

        const workflowOpsTools = [
            {
                name: "workflow.execute",
                description: "Execute a workflow by slug or ID.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workflowSlug: { type: "string", description: "Workflow slug or ID" },
                        input: { type: "object", description: "Workflow input payload" },
                        source: {
                            type: "string",
                            description: "Source channel (api, webhook, test, etc.)"
                        },
                        environment: {
                            type: "string",
                            description: "Environment (development, staging, production)"
                        },
                        triggerType: {
                            type: "string",
                            description:
                                "Trigger type (manual, api, scheduled, webhook, tool, test, retry)"
                        },
                        requestContext: {
                            type: "object",
                            description: "Optional request context"
                        }
                    },
                    required: ["workflowSlug", "input"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "workflow.list-runs",
                description: "List workflow runs with filters and time range.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workflowSlug: { type: "string", description: "Workflow slug or ID" },
                        limit: { type: "number", description: "Max runs to return" },
                        status: { type: "string", description: "Run status filter" },
                        environment: { type: "string", description: "Environment filter" },
                        triggerType: { type: "string", description: "Trigger type filter" },
                        from: { type: "string", description: "Start ISO timestamp" },
                        to: { type: "string", description: "End ISO timestamp" },
                        search: { type: "string", description: "Search run ID" }
                    },
                    required: ["workflowSlug"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "workflow.get-run",
                description: "Fetch workflow run details including steps.",
                inputSchema: {
                    type: "object",
                    properties: {
                        workflowSlug: { type: "string", description: "Workflow slug or ID" },
                        runId: { type: "string", description: "Run ID" }
                    },
                    required: ["workflowSlug", "runId"]
                },
                invoke_url: "/api/mcp"
            }
        ];

        const workflowConfigTools = [
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
                invoke_url: "/api/mcp"
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
                invoke_url: "/api/mcp"
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
                invoke_url: "/api/mcp"
            }
        ];

        const agentOpsTools = [
            {
                name: "agent-runs-list",
                description: "List agent runs with filters and time range.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        status: { type: "string", description: "Run status filter" },
                        search: { type: "string", description: "Search text" },
                        from: { type: "string", description: "Start ISO timestamp" },
                        to: { type: "string", description: "End ISO timestamp" },
                        cursor: { type: "string", description: "Pagination cursor" },
                        limit: { type: "number", description: "Max runs to return" },
                        source: {
                            type: "string",
                            description: "Source filter: production, simulation, or all"
                        }
                    },
                    required: ["agentId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent-runs-get",
                description: "Fetch an agent run with trace, evaluation, and version.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        runId: { type: "string", description: "Run ID" }
                    },
                    required: ["agentId", "runId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "trigger-events-list",
                description: "List trigger monitoring events with filters and time range.",
                inputSchema: {
                    type: "object",
                    properties: {
                        status: { type: "string", description: "Trigger event status" },
                        sourceType: { type: "string", description: "Source type filter" },
                        integrationKey: { type: "string", description: "Integration key filter" },
                        triggerId: { type: "string", description: "Trigger ID filter" },
                        agentId: { type: "string", description: "Agent ID filter" },
                        eventName: { type: "string", description: "Event name filter" },
                        search: { type: "string", description: "Search text" },
                        from: { type: "string", description: "Start ISO timestamp" },
                        to: { type: "string", description: "End ISO timestamp" },
                        limit: { type: "number", description: "Max events to return" },
                        offset: { type: "number", description: "Pagination offset" },
                        workspaceId: { type: "string", description: "Workspace override" }
                    }
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "trigger-events-get",
                description: "Fetch a trigger monitoring event detail.",
                inputSchema: {
                    type: "object",
                    properties: {
                        eventId: { type: "string", description: "Trigger event ID" },
                        workspaceId: { type: "string", description: "Workspace override" }
                    },
                    required: ["eventId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent-evaluations-list",
                description: "List evaluations for an agent with trends and insights.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        from: { type: "string", description: "Start ISO timestamp" },
                        to: { type: "string", description: "End ISO timestamp" },
                        limit: { type: "number", description: "Max evaluations to return" },
                        cursor: { type: "string", description: "Pagination cursor" },
                        source: {
                            type: "string",
                            description: "Source filter: production, simulation, or all"
                        }
                    },
                    required: ["agentId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent-evaluations-run",
                description: "Run evaluations on unevaluated runs for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        limit: { type: "number", description: "Max runs to evaluate" },
                        runIds: {
                            type: "array",
                            items: { type: "string" },
                            description: "Optional specific run IDs to evaluate"
                        }
                    },
                    required: ["agentId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent-versions-list",
                description: "List version history for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        limit: { type: "number", description: "Max versions to return" },
                        cursor: { type: "number", description: "Version cursor (numeric)" }
                    },
                    required: ["agentId"]
                },
                invoke_url: "/api/mcp"
            }
        ];

        const networkOpsTools = [
            {
                name: "network.execute",
                description: "Execute a network by slug or ID.",
                inputSchema: {
                    type: "object",
                    properties: {
                        networkSlug: { type: "string", description: "Network slug or ID" },
                        message: { type: "string", description: "Message to route" },
                        source: {
                            type: "string",
                            description: "Source channel (api, webhook, test, etc.)"
                        },
                        environment: {
                            type: "string",
                            description: "Environment (development, staging, production)"
                        },
                        triggerType: {
                            type: "string",
                            description:
                                "Trigger type (manual, api, scheduled, webhook, tool, test, retry)"
                        },
                        threadId: { type: "string", description: "Optional thread ID" },
                        resourceId: { type: "string", description: "Optional resource ID" }
                    },
                    required: ["networkSlug", "message"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "network.list-runs",
                description: "List network runs with filters and time range.",
                inputSchema: {
                    type: "object",
                    properties: {
                        networkSlug: { type: "string", description: "Network slug or ID" },
                        limit: { type: "number", description: "Max runs to return" },
                        status: { type: "string", description: "Run status filter" },
                        environment: { type: "string", description: "Environment filter" },
                        triggerType: { type: "string", description: "Trigger type filter" },
                        from: { type: "string", description: "Start ISO timestamp" },
                        to: { type: "string", description: "End ISO timestamp" },
                        search: { type: "string", description: "Search run ID or text" }
                    },
                    required: ["networkSlug"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "network.get-run",
                description: "Fetch network run details including steps.",
                inputSchema: {
                    type: "object",
                    properties: {
                        networkSlug: { type: "string", description: "Network slug or ID" },
                        runId: { type: "string", description: "Run ID" }
                    },
                    required: ["networkSlug", "runId"]
                },
                invoke_url: "/api/mcp"
            }
        ];

        const networkConfigTools = [
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
                invoke_url: "/api/mcp"
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
                invoke_url: "/api/mcp"
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
                invoke_url: "/api/mcp"
            }
        ];

        const scheduleTools = [
            {
                name: "agent_schedule_create",
                description: "Create a schedule for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        name: { type: "string", description: "Schedule name" },
                        description: { type: "string" },
                        cronExpr: { type: "string" },
                        timezone: { type: "string" },
                        input: { type: "string" },
                        context: { type: "object" },
                        maxSteps: { type: "number" },
                        isActive: { type: "boolean" }
                    },
                    required: ["agentId", "name", "cronExpr"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_schedule_list",
                description: "List schedules for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" }
                    },
                    required: ["agentId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_schedule_update",
                description: "Update a schedule for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        scheduleId: { type: "string", description: "Schedule ID" },
                        name: { type: "string" },
                        description: { type: "string" },
                        cronExpr: { type: "string" },
                        timezone: { type: "string" },
                        input: { type: "string" },
                        context: { type: "object" },
                        maxSteps: { type: "number" },
                        isActive: { type: "boolean" }
                    },
                    required: ["agentId", "scheduleId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_schedule_delete",
                description: "Delete a schedule for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        scheduleId: { type: "string", description: "Schedule ID" }
                    },
                    required: ["agentId", "scheduleId"]
                },
                invoke_url: "/api/mcp"
            }
        ];

        const triggerTools = [
            {
                name: "agent_trigger_create",
                description: "Create a trigger for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        name: { type: "string" },
                        description: { type: "string" },
                        triggerType: { type: "string", description: "webhook or event" },
                        eventName: { type: "string" },
                        filter: { type: "object" },
                        inputMapping: { type: "object" },
                        isActive: { type: "boolean" }
                    },
                    required: ["agentId", "name", "triggerType"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_list",
                description: "List triggers for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" }
                    },
                    required: ["agentId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_update",
                description: "Update a trigger for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        triggerId: { type: "string", description: "Trigger ID" },
                        name: { type: "string" },
                        description: { type: "string" },
                        eventName: { type: "string" },
                        filter: { type: "object" },
                        inputMapping: { type: "object" },
                        isActive: { type: "boolean" }
                    },
                    required: ["agentId", "triggerId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_delete",
                description: "Delete a trigger for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        triggerId: { type: "string", description: "Trigger ID" }
                    },
                    required: ["agentId", "triggerId"]
                },
                invoke_url: "/api/mcp"
            }
        ];

        const executionTriggerTools = [
            {
                name: "agent_trigger_unified_list",
                description: "List all execution triggers for an agent.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" }
                    },
                    required: ["agentId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_unified_get",
                description: "Get a unified execution trigger.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        triggerId: { type: "string", description: "Unified trigger ID" }
                    },
                    required: ["agentId", "triggerId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_unified_create",
                description: "Create a unified execution trigger.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        type: { type: "string", description: "Trigger type" },
                        name: { type: "string" },
                        description: { type: "string" },
                        config: { type: "object" },
                        input: { type: "string" },
                        context: { type: "object" },
                        maxSteps: { type: "number" },
                        environment: { type: "string" },
                        filter: { type: "object" },
                        inputMapping: { type: "object" },
                        isActive: { type: "boolean" }
                    },
                    required: ["agentId", "type", "name"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_unified_update",
                description: "Update a unified execution trigger.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        triggerId: { type: "string", description: "Unified trigger ID" },
                        name: { type: "string" },
                        description: { type: "string" },
                        config: { type: "object" },
                        input: { type: "string" },
                        context: { type: "object" },
                        maxSteps: { type: "number" },
                        environment: { type: "string" },
                        filter: { type: "object" },
                        inputMapping: { type: "object" },
                        isActive: { type: "boolean" }
                    },
                    required: ["agentId", "triggerId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_unified_delete",
                description: "Delete a unified execution trigger.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        triggerId: { type: "string", description: "Unified trigger ID" }
                    },
                    required: ["agentId", "triggerId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_unified_enable",
                description: "Enable a unified execution trigger.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        triggerId: { type: "string", description: "Unified trigger ID" }
                    },
                    required: ["agentId", "triggerId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_unified_disable",
                description: "Disable a unified execution trigger.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        triggerId: { type: "string", description: "Unified trigger ID" }
                    },
                    required: ["agentId", "triggerId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_test",
                description: "Dry-run a unified trigger.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        triggerId: { type: "string", description: "Unified trigger ID" },
                        payload: { type: "object" },
                        input: { type: "string" },
                        context: { type: "object" },
                        maxSteps: { type: "number" },
                        environment: { type: "string" }
                    },
                    required: ["agentId", "triggerId"]
                },
                invoke_url: "/api/mcp"
            },
            {
                name: "agent_trigger_execute",
                description: "Execute a unified trigger.",
                inputSchema: {
                    type: "object",
                    properties: {
                        agentId: { type: "string", description: "Agent slug or ID" },
                        triggerId: { type: "string", description: "Unified trigger ID" },
                        payload: { type: "object" },
                        input: { type: "string" },
                        context: { type: "object" },
                        maxSteps: { type: "number" },
                        environment: { type: "string" }
                    },
                    required: ["agentId", "triggerId"]
                },
                invoke_url: "/api/mcp"
            }
        ];

        const integrationTools = [
            {
                name: "integration-mcp-config",
                description:
                    "Read MCP config, preview impact, and apply updates with confirmation gating.",
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
                invoke_url: "/api/mcp"
            }
        ];

        return NextResponse.json({
            success: true,
            protocol: "mcp-agent-gateway/1.0",
            server_info: {
                name: "mastra-agent-gateway",
                version: "1.0.0",
                capabilities: ["tools", "invoke"]
            },
            tools: [
                ...tools,
                ...workflowTools,
                ...networkTools,
                ...crudTools,
                ...workflowOpsTools,
                ...workflowConfigTools,
                ...networkOpsTools,
                ...networkConfigTools,
                ...agentOpsTools,
                ...scheduleTools,
                ...triggerTools,
                ...executionTriggerTools,
                ...integrationTools
            ],
            total:
                tools.length +
                workflowTools.length +
                networkTools.length +
                crudTools.length +
                workflowOpsTools.length +
                workflowConfigTools.length +
                networkOpsTools.length +
                networkConfigTools.length +
                agentOpsTools.length +
                scheduleTools.length +
                triggerTools.length +
                executionTriggerTools.length +
                integrationTools.length
        });
    } catch (error) {
        console.error("[MCP Gateway] Error listing tools:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list tools"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/mcp
 *
 * Invokes an agent tool using MCP-like JSON-RPC.
 *
 * Request body:
 * {
 *   "method": "invoke",
 *   "tool": "agent.mcp-agent",
 *   "params": {
 *     "input": "Your question here",
 *     "context": { ... }
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "result": {
 *     "run_id": "...",
 *     "output": "Agent response",
 *     "usage": { ... },
 *     "cost_usd": 0.05
 *   }
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { userId, organizationId } = authResult;

        const body = await request.json();
        const { method, tool, params } = body;

        // Validate request
        if (!method) {
            return NextResponse.json({ success: false, error: "Missing method" }, { status: 400 });
        }

        if (method !== "invoke" && method !== "tools/call") {
            return NextResponse.json(
                {
                    success: false,
                    error: `Unsupported method: ${method}. Supported: invoke, tools/call`
                },
                { status: 400 }
            );
        }

        if (!tool) {
            return NextResponse.json(
                { success: false, error: "Missing tool name" },
                { status: 400 }
            );
        }

        console.log(`[MCP Gateway] Invoking tool: ${tool}`);

        const authHeaders: Record<string, string> = {};
        const authorization = request.headers.get("authorization");
        if (authorization) {
            authHeaders.Authorization = authorization;
        }
        const apiKeyHeader = request.headers.get("x-api-key");
        if (apiKeyHeader) {
            authHeaders["X-API-Key"] = apiKeyHeader;
        }
        const orgSlugHeader = request.headers.get("x-organization-slug");
        if (orgSlugHeader) {
            authHeaders["X-Organization-Slug"] = orgSlugHeader;
        }
        const resolveWorkflowInput = () => {
            if (!params) return null;
            if (params.input !== undefined) return params.input;
            if (params.inputData !== undefined) return params.inputData;
            const sanitized = { ...params };
            delete sanitized.source;
            delete sanitized.environment;
            delete sanitized.triggerType;
            delete sanitized.requestContext;
            delete sanitized.workflowSlug;
            return sanitized;
        };

        // Helper to get internal base URL - use localhost in production to avoid DNS/SSL issues
        const getInternalBaseUrl = () => {
            if (process.env.NODE_ENV === "production") {
                return "http://localhost:3001";
            }
            return request.url.split("/api/")[0];
        };

        const crudToolNames = new Set([
            "agent-create",
            "agent-read",
            "agent-update",
            "agent-delete",
            "workflow-create",
            "workflow-read",
            "workflow-update",
            "workflow-delete",
            "network-create",
            "network-read",
            "network-update",
            "network-delete"
        ]);

        const scheduleToolNames = new Set([
            "agent_schedule_create",
            "agent_schedule_list",
            "agent_schedule_update",
            "agent_schedule_delete"
        ]);

        const triggerToolNames = new Set([
            "agent_trigger_create",
            "agent_trigger_list",
            "agent_trigger_update",
            "agent_trigger_delete"
        ]);

        const executionTriggerToolNames = new Set([
            "agent_trigger_unified_list",
            "agent_trigger_unified_get",
            "agent_trigger_unified_create",
            "agent_trigger_unified_update",
            "agent_trigger_unified_delete",
            "agent_trigger_unified_enable",
            "agent_trigger_unified_disable",
            "agent_trigger_test",
            "agent_trigger_execute"
        ]);

        const integrationToolNames = new Set(["integration-mcp-config"]);

        const callInternalApi = async (
            url: URL,
            method: string,
            body?: Record<string, unknown>
        ) => {
            const response = await fetch(url.toString(), {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders
                },
                body: body ? JSON.stringify(body) : undefined
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                return {
                    ok: false,
                    status: response.status,
                    error: data.error || "Request failed"
                };
            }

            return { ok: true, data };
        };

        if (crudToolNames.has(tool)) {
            const crudTool = getToolByName(tool);
            if (!crudTool || typeof crudTool.execute !== "function") {
                return NextResponse.json(
                    { success: false, error: `Tool not found: ${tool}` },
                    { status: 404 }
                );
            }

            const workspaceId = await getDefaultWorkspaceIdForUser(userId);
            const scopedParams = params && typeof params === "object" ? { ...params } : {};

            const applyDefaults = (target: Record<string, unknown>) => {
                if (tool.startsWith("agent-")) {
                    if (organizationId && target.tenantId === undefined) {
                        target.tenantId = organizationId;
                    }
                }
                if (workspaceId && target.workspaceId === undefined) {
                    target.workspaceId = workspaceId;
                }
                if (target.ownerId === undefined) {
                    target.ownerId = userId;
                }
            };

            if (tool.endsWith("-create")) {
                applyDefaults(scopedParams as Record<string, unknown>);
            }

            try {
                const result = await crudTool.execute(scopedParams);
                return NextResponse.json({ success: true, result });
            } catch (error) {
                return NextResponse.json(
                    {
                        success: false,
                        error: error instanceof Error ? error.message : "Failed to execute tool"
                    },
                    { status: 400 }
                );
            }
        }

        if (integrationToolNames.has(tool)) {
            const integrationTool = getToolByName(tool);
            if (!integrationTool || typeof integrationTool.execute !== "function") {
                return NextResponse.json(
                    { success: false, error: `Tool not found: ${tool}` },
                    { status: 404 }
                );
            }

            const scopedParams =
                params && typeof params === "object" ? { ...params } : {};
            if (organizationId && scopedParams.organizationId === undefined) {
                scopedParams.organizationId = organizationId;
            }
            if (userId && scopedParams.userId === undefined) {
                scopedParams.userId = userId;
            }

            try {
                const result = await integrationTool.execute(scopedParams);
                return NextResponse.json({ success: true, result });
            } catch (error) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            error instanceof Error
                                ? error.message
                                : "Failed to execute integration tool"
                    },
                    { status: 500 }
                );
            }
        }

        if (scheduleToolNames.has(tool)) {
            const agentId = params?.agentId;
            if (!agentId || typeof agentId !== "string") {
                return NextResponse.json(
                    { success: false, error: "Missing params.agentId" },
                    { status: 400 }
                );
            }

            if (tool === "agent_schedule_list") {
                const url = new URL(`/api/agents/${agentId}/schedules`, getInternalBaseUrl());
                const result = await callInternalApi(url, "GET");
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_schedule_create") {
                const url = new URL(`/api/agents/${agentId}/schedules`, getInternalBaseUrl());
                const payload = { ...params };
                delete payload.agentId;
                const result = await callInternalApi(url, "POST", payload);
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            const scheduleId = params?.scheduleId;
            if (!scheduleId || typeof scheduleId !== "string") {
                return NextResponse.json(
                    { success: false, error: "Missing params.scheduleId" },
                    { status: 400 }
                );
            }

            if (tool === "agent_schedule_update") {
                const url = new URL(
                    `/api/agents/${agentId}/schedules/${scheduleId}`,
                    getInternalBaseUrl()
                );
                const payload = { ...params };
                delete payload.agentId;
                delete payload.scheduleId;
                const result = await callInternalApi(url, "PATCH", payload);
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_schedule_delete") {
                const url = new URL(
                    `/api/agents/${agentId}/schedules/${scheduleId}`,
                    getInternalBaseUrl()
                );
                const result = await callInternalApi(url, "DELETE");
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }
        }

        if (triggerToolNames.has(tool)) {
            const agentId = params?.agentId;
            if (!agentId || typeof agentId !== "string") {
                return NextResponse.json(
                    { success: false, error: "Missing params.agentId" },
                    { status: 400 }
                );
            }

            if (tool === "agent_trigger_list") {
                const url = new URL(`/api/agents/${agentId}/triggers`, getInternalBaseUrl());
                const result = await callInternalApi(url, "GET");
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_trigger_create") {
                const url = new URL(`/api/agents/${agentId}/triggers`, getInternalBaseUrl());
                const payload = { ...params };
                delete payload.agentId;
                const result = await callInternalApi(url, "POST", payload);
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            const triggerId = params?.triggerId;
            if (!triggerId || typeof triggerId !== "string") {
                return NextResponse.json(
                    { success: false, error: "Missing params.triggerId" },
                    { status: 400 }
                );
            }

            if (tool === "agent_trigger_update") {
                const url = new URL(
                    `/api/agents/${agentId}/triggers/${triggerId}`,
                    getInternalBaseUrl()
                );
                const payload = { ...params };
                delete payload.agentId;
                delete payload.triggerId;
                const result = await callInternalApi(url, "PATCH", payload);
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_trigger_delete") {
                const url = new URL(
                    `/api/agents/${agentId}/triggers/${triggerId}`,
                    getInternalBaseUrl()
                );
                const result = await callInternalApi(url, "DELETE");
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }
        }

        if (executionTriggerToolNames.has(tool)) {
            const agentId = params?.agentId;
            if (!agentId || typeof agentId !== "string") {
                return NextResponse.json(
                    { success: false, error: "Missing params.agentId" },
                    { status: 400 }
                );
            }

            if (tool === "agent_trigger_unified_list") {
                const url = new URL(
                    `/api/agents/${agentId}/execution-triggers`,
                    getInternalBaseUrl()
                );
                const result = await callInternalApi(url, "GET");
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_trigger_unified_create") {
                const url = new URL(
                    `/api/agents/${agentId}/execution-triggers`,
                    getInternalBaseUrl()
                );
                const payload = { ...params };
                delete payload.agentId;
                const result = await callInternalApi(url, "POST", payload);
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            const triggerId = params?.triggerId;
            if (!triggerId || typeof triggerId !== "string") {
                return NextResponse.json(
                    { success: false, error: "Missing params.triggerId" },
                    { status: 400 }
                );
            }

            if (tool === "agent_trigger_unified_get") {
                const url = new URL(
                    `/api/agents/${agentId}/execution-triggers/${triggerId}`,
                    getInternalBaseUrl()
                );
                const result = await callInternalApi(url, "GET");
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_trigger_unified_update") {
                const url = new URL(
                    `/api/agents/${agentId}/execution-triggers/${triggerId}`,
                    getInternalBaseUrl()
                );
                const payload = { ...params };
                delete payload.agentId;
                delete payload.triggerId;
                const result = await callInternalApi(url, "PATCH", payload);
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_trigger_unified_enable") {
                const url = new URL(
                    `/api/agents/${agentId}/execution-triggers/${triggerId}`,
                    getInternalBaseUrl()
                );
                const result = await callInternalApi(url, "PATCH", { isActive: true });
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_trigger_unified_disable") {
                const url = new URL(
                    `/api/agents/${agentId}/execution-triggers/${triggerId}`,
                    getInternalBaseUrl()
                );
                const result = await callInternalApi(url, "PATCH", { isActive: false });
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_trigger_unified_delete") {
                const url = new URL(
                    `/api/agents/${agentId}/execution-triggers/${triggerId}`,
                    getInternalBaseUrl()
                );
                const result = await callInternalApi(url, "DELETE");
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_trigger_test") {
                const url = new URL(
                    `/api/agents/${agentId}/execution-triggers/${triggerId}/test`,
                    getInternalBaseUrl()
                );
                const payload = { ...params };
                delete payload.agentId;
                delete payload.triggerId;
                const result = await callInternalApi(url, "POST", payload);
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }

            if (tool === "agent_trigger_execute") {
                const url = new URL(
                    `/api/agents/${agentId}/execution-triggers/${triggerId}/execute`,
                    getInternalBaseUrl()
                );
                const payload = { ...params };
                delete payload.agentId;
                delete payload.triggerId;
                const result = await callInternalApi(url, "POST", payload);
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            }
        }

        if (tool.startsWith("agent.")) {
            const agentSlug = tool.slice(6);
            if (!params?.input) {
                return NextResponse.json(
                    { success: false, error: "Missing params.input" },
                    { status: 400 }
                );
            }

            const agent = await prisma.agent.findFirst({
                where: {
                    OR: [{ slug: agentSlug }, { id: agentSlug }],
                    workspace: { organizationId }
                },
                select: { id: true }
            });
            if (!agent) {
                return NextResponse.json(
                    { success: false, error: `Tool not found: ${tool}` },
                    { status: 404 }
                );
            }

            const invokeUrl = new URL(`/api/agents/${agentSlug}/invoke`, getInternalBaseUrl());
            const invokeResponse = await fetch(invokeUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders
                },
                body: JSON.stringify({
                    input: params.input,
                    context: params.context,
                    maxSteps: params.maxSteps,
                    mode: "sync"
                })
            });

            const result = await invokeResponse.json();
            if (!result.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error: result.error,
                        run_id: result.run_id
                    },
                    { status: invokeResponse.status }
                );
            }

            return NextResponse.json({
                success: true,
                result: {
                    run_id: result.run_id,
                    output: result.output,
                    usage: result.usage,
                    cost_usd: result.cost_usd,
                    duration_ms: result.duration_ms,
                    model: result.model
                }
            });
        }

        if (tool === "workflow.execute") {
            const resolvedInput = resolveWorkflowInput();
            if (!params?.workflowSlug || resolvedInput === null) {
                return NextResponse.json(
                    { success: false, error: "Missing workflowSlug or input" },
                    { status: 400 }
                );
            }

            const workflow = await prisma.workflow.findFirst({
                where: {
                    OR: [{ slug: params.workflowSlug }, { id: params.workflowSlug }],
                    workspace: { organizationId }
                },
                select: { id: true }
            });
            if (!workflow) {
                return NextResponse.json(
                    { success: false, error: `Workflow not found: ${params.workflowSlug}` },
                    { status: 404 }
                );
            }

            const execUrl = new URL(
                `/api/workflows/${params.workflowSlug}/execute`,
                getInternalBaseUrl()
            );
            const execResponse = await fetch(execUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders
                },
                body: JSON.stringify({
                    input: resolvedInput,
                    source: params.source,
                    environment: params.environment,
                    triggerType: params.triggerType,
                    requestContext: params.requestContext
                })
            });
            const execResult = await execResponse.json();
            if (!execResponse.ok) {
                return NextResponse.json(
                    { success: false, error: execResult.error || "Workflow execution failed" },
                    { status: execResponse.status }
                );
            }

            let runDetail = null;
            if (execResult.runId) {
                const runUrl = new URL(
                    `/api/workflows/${params.workflowSlug}/runs/${execResult.runId}`,
                    getInternalBaseUrl()
                );
                const runResponse = await fetch(runUrl, { headers: authHeaders });
                runDetail = await runResponse.json();
            }

            return NextResponse.json({
                success: true,
                result: {
                    runId: execResult.runId,
                    status: execResult.status,
                    output: execResult.output,
                    error: execResult.error,
                    run: runDetail?.run || null
                }
            });
        }

        if (tool === "workflow-generate") {
            if (!params?.prompt) {
                return NextResponse.json(
                    { success: false, error: "Missing prompt" },
                    { status: 400 }
                );
            }
            const url = new URL("/api/workflows/generate", getInternalBaseUrl());
            const result = await callInternalApi(url, "POST", { prompt: params.prompt });
            if (!result.ok) {
                return NextResponse.json(
                    { success: false, error: result.error },
                    { status: result.status }
                );
            }
            return NextResponse.json({ success: true, result: result.data });
        }

        if (tool === "workflow-validate") {
            if (!params?.definitionJson) {
                return NextResponse.json(
                    { success: false, error: "Missing definitionJson" },
                    { status: 400 }
                );
            }
            const url = new URL("/api/workflows/validate", getInternalBaseUrl());
            const result = await callInternalApi(url, "POST", {
                definitionJson: params.definitionJson
            });
            if (!result.ok) {
                return NextResponse.json(
                    { success: false, error: result.error },
                    { status: result.status }
                );
            }
            return NextResponse.json({ success: true, result: result.data });
        }

        if (tool === "workflow-designer-chat") {
            if (!params?.workflowSlug || !params?.prompt || !params?.definitionJson) {
                return NextResponse.json(
                    { success: false, error: "Missing workflowSlug, prompt, or definitionJson" },
                    { status: 400 }
                );
            }
            const url = new URL(
                `/api/workflows/${params.workflowSlug}/designer-chat`,
                getInternalBaseUrl()
            );
            const result = await callInternalApi(url, "POST", {
                prompt: params.prompt,
                definitionJson: params.definitionJson,
                selected: params.selected
            });
            if (!result.ok) {
                return NextResponse.json(
                    { success: false, error: result.error },
                    { status: result.status }
                );
            }
            return NextResponse.json({ success: true, result: result.data });
        }

        if (tool === "network.execute") {
            if (!params?.networkSlug || !params?.message) {
                return NextResponse.json(
                    { success: false, error: "Missing networkSlug or message" },
                    { status: 400 }
                );
            }

            const network = await prisma.network.findFirst({
                where: {
                    OR: [{ slug: params.networkSlug }, { id: params.networkSlug }],
                    workspace: { organizationId }
                },
                select: { id: true }
            });
            if (!network) {
                return NextResponse.json(
                    { success: false, error: `Network not found: ${params.networkSlug}` },
                    { status: 404 }
                );
            }

            const execUrl = new URL(
                `/api/networks/${params.networkSlug}/execute`,
                getInternalBaseUrl()
            );
            const execResponse = await fetch(execUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders
                },
                body: JSON.stringify({
                    message: params.message,
                    source: params.source,
                    environment: params.environment,
                    triggerType: params.triggerType,
                    threadId: params.threadId,
                    resourceId: params.resourceId
                })
            });
            const execResult = await execResponse.json();
            if (!execResponse.ok) {
                return NextResponse.json(
                    { success: false, error: execResult.error || "Network execution failed" },
                    { status: execResponse.status }
                );
            }

            let runDetail = null;
            if (execResult.runId) {
                const runUrl = new URL(
                    `/api/networks/${params.networkSlug}/runs/${execResult.runId}`,
                    getInternalBaseUrl()
                );
                const runResponse = await fetch(runUrl, { headers: authHeaders });
                runDetail = await runResponse.json();
            }

            return NextResponse.json({
                success: true,
                result: {
                    runId: execResult.runId,
                    outputText: execResult.outputText,
                    outputJson: execResult.outputJson,
                    steps: execResult.steps,
                    run: runDetail?.run || null
                }
            });
        }

        if (tool.startsWith("workflow-")) {
            const workflowSlug = tool.slice("workflow-".length);
            const resolvedInput = resolveWorkflowInput();
            if (!resolvedInput) {
                return NextResponse.json(
                    { success: false, error: "Missing input" },
                    { status: 400 }
                );
            }

            const execUrl = new URL(`/api/workflows/${workflowSlug}/execute`, getInternalBaseUrl());
            const execResponse = await fetch(execUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders
                },
                body: JSON.stringify({
                    input: resolvedInput,
                    source: params.source,
                    environment: params.environment,
                    triggerType: params.triggerType,
                    requestContext: params.requestContext
                })
            });
            const execResult = await execResponse.json();
            if (!execResponse.ok) {
                return NextResponse.json(
                    { success: false, error: execResult.error || "Workflow execution failed" },
                    { status: execResponse.status }
                );
            }

            let runDetail = null;
            if (execResult.runId) {
                const runUrl = new URL(
                    `/api/workflows/${workflowSlug}/runs/${execResult.runId}`,
                    getInternalBaseUrl()
                );
                const runResponse = await fetch(runUrl, { headers: authHeaders });
                runDetail = await runResponse.json();
            }

            return NextResponse.json({
                success: true,
                result: {
                    runId: execResult.runId,
                    status: execResult.status,
                    output: execResult.output,
                    error: execResult.error,
                    run: runDetail?.run || null
                }
            });
        }

        if (tool === "workflow.list-runs") {
            if (!params?.workflowSlug) {
                return NextResponse.json(
                    { success: false, error: "Missing workflowSlug" },
                    { status: 400 }
                );
            }
            const searchParams = new URLSearchParams();
            if (params.limit) searchParams.set("limit", String(params.limit));
            if (params.status) searchParams.set("status", params.status);
            if (params.environment) searchParams.set("environment", params.environment);
            if (params.triggerType) searchParams.set("triggerType", params.triggerType);
            if (params.from) searchParams.set("from", params.from);
            if (params.to) searchParams.set("to", params.to);
            if (params.search) searchParams.set("search", params.search);

            const listUrl = new URL(
                `/api/workflows/${params.workflowSlug}/runs?${searchParams.toString()}`,
                getInternalBaseUrl()
            );
            const listResponse = await fetch(listUrl, { headers: authHeaders });
            const listResult = await listResponse.json();
            return NextResponse.json({ success: true, result: listResult });
        }

        if (tool === "agent-runs-list") {
            if (!params?.agentId) {
                return NextResponse.json(
                    { success: false, error: "Missing agentId" },
                    { status: 400 }
                );
            }
            const searchParams = new URLSearchParams();
            if (params.status) searchParams.set("status", String(params.status));
            if (params.search) searchParams.set("search", String(params.search));
            if (params.from) searchParams.set("from", String(params.from));
            if (params.to) searchParams.set("to", String(params.to));
            if (params.cursor) searchParams.set("cursor", String(params.cursor));
            if (params.limit) searchParams.set("limit", String(params.limit));
            if (params.source) searchParams.set("source", String(params.source));

            const listUrl = new URL(
                `/api/agents/${params.agentId}/runs?${searchParams.toString()}`,
                getInternalBaseUrl()
            );
            const listResult = await callInternalApi(listUrl, "GET");
            if (!listResult.ok) {
                return NextResponse.json(
                    { success: false, error: listResult.error },
                    { status: listResult.status }
                );
            }
            return NextResponse.json({ success: true, result: listResult.data });
        }

        if (tool === "agent-runs-get") {
            if (!params?.agentId || !params?.runId) {
                return NextResponse.json(
                    { success: false, error: "Missing agentId or runId" },
                    { status: 400 }
                );
            }
            const runUrl = new URL(
                `/api/agents/${params.agentId}/runs/${params.runId}`,
                getInternalBaseUrl()
            );
            const runResult = await callInternalApi(runUrl, "GET");
            if (!runResult.ok) {
                return NextResponse.json(
                    { success: false, error: runResult.error },
                    { status: runResult.status }
                );
            }
            return NextResponse.json({ success: true, result: runResult.data });
        }

        if (tool === "trigger-events-list") {
            const searchParams = new URLSearchParams();
            if (params?.status) searchParams.set("status", String(params.status));
            if (params?.sourceType) searchParams.set("sourceType", String(params.sourceType));
            if (params?.integrationKey)
                searchParams.set("integrationKey", String(params.integrationKey));
            if (params?.triggerId) searchParams.set("triggerId", String(params.triggerId));
            if (params?.agentId) searchParams.set("agentId", String(params.agentId));
            if (params?.eventName) searchParams.set("eventName", String(params.eventName));
            if (params?.search) searchParams.set("search", String(params.search));
            if (params?.from) searchParams.set("from", String(params.from));
            if (params?.to) searchParams.set("to", String(params.to));
            if (params?.limit) searchParams.set("limit", String(params.limit));
            if (params?.offset) searchParams.set("offset", String(params.offset));
            if (params?.workspaceId) searchParams.set("workspaceId", String(params.workspaceId));

            const listUrl = new URL(
                `/api/live/triggers?${searchParams.toString()}`,
                getInternalBaseUrl()
            );
            const listResult = await callInternalApi(listUrl, "GET");
            if (!listResult.ok) {
                return NextResponse.json(
                    { success: false, error: listResult.error },
                    { status: listResult.status }
                );
            }
            return NextResponse.json({ success: true, result: listResult.data });
        }

        if (tool === "trigger-events-get") {
            if (!params?.eventId) {
                return NextResponse.json(
                    { success: false, error: "Missing eventId" },
                    { status: 400 }
                );
            }

            const searchParams = new URLSearchParams();
            if (params?.workspaceId) searchParams.set("workspaceId", String(params.workspaceId));

            const detailUrl = new URL(
                `/api/live/triggers/${params.eventId}?${searchParams.toString()}`,
                getInternalBaseUrl()
            );
            const detailResult = await callInternalApi(detailUrl, "GET");
            if (!detailResult.ok) {
                return NextResponse.json(
                    { success: false, error: detailResult.error },
                    { status: detailResult.status }
                );
            }
            return NextResponse.json({ success: true, result: detailResult.data });
        }

        if (tool === "agent-evaluations-list") {
            if (!params?.agentId) {
                return NextResponse.json(
                    { success: false, error: "Missing agentId" },
                    { status: 400 }
                );
            }
            const searchParams = new URLSearchParams();
            if (params.from) searchParams.set("from", String(params.from));
            if (params.to) searchParams.set("to", String(params.to));
            if (params.limit) searchParams.set("limit", String(params.limit));
            if (params.cursor) searchParams.set("cursor", String(params.cursor));
            if (params.source) searchParams.set("source", String(params.source));

            const listUrl = new URL(
                `/api/agents/${params.agentId}/evaluations?${searchParams.toString()}`,
                getInternalBaseUrl()
            );
            const listResult = await callInternalApi(listUrl, "GET");
            if (!listResult.ok) {
                return NextResponse.json(
                    { success: false, error: listResult.error },
                    { status: listResult.status }
                );
            }
            return NextResponse.json({ success: true, result: listResult.data });
        }

        if (tool === "agent-evaluations-run") {
            if (!params?.agentId) {
                return NextResponse.json(
                    { success: false, error: "Missing agentId" },
                    { status: 400 }
                );
            }
            const payload: Record<string, unknown> = {};
            if (params.limit !== undefined) payload.limit = params.limit;
            if (params.runIds !== undefined) payload.runIds = params.runIds;

            const evalUrl = new URL(
                `/api/agents/${params.agentId}/evaluations`,
                getInternalBaseUrl()
            );
            const evalResult = await callInternalApi(evalUrl, "POST", payload);
            if (!evalResult.ok) {
                return NextResponse.json(
                    { success: false, error: evalResult.error },
                    { status: evalResult.status }
                );
            }
            return NextResponse.json({ success: true, result: evalResult.data });
        }

        if (tool === "agent-versions-list") {
            if (!params?.agentId) {
                return NextResponse.json(
                    { success: false, error: "Missing agentId" },
                    { status: 400 }
                );
            }

            const agent = await prisma.agent.findFirst({
                where: {
                    OR: [{ slug: params.agentId }, { id: params.agentId }],
                    workspace: { organizationId }
                },
                select: { id: true }
            });
            if (!agent) {
                return NextResponse.json(
                    { success: false, error: `Agent not found: ${params.agentId}` },
                    { status: 404 }
                );
            }

            const limit = Math.min(Number(params.limit ?? 20), 100);
            const cursor =
                params.cursor !== undefined && !Number.isNaN(Number(params.cursor))
                    ? Number(params.cursor)
                    : null;

            const versions = await prisma.agentVersion.findMany({
                where: {
                    agentId: agent.id,
                    ...(cursor ? { version: { lt: cursor } } : {})
                },
                orderBy: { version: "desc" },
                take: limit,
                select: {
                    id: true,
                    version: true,
                    description: true,
                    instructions: true,
                    modelProvider: true,
                    modelName: true,
                    changesJson: true,
                    snapshot: true,
                    createdAt: true
                }
            });

            return NextResponse.json({
                success: true,
                result: {
                    versions,
                    nextCursor:
                        versions.length === limit ? versions[versions.length - 1].version : null
                }
            });
        }

        if (tool === "workflow.get-run") {
            if (!params?.workflowSlug || !params?.runId) {
                return NextResponse.json(
                    { success: false, error: "Missing workflowSlug or runId" },
                    { status: 400 }
                );
            }
            const runUrl = new URL(
                `/api/workflows/${params.workflowSlug}/runs/${params.runId}`,
                getInternalBaseUrl()
            );
            const runResponse = await fetch(runUrl, { headers: authHeaders });
            const runResult = await runResponse.json();
            return NextResponse.json({ success: true, result: runResult });
        }

        if (tool === "network-generate") {
            if (!params?.prompt) {
                return NextResponse.json(
                    { success: false, error: "Missing prompt" },
                    { status: 400 }
                );
            }
            const url = new URL("/api/networks/generate", getInternalBaseUrl());
            const result = await callInternalApi(url, "POST", { prompt: params.prompt });
            if (!result.ok) {
                return NextResponse.json(
                    { success: false, error: result.error },
                    { status: result.status }
                );
            }
            return NextResponse.json({ success: true, result: result.data });
        }

        if (tool === "network-validate") {
            if (!params?.topologyJson) {
                return NextResponse.json(
                    { success: false, error: "Missing topologyJson" },
                    { status: 400 }
                );
            }
            const url = new URL("/api/networks/validate", getInternalBaseUrl());
            const result = await callInternalApi(url, "POST", {
                topologyJson: params.topologyJson,
                primitives: params.primitives
            });
            if (!result.ok) {
                return NextResponse.json(
                    { success: false, error: result.error },
                    { status: result.status }
                );
            }
            return NextResponse.json({ success: true, result: result.data });
        }

        if (tool === "network-designer-chat") {
            if (!params?.networkSlug || !params?.prompt || !params?.topologyJson) {
                return NextResponse.json(
                    { success: false, error: "Missing networkSlug, prompt, or topologyJson" },
                    { status: 400 }
                );
            }
            const url = new URL(
                `/api/networks/${params.networkSlug}/designer-chat`,
                getInternalBaseUrl()
            );
            const result = await callInternalApi(url, "POST", {
                prompt: params.prompt,
                topologyJson: params.topologyJson,
                primitives: params.primitives,
                selected: params.selected
            });
            if (!result.ok) {
                return NextResponse.json(
                    { success: false, error: result.error },
                    { status: result.status }
                );
            }
            return NextResponse.json({ success: true, result: result.data });
        }

        if (tool.startsWith("network-")) {
            const networkSlug = tool.slice("network-".length);
            const message = params?.message ?? params?.input;
            if (!message) {
                return NextResponse.json(
                    { success: false, error: "Missing message" },
                    { status: 400 }
                );
            }

            const execUrl = new URL(`/api/networks/${networkSlug}/execute`, getInternalBaseUrl());
            const execResponse = await fetch(execUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders
                },
                body: JSON.stringify({
                    message,
                    source: params.source,
                    environment: params.environment,
                    triggerType: params.triggerType,
                    threadId: params.threadId,
                    resourceId: params.resourceId
                })
            });
            const execResult = await execResponse.json();
            if (!execResponse.ok) {
                return NextResponse.json(
                    { success: false, error: execResult.error || "Network execution failed" },
                    { status: execResponse.status }
                );
            }

            let runDetail = null;
            if (execResult.runId) {
                const runUrl = new URL(
                    `/api/networks/${networkSlug}/runs/${execResult.runId}`,
                    getInternalBaseUrl()
                );
                const runResponse = await fetch(runUrl, { headers: authHeaders });
                runDetail = await runResponse.json();
            }

            return NextResponse.json({
                success: true,
                result: {
                    runId: execResult.runId,
                    outputText: execResult.outputText,
                    outputJson: execResult.outputJson,
                    steps: execResult.steps,
                    run: runDetail?.run || null
                }
            });
        }

        if (tool === "network.list-runs") {
            if (!params?.networkSlug) {
                return NextResponse.json(
                    { success: false, error: "Missing networkSlug" },
                    { status: 400 }
                );
            }
            const searchParams = new URLSearchParams();
            if (params.limit) searchParams.set("limit", String(params.limit));
            if (params.status) searchParams.set("status", params.status);
            if (params.environment) searchParams.set("environment", params.environment);
            if (params.triggerType) searchParams.set("triggerType", params.triggerType);
            if (params.from) searchParams.set("from", params.from);
            if (params.to) searchParams.set("to", params.to);
            if (params.search) searchParams.set("search", params.search);

            const listUrl = new URL(
                `/api/networks/${params.networkSlug}/runs?${searchParams.toString()}`,
                getInternalBaseUrl()
            );
            const listResponse = await fetch(listUrl, { headers: authHeaders });
            const listResult = await listResponse.json();
            return NextResponse.json({ success: true, result: listResult });
        }

        if (tool === "network.get-run") {
            if (!params?.networkSlug || !params?.runId) {
                return NextResponse.json(
                    { success: false, error: "Missing networkSlug or runId" },
                    { status: 400 }
                );
            }
            const runUrl = new URL(
                `/api/networks/${params.networkSlug}/runs/${params.runId}`,
                getInternalBaseUrl()
            );
            const runResponse = await fetch(runUrl, { headers: authHeaders });
            const runResult = await runResponse.json();
            return NextResponse.json({ success: true, result: runResult });
        }

        return NextResponse.json(
            { success: false, error: `Unsupported tool: ${tool}` },
            { status: 400 }
        );
    } catch (error) {
        console.error("[MCP Gateway] Error invoking tool:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to invoke tool"
            },
            { status: 500 }
        );
    }
}
