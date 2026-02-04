import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";

/**
 * MCP Server Gateway
 *
 * Exposes all agents as MCP tools that can be invoked by external MCP clients.
 * This implements the inbound MCP gateway pattern where each agent becomes
 * a callable service.
 *
 * Protocol: Simplified MCP-like JSON-RPC
 *
 * Endpoints:
 * - GET /api/mcp - List available tools (agents)
 * - POST /api/mcp - Invoke a tool (agent)
 */

/**
 * GET /api/mcp
 *
 * Lists all agents as MCP tools.
 * Returns tool definitions with metadata for discovery.
 */
export async function GET(request: NextRequest) {
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
                ...workflowOpsTools,
                ...networkOpsTools
            ],
            total:
                tools.length +
                workflowTools.length +
                networkTools.length +
                workflowOpsTools.length +
                networkOpsTools.length
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

            const invokeUrl = new URL(`/api/agents/${agentSlug}/invoke`, request.url);
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

            const execUrl = new URL(`/api/workflows/${params.workflowSlug}/execute`, request.url);
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
                    request.url
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

            const execUrl = new URL(`/api/networks/${params.networkSlug}/execute`, request.url);
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
                    request.url
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

            const execUrl = new URL(`/api/workflows/${workflowSlug}/execute`, request.url);
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
                    request.url
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
                request.url
            );
            const listResponse = await fetch(listUrl, { headers: authHeaders });
            const listResult = await listResponse.json();
            return NextResponse.json({ success: true, result: listResult });
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
                request.url
            );
            const runResponse = await fetch(runUrl, { headers: authHeaders });
            const runResult = await runResponse.json();
            return NextResponse.json({ success: true, result: runResult });
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

            const execUrl = new URL(`/api/networks/${networkSlug}/execute`, request.url);
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
                    request.url
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
                request.url
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
                request.url
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
