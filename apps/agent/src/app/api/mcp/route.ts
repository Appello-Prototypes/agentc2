import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { getToolByName, mcpToolDefinitions, mcpToolRoutes } from "@repo/agentc2/tools";
import { auth } from "@repo/auth";
import { getDefaultWorkspaceIdForUser, getUserOrganizationId } from "@/lib/organization";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit-policy";
import { resolveRequiredToolAccess, type AccessLevel } from "@/lib/security/access-matrix";
import { validateAccessToken } from "@/lib/mcp-oauth";
import { enforceCsrf, getCorsHeaders } from "@/lib/security/http-security";

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
        const oauthToken = validateAccessToken(apiKey);
        if (oauthToken) {
            const membership = await prisma.membership.findFirst({
                where: { organizationId: oauthToken.organizationId },
                select: { userId: true }
            });
            if (membership) {
                return { userId: membership.userId, organizationId: oauthToken.organizationId };
            }
        }

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

async function hasRequiredToolAccess(
    userId: string,
    organizationId: string,
    requiredAccess: AccessLevel
): Promise<boolean> {
    if (requiredAccess === "public") return true;
    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId
            }
        },
        select: { role: true }
    });
    if (!membership) {
        // Organization context is already resolved by authentication; allow baseline member-level
        // access, but keep admin/owner operations denied without an explicit membership role.
        return requiredAccess === "authenticated" || requiredAccess === "member";
    }
    if (requiredAccess === "authenticated" || requiredAccess === "member") return true;
    if (requiredAccess === "admin") {
        return membership.role === "admin" || membership.role === "owner";
    }
    if (requiredAccess === "owner") {
        return membership.role === "owner";
    }
    return false;
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
                visibility: true,
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
                visibility: agent.visibility,
                is_public: agent.visibility === "PUBLIC",
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
        const staticTools = mcpToolDefinitions.map((tool) => ({
            ...tool,
            invoke_url: tool.invoke_url || "/api/mcp"
        }));

        // Generate per-instance tools for multi-instance agents
        const instances = await prisma.agentInstance.findMany({
            where: {
                isActive: true,
                organization: { id: organizationId }
            },
            select: {
                id: true,
                slug: true,
                name: true,
                contextType: true,
                contextId: true,
                instructionOverrides: true,
                agent: {
                    select: {
                        slug: true,
                        name: true,
                        description: true,
                        modelProvider: true,
                        modelName: true
                    }
                }
            },
            orderBy: { name: "asc" }
        });

        const instanceTools = instances.map((inst) => ({
            name: `instance.${inst.slug}`,
            description:
                `${inst.name} — instance of ${inst.agent.name}. ` +
                (inst.contextType
                    ? `Context: ${inst.contextType}${inst.contextId ? ` (${inst.contextId})` : ""}. `
                    : "") +
                (inst.agent.description || ""),
            metadata: {
                instance_id: inst.id,
                instance_slug: inst.slug,
                instance_name: inst.name,
                agent_slug: inst.agent.slug,
                agent_name: inst.agent.name,
                model: `${inst.agent.modelProvider}/${inst.agent.modelName}`,
                context_type: inst.contextType,
                context_id: inst.contextId,
                has_instruction_overrides: !!inst.instructionOverrides
            },
            inputSchema: {
                type: "object",
                properties: {
                    input: {
                        type: "string",
                        description: `Message or task for ${inst.name}`
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
            invoke_url: `/api/agents/${inst.agent.slug}/invoke`
        }));

        const allTools = [
            ...tools,
            ...instanceTools,
            ...workflowTools,
            ...networkTools,
            ...staticTools
        ];

        return NextResponse.json({
            success: true,
            protocol: "mcp-agent-gateway/1.0",
            server_info: {
                name: "mastra-agent-gateway",
                version: "1.0.0",
                capabilities: ["tools", "invoke"]
            },
            tools: allTools,
            total: allTools.length
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
        const csrf = enforceCsrf(request);
        if (csrf.response) {
            return csrf.response;
        }

        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { userId, organizationId } = authResult;
        const rate = await checkRateLimit(
            `mcp:${organizationId}:${userId}`,
            RATE_LIMIT_POLICIES.mcp
        );
        if (!rate.allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded" },
                { status: 429 }
            );
        }

        const body = await request.json();
        if (!body || typeof body !== "object") {
            return NextResponse.json(
                { success: false, error: "Invalid request payload" },
                { status: 400 }
            );
        }
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

        const requiredAccess = resolveRequiredToolAccess(tool);
        const canUseTool = await hasRequiredToolAccess(userId, organizationId, requiredAccess);
        if (!canUseTool) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions for tool" },
                { status: 403 }
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
        const resolveWorkflowInput = (inputParams?: Record<string, unknown>) => {
            if (!inputParams) return null;
            if (inputParams.input !== undefined) return inputParams.input;
            if (inputParams.inputData !== undefined) return inputParams.inputData;
            const sanitized = { ...inputParams };
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

        const callInternalApi = async (
            url: URL,
            method: string,
            body?: Record<string, unknown>,
            options?: { expectSuccess?: boolean }
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
            const expectSuccess = options?.expectSuccess ?? true;
            if (!response.ok || (expectSuccess && !data.success)) {
                return {
                    ok: false,
                    status: response.status,
                    error: data.error || "Request failed"
                };
            }

            return { ok: true, data };
        };

        type McpToolRoute = (typeof mcpToolRoutes)[number];
        type ToolHandler = (params: Record<string, unknown> | undefined) => Promise<NextResponse>;

        const normalizeParams = (input: unknown) =>
            input && typeof input === "object" ? (input as Record<string, unknown>) : {};

        const buildInternalHandler = (route: Extract<McpToolRoute, { kind: "internal" }>) => {
            return async (inputParams: Record<string, unknown> | undefined) => {
                const scopedParams = normalizeParams(inputParams);
                let resolvedPath = route.path;

                for (const key of route.pathParams ?? []) {
                    const value = scopedParams[key];
                    if (value === undefined || value === null || value === "") {
                        return NextResponse.json(
                            { success: false, error: `Missing ${key}` },
                            { status: 400 }
                        );
                    }
                    const encoded = encodeURIComponent(String(value));
                    resolvedPath = resolvedPath
                        .replace(`{${key}}`, encoded)
                        .replace(`:${key}`, encoded);
                }

                const url = new URL(resolvedPath, getInternalBaseUrl());
                for (const key of route.queryParams ?? []) {
                    const value = scopedParams[key];
                    if (value !== undefined && value !== null) {
                        url.searchParams.set(key, String(value));
                    }
                }

                const isReadOnly = route.method === "GET" || route.method === "DELETE";
                let payload: Record<string, unknown> | undefined;
                if (!isReadOnly) {
                    const basePayload = route.staticBody ? { ...route.staticBody } : {};
                    if (route.bodyParams) {
                        for (const key of route.bodyParams) {
                            if (scopedParams[key] !== undefined) {
                                basePayload[key] = scopedParams[key];
                            }
                        }
                    } else {
                        const excluded = new Set([
                            ...(route.pathParams ?? []),
                            ...(route.queryParams ?? [])
                        ]);
                        for (const [key, value] of Object.entries(scopedParams)) {
                            if (!excluded.has(key)) {
                                basePayload[key] = value;
                            }
                        }
                    }
                    payload = Object.keys(basePayload).length > 0 ? basePayload : undefined;
                }

                const result = await callInternalApi(url, route.method, payload, {
                    expectSuccess: route.expectSuccess
                });
                if (!result.ok) {
                    return NextResponse.json(
                        { success: false, error: result.error },
                        { status: result.status }
                    );
                }
                return NextResponse.json({ success: true, result: result.data });
            };
        };

        const buildRegistryHandler = (route: Extract<McpToolRoute, { kind: "registry" }>) => {
            return async (inputParams: Record<string, unknown> | undefined) => {
                const registryTool = getToolByName(route.name);
                if (!registryTool || typeof registryTool.execute !== "function") {
                    return NextResponse.json(
                        { success: false, error: `Tool not found: ${route.name}` },
                        { status: 404 }
                    );
                }

                const scopedParams = normalizeParams(inputParams);
                if (
                    route.injectOrg &&
                    organizationId &&
                    scopedParams.organizationId === undefined
                ) {
                    scopedParams.organizationId = organizationId;
                }
                if (route.injectUser && userId && scopedParams.userId === undefined) {
                    scopedParams.userId = userId;
                }

                if (route.applyDefaults) {
                    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
                    if (route.name.startsWith("agent-")) {
                        if (organizationId && scopedParams.tenantId === undefined) {
                            scopedParams.tenantId = organizationId;
                        }
                    }
                    if (workspaceId && scopedParams.workspaceId === undefined) {
                        scopedParams.workspaceId = workspaceId;
                    }
                    if (scopedParams.ownerId === undefined) {
                        scopedParams.ownerId = userId;
                    }
                }

                try {
                    const toolInputSchema = (
                        registryTool as {
                            inputSchema?: {
                                safeParse?: (v: unknown) => {
                                    success: boolean;
                                    error?: {
                                        issues?: Array<{
                                            path: Array<string | number>;
                                            message: string;
                                        }>;
                                    };
                                    data?: unknown;
                                };
                            };
                        }
                    ).inputSchema;
                    if (toolInputSchema?.safeParse) {
                        const parsed = toolInputSchema.safeParse(scopedParams);
                        if (!parsed.success) {
                            return NextResponse.json(
                                {
                                    success: false,
                                    error: "Invalid tool params",
                                    issues:
                                        parsed.error?.issues?.map((issue) => ({
                                            path: issue.path.join("."),
                                            message: issue.message
                                        })) || []
                                },
                                { status: 400 }
                            );
                        }
                    }
                    const result = await registryTool.execute(scopedParams);
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
            };
        };

        const customHandlers: Record<
            "workflowExecute" | "networkExecute" | "agentVersionsList",
            ToolHandler
        > = {
            workflowExecute: async (inputParams) => {
                const scopedParams = normalizeParams(inputParams);
                const resolvedInput = resolveWorkflowInput(scopedParams);
                if (!scopedParams.workflowSlug || resolvedInput === null) {
                    return NextResponse.json(
                        { success: false, error: "Missing workflowSlug or input" },
                        { status: 400 }
                    );
                }

                const workflowSlug = String(scopedParams.workflowSlug);
                const workflow = await prisma.workflow.findFirst({
                    where: {
                        OR: [{ slug: workflowSlug }, { id: workflowSlug }],
                        workspace: { organizationId }
                    },
                    select: { id: true }
                });
                if (!workflow) {
                    return NextResponse.json(
                        { success: false, error: `Workflow not found: ${workflowSlug}` },
                        { status: 404 }
                    );
                }

                const execUrl = new URL(
                    `/api/workflows/${workflowSlug}/execute`,
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
                        source: scopedParams.source,
                        environment: scopedParams.environment,
                        triggerType: scopedParams.triggerType,
                        requestContext: scopedParams.requestContext
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
            },
            networkExecute: async (inputParams) => {
                const scopedParams = normalizeParams(inputParams);
                if (!scopedParams.networkSlug || !scopedParams.message) {
                    return NextResponse.json(
                        { success: false, error: "Missing networkSlug or message" },
                        { status: 400 }
                    );
                }

                const networkSlug = String(scopedParams.networkSlug);
                const network = await prisma.network.findFirst({
                    where: {
                        OR: [{ slug: networkSlug }, { id: networkSlug }],
                        workspace: { organizationId }
                    },
                    select: { id: true }
                });
                if (!network) {
                    return NextResponse.json(
                        { success: false, error: `Network not found: ${networkSlug}` },
                        { status: 404 }
                    );
                }

                const execUrl = new URL(
                    `/api/networks/${networkSlug}/execute`,
                    getInternalBaseUrl()
                );
                const execResponse = await fetch(execUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...authHeaders
                    },
                    body: JSON.stringify({
                        message: scopedParams.message,
                        source: scopedParams.source,
                        environment: scopedParams.environment,
                        triggerType: scopedParams.triggerType,
                        threadId: scopedParams.threadId,
                        resourceId: scopedParams.resourceId
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
            },
            agentVersionsList: async (inputParams) => {
                const scopedParams = normalizeParams(inputParams);
                if (!scopedParams.agentId) {
                    return NextResponse.json(
                        { success: false, error: "Missing agentId" },
                        { status: 400 }
                    );
                }

                const agentId = String(scopedParams.agentId);
                const agent = await prisma.agent.findFirst({
                    where: {
                        OR: [{ slug: agentId }, { id: agentId }],
                        workspace: { organizationId }
                    },
                    select: { id: true }
                });
                if (!agent) {
                    return NextResponse.json(
                        { success: false, error: `Agent not found: ${agentId}` },
                        { status: 404 }
                    );
                }

                const limit = Math.min(Number(scopedParams.limit ?? 20), 100);
                const cursor =
                    scopedParams.cursor !== undefined && !Number.isNaN(Number(scopedParams.cursor))
                        ? Number(scopedParams.cursor)
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
        };

        const toolHandlers = new Map<string, ToolHandler>();
        for (const route of mcpToolRoutes) {
            if (route.kind === "internal") {
                toolHandlers.set(route.name, buildInternalHandler(route));
            } else if (route.kind === "registry") {
                toolHandlers.set(route.name, buildRegistryHandler(route));
            } else if (route.kind === "custom") {
                const handler = customHandlers[route.handler];
                if (handler) {
                    toolHandlers.set(route.name, handler);
                }
            }
        }

        const resolvedHandler = toolHandlers.get(tool);
        if (resolvedHandler) {
            return resolvedHandler(params);
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

        if (tool.startsWith("instance.")) {
            const instanceSlug = tool.slice("instance.".length);
            if (!params?.input) {
                return NextResponse.json(
                    { success: false, error: "Missing params.input" },
                    { status: 400 }
                );
            }

            const instance = await prisma.agentInstance.findFirst({
                where: {
                    slug: instanceSlug,
                    isActive: true,
                    organization: { id: organizationId }
                },
                select: {
                    id: true,
                    agent: { select: { slug: true } }
                }
            });
            if (!instance) {
                return NextResponse.json(
                    { success: false, error: `Instance not found: ${instanceSlug}` },
                    { status: 404 }
                );
            }

            const invokeUrl = new URL(
                `/api/agents/${instance.agent.slug}/invoke`,
                getInternalBaseUrl()
            );
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
                    instanceId: instance.id,
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
                    model: result.model,
                    instance_slug: instanceSlug,
                    instance_id: instance.id
                }
            });
        }

        if (tool.startsWith("workflow-")) {
            const workflowSlug = tool.slice("workflow-".length);
            const resolvedInput = resolveWorkflowInput(normalizeParams(params));
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

export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get("origin");
    return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin)
    });
}
