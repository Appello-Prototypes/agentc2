import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";

/**
 * GET /api/mcp/tools/[tool]
 *
 * Get detailed information about a specific agent tool.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const { tool } = await params;

        const normalizeSchema = (
            schema: unknown,
            fallback: Record<string, unknown>
        ): Record<string, unknown> => {
            if (schema && typeof schema === "object" && !Array.isArray(schema)) {
                return schema as Record<string, unknown>;
            }
            return fallback;
        };

        const crudToolDetails: Record<
            string,
            {
                description: string;
                inputSchema: Record<string, unknown>;
                outputSchema: Record<string, unknown>;
            }
        > = {
            agent_schedule_create: {
                description: "Create a schedule for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_schedule_list: {
                description: "List schedules for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_schedule_update: {
                description: "Update a schedule for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_schedule_delete: {
                description: "Delete a schedule for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_create: {
                description: "Create a trigger for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_list: {
                description: "List triggers for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_update: {
                description: "Update a trigger for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_delete: {
                description: "Delete a trigger for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_unified_list: {
                description: "List unified execution triggers for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_unified_get: {
                description: "Get a unified execution trigger.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_unified_create: {
                description: "Create a unified execution trigger.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_unified_update: {
                description: "Update a unified execution trigger.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_unified_delete: {
                description: "Delete a unified execution trigger.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_unified_enable: {
                description: "Enable a unified execution trigger.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_unified_disable: {
                description: "Disable a unified execution trigger.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_test: {
                description: "Dry-run a unified trigger.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            agent_trigger_execute: {
                description: "Execute a unified trigger.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "agent-create": {
                description: "Create a new agent with full configuration.",
                inputSchema: {
                    type: "object",
                    description:
                        "See docs/mcp-crud-tools-spec.json for full schema. Supports all agent configuration primitives.",
                    additionalProperties: true
                },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "agent-read": {
                description: "Retrieve agent definition/state by ID or slug.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "agent-update": {
                description: "Update an agent configuration with versioning and rollback support.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "agent-delete": {
                description: "Delete or archive an agent safely.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "workflow-create": {
                description: "Create a workflow definition with full configuration.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "workflow-read": {
                description: "Retrieve a workflow definition/state by ID or slug.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "workflow-update": {
                description: "Update a workflow definition with versioning and rollback support.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "workflow-delete": {
                description: "Delete or archive a workflow safely.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "workflow-generate": {
                description: "Generate a workflow definition from a prompt.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "workflow-validate": {
                description: "Validate a workflow definition.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "workflow-designer-chat": {
                description: "Generate a JSON Patch proposal for workflow updates.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "network-create": {
                description: "Create a network with routing instructions and primitives.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "network-read": {
                description: "Retrieve a network definition/state by ID or slug.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "network-update": {
                description:
                    "Update a network topology or routing config with versioning and rollback support.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "network-delete": {
                description: "Delete or archive a network safely.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "network-generate": {
                description: "Generate a network topology from a prompt.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "network-validate": {
                description: "Validate a network topology and primitives.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "network-designer-chat": {
                description: "Generate a JSON Patch proposal for network updates.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "agent-runs-list": {
                description: "List agent runs with filters and time range.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "agent-runs-get": {
                description: "Fetch an agent run with trace, evaluation, and version.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "trigger-events-list": {
                description: "List trigger monitoring events with filters and time range.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "trigger-events-get": {
                description: "Fetch a trigger monitoring event detail.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "agent-evaluations-list": {
                description: "List evaluations for an agent with trends and insights.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "agent-evaluations-run": {
                description: "Run evaluations on unevaluated runs for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            },
            "agent-versions-list": {
                description: "List version history for an agent.",
                inputSchema: { type: "object", additionalProperties: true },
                outputSchema: { type: "object", additionalProperties: true }
            }
        };

        if (crudToolDetails[tool]) {
            const definition = crudToolDetails[tool];
            return NextResponse.json({
                success: true,
                tool: {
                    name: tool,
                    description: definition.description,
                    version: "1.0.0",
                    metadata: {
                        tool_type: "crud",
                        schema_ref: "docs/mcp-crud-tools-spec.json"
                    },
                    inputSchema: definition.inputSchema,
                    outputSchema: definition.outputSchema,
                    invoke_url: "/api/mcp"
                }
            });
        }

        if (tool.startsWith("workflow-")) {
            const workflowSlug = tool.slice("workflow-".length);
            const workflow = await prisma.workflow.findFirst({
                where: {
                    OR: [{ slug: workflowSlug }, { id: workflowSlug }],
                    workspace: { organizationId }
                },
                include: {
                    workspace: {
                        include: {
                            organization: {
                                select: { slug: true, name: true }
                            }
                        }
                    }
                }
            });

            if (!workflow) {
                return NextResponse.json(
                    { success: false, error: `Tool not found: ${tool}` },
                    { status: 404 }
                );
            }

            const inputSchema = normalizeSchema(workflow.inputSchemaJson, {
                type: "object",
                properties: {
                    input: { type: "object", description: "Workflow input payload" },
                    source: { type: "string", description: "Source channel" },
                    environment: { type: "string", description: "Environment" },
                    triggerType: { type: "string", description: "Trigger type" },
                    requestContext: { type: "object", description: "Optional request context" }
                },
                required: ["input"]
            });
            const outputSchema = normalizeSchema(workflow.outputSchemaJson, {
                type: "object",
                properties: {
                    runId: { type: "string" },
                    status: { type: "string" },
                    output: { type: "object" },
                    error: { type: "string" }
                }
            });

            return NextResponse.json({
                success: true,
                tool: {
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
                    inputSchema,
                    outputSchema,
                    invoke_url: `/api/workflows/${workflow.slug}/execute`,
                    created_at: workflow.createdAt,
                    updated_at: workflow.updatedAt
                }
            });
        }

        if (tool.startsWith("network-")) {
            const networkSlug = tool.slice("network-".length);
            const network = await prisma.network.findFirst({
                where: {
                    OR: [{ slug: networkSlug }, { id: networkSlug }],
                    workspace: { organizationId }
                },
                include: {
                    workspace: {
                        include: {
                            organization: {
                                select: { slug: true, name: true }
                            }
                        }
                    }
                }
            });

            if (!network) {
                return NextResponse.json(
                    { success: false, error: `Tool not found: ${tool}` },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                tool: {
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
                    inputSchema: {
                        type: "object",
                        properties: {
                            message: { type: "string", description: "Message to route" },
                            input: { type: "string", description: "Alias for message" },
                            source: { type: "string", description: "Source channel" },
                            environment: { type: "string", description: "Environment" },
                            triggerType: { type: "string", description: "Trigger type" },
                            threadId: { type: "string", description: "Optional thread ID" },
                            resourceId: { type: "string", description: "Optional resource ID" }
                        },
                        required: ["message"]
                    },
                    outputSchema: {
                        type: "object",
                        properties: {
                            runId: { type: "string" },
                            outputText: { type: "string" },
                            outputJson: { type: "object" },
                            steps: { type: "number" }
                        }
                    },
                    invoke_url: `/api/networks/${network.slug}/execute`,
                    created_at: network.createdAt,
                    updated_at: network.updatedAt
                }
            });
        }

        // Parse tool name (format: agent.slug or just slug)
        const agentSlug = tool.startsWith("agent.") ? tool.slice(6) : tool;

        // Find agent
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: agentSlug }, { id: agentSlug }],
                workspace: { organizationId }
            },
            include: {
                tools: true,
                workspace: {
                    include: {
                        organization: {
                            select: { slug: true, name: true }
                        }
                    }
                }
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Tool not found: ${tool}` },
                { status: 404 }
            );
        }

        // Build tool definition
        const toolDef = {
            name: `agent.${agent.slug}`,
            description: agent.description || `Agent: ${agent.name}`,
            version: agent.version.toString(),
            metadata: {
                agent_id: agent.id,
                agent_slug: agent.slug,
                agent_name: agent.name,
                model: `${agent.modelProvider}/${agent.modelName}`,
                temperature: agent.temperature,
                is_active: agent.isActive,
                is_public: agent.isPublic,
                requires_approval: agent.requiresApproval,
                max_steps: agent.maxSteps,
                memory_enabled: agent.memoryEnabled,
                scorers: agent.scorers,
                workspace: agent.workspace?.slug,
                environment: agent.workspace?.environment,
                organization: agent.workspace?.organization?.slug,
                tools_count: agent.tools.length,
                tool_ids: agent.tools.map((t) => t.toolId)
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
                        additionalProperties: true,
                        properties: {
                            userId: {
                                type: "string",
                                description: "User ID for memory and personalization"
                            },
                            threadId: {
                                type: "string",
                                description: "Thread ID for conversation context"
                            },
                            sessionId: {
                                type: "string",
                                description: "Session ID for channel tracking"
                            }
                        }
                    },
                    maxSteps: {
                        type: "number",
                        description: `Maximum tool-use steps (default: ${agent.maxSteps || 5})`
                    },
                    mode: {
                        type: "string",
                        enum: ["sync", "async"],
                        description: "Execution mode (default: sync)"
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
            invoke_url: `/api/agents/${agent.slug}/invoke`,
            created_at: agent.createdAt,
            updated_at: agent.updatedAt
        };

        return NextResponse.json({
            success: true,
            tool: toolDef
        });
    } catch (error) {
        console.error("[MCP Gateway] Error getting tool:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get tool"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/mcp/tools/[tool]
 *
 * Invoke a specific agent tool directly.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ tool: string }> }
) {
    try {
        const { tool } = await params;
        const body = await request.json();

        if (tool.startsWith("workflow-")) {
            const workflowSlug = tool.slice("workflow-".length);
            const invokeUrl = new URL(`/api/workflows/${workflowSlug}/execute`, request.url);
            const invokeResponse = await fetch(invokeUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(request.headers.get("authorization")
                        ? { Authorization: request.headers.get("authorization")! }
                        : {})
                },
                body: JSON.stringify({
                    input: body.input,
                    source: body.source,
                    environment: body.environment,
                    triggerType: body.triggerType,
                    requestContext: body.requestContext
                })
            });

            const result = await invokeResponse.json();
            return NextResponse.json(result, { status: invokeResponse.status });
        }

        if (tool.startsWith("network-")) {
            const networkSlug = tool.slice("network-".length);
            const invokeUrl = new URL(`/api/networks/${networkSlug}/execute`, request.url);
            const invokeResponse = await fetch(invokeUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(request.headers.get("authorization")
                        ? { Authorization: request.headers.get("authorization")! }
                        : {})
                },
                body: JSON.stringify({
                    message: body.message ?? body.input,
                    source: body.source,
                    environment: body.environment,
                    triggerType: body.triggerType,
                    threadId: body.threadId,
                    resourceId: body.resourceId
                })
            });

            const result = await invokeResponse.json();
            return NextResponse.json(result, { status: invokeResponse.status });
        }

        // Parse tool name
        const agentSlug = tool.startsWith("agent.") ? tool.slice(6) : tool;

        // Forward to invoke endpoint
        const invokeUrl = new URL(`/api/agents/${agentSlug}/invoke`, request.url);

        const invokeResponse = await fetch(invokeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(request.headers.get("authorization")
                    ? { Authorization: request.headers.get("authorization")! }
                    : {})
            },
            body: JSON.stringify({
                input: body.input,
                context: body.context,
                maxSteps: body.maxSteps,
                mode: body.mode || "sync"
            })
        });

        const result = await invokeResponse.json();
        return NextResponse.json(result, { status: invokeResponse.status });
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
