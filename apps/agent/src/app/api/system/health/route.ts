import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";
import { testMcpServer } from "@repo/agentc2/mcp";
import { agentResolver } from "@repo/agentc2/agents";
import { resolveModelForOrg, getOrgApiKey } from "@repo/agentc2/agents";
import { generateText } from "ai";
import {
    getConnectionMissingFields,
    getConnectionCredentials,
    resolveConnectionServerId,
    computeEffectiveDefault
} from "@/lib/integrations";

const VALID_LAYERS = [
    "infrastructure",
    "connections",
    "tools",
    "models",
    "skills",
    "agents",
    "workflows",
    "networks"
] as const;

type LayerName = (typeof VALID_LAYERS)[number];

type ComponentResult = {
    id: string;
    name: string;
    status: "ok" | "error" | "skipped" | "warning";
    latencyMs: number | null;
    detail: string | null;
    error: string | null;
    metadata?: Record<string, unknown>;
};

type LayerResult = {
    layer: LayerName;
    status: "ok" | "error" | "degraded" | "skipped";
    components: ComponentResult[];
    testedAt: string;
};

const appStartTime = Date.now();

async function testInfrastructure(): Promise<LayerResult> {
    const components: ComponentResult[] = [];

    const dbStart = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        components.push({
            id: "database",
            name: "PostgreSQL",
            status: "ok",
            latencyMs: Date.now() - dbStart,
            detail: "Connected",
            error: null
        });
    } catch (err) {
        components.push({
            id: "database",
            name: "PostgreSQL",
            status: "error",
            latencyMs: Date.now() - dbStart,
            detail: null,
            error: err instanceof Error ? err.message : "Database unreachable"
        });
    }

    components.push({
        id: "auth",
        name: "Authentication",
        status: "ok",
        latencyMs: null,
        detail: "Session valid (authenticated to reach this endpoint)",
        error: null
    });

    const memUsage = process.memoryUsage();
    components.push({
        id: "system",
        name: "Runtime",
        status: "ok",
        latencyMs: null,
        detail: `Node ${process.version}, PID ${process.pid}`,
        error: null,
        metadata: {
            uptimeSeconds: Math.floor((Date.now() - appStartTime) / 1000),
            memoryMB: {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
            }
        }
    });

    return buildLayerResult("infrastructure", components);
}

async function testConnections(organizationId: string, userId: string): Promise<LayerResult> {
    const connections = await prisma.integrationConnection.findMany({
        where: { organizationId, isActive: true },
        include: { provider: true },
        orderBy: { provider: { category: "asc" } }
    });

    if (connections.length === 0) {
        return {
            layer: "connections",
            status: "skipped",
            components: [
                {
                    id: "none",
                    name: "No Connections",
                    status: "skipped",
                    latencyMs: null,
                    detail: "No active integration connections configured",
                    error: null
                }
            ],
            testedAt: new Date().toISOString()
        };
    }

    const results = await Promise.allSettled(
        connections.map(async (conn) => {
            const start = Date.now();
            const providerKey = conn.provider.key;
            const providerType = conn.provider.providerType;

            const missingFields = getConnectionMissingFields(conn, conn.provider);
            if (missingFields.length > 0) {
                return {
                    id: conn.id,
                    name: conn.name || conn.provider.name,
                    status: "error" as const,
                    latencyMs: Date.now() - start,
                    detail: null,
                    error: `Missing credentials: ${missingFields.join(", ")}`,
                    metadata: {
                        providerKey,
                        providerType,
                        category: conn.provider.category
                    }
                };
            }

            if (providerType === "mcp" || providerType === "custom") {
                try {
                    const isEffectiveDefault = await computeEffectiveDefault(conn, providerKey);
                    const serverId = resolveConnectionServerId(
                        providerKey,
                        conn,
                        isEffectiveDefault
                    );
                    const timeoutMs = providerKey === "atlas" ? 60000 : 15000;
                    const testResult = await testMcpServer({
                        serverId,
                        organizationId,
                        userId,
                        allowEnvFallback: false,
                        timeoutMs
                    });
                    return {
                        id: conn.id,
                        name: conn.name || conn.provider.name,
                        status: testResult.success ? ("ok" as const) : ("error" as const),
                        latencyMs: testResult.totalMs ?? Date.now() - start,
                        detail: testResult.success
                            ? `${testResult.toolCount ?? 0} tools available`
                            : null,
                        error: testResult.success
                            ? null
                            : (testResult.phases.find((p) => p.status === "fail")?.detail ??
                              "Connection test failed"),
                        metadata: {
                            providerKey,
                            providerType,
                            category: conn.provider.category,
                            toolCount: testResult.toolCount
                        }
                    };
                } catch (err) {
                    return {
                        id: conn.id,
                        name: conn.name || conn.provider.name,
                        status: "error" as const,
                        latencyMs: Date.now() - start,
                        detail: null,
                        error: err instanceof Error ? err.message : "Test failed",
                        metadata: {
                            providerKey,
                            providerType,
                            category: conn.provider.category
                        }
                    };
                }
            }

            if (conn.provider.authType === "oauth") {
                const credentials = getConnectionCredentials(conn);
                const connected = Boolean(
                    credentials.accessToken || credentials.refreshToken || credentials.oauthToken
                );
                return {
                    id: conn.id,
                    name: conn.name || conn.provider.name,
                    status: connected ? ("ok" as const) : ("error" as const),
                    latencyMs: Date.now() - start,
                    detail: connected ? "OAuth tokens present" : null,
                    error: connected ? null : "OAuth credentials missing",
                    metadata: {
                        providerKey,
                        providerType,
                        category: conn.provider.category
                    }
                };
            }

            return {
                id: conn.id,
                name: conn.name || conn.provider.name,
                status: "ok" as const,
                latencyMs: Date.now() - start,
                detail: "Credentials present",
                error: null,
                metadata: {
                    providerKey,
                    providerType,
                    category: conn.provider.category
                }
            };
        })
    );

    const components: ComponentResult[] = results.map((settled, idx) => {
        if (settled.status === "fulfilled") return settled.value;
        return {
            id: connections[idx]!.id,
            name: connections[idx]!.name || connections[idx]!.provider.name,
            status: "error" as const,
            latencyMs: null,
            detail: null,
            error: settled.reason instanceof Error ? settled.reason.message : "Unknown error"
        };
    });

    return buildLayerResult("connections", components);
}

async function testTools(organizationId: string): Promise<LayerResult> {
    const components: ComponentResult[] = [];

    const { toolRegistry } = await import("@repo/agentc2/tools");
    const nativeToolCount = Object.keys(toolRegistry).length;
    components.push({
        id: "native-tools",
        name: "Native Tools",
        status: "ok",
        latencyMs: null,
        detail: `${nativeToolCount} tools registered`,
        error: null,
        metadata: { count: nativeToolCount }
    });

    const mcpStart = Date.now();
    try {
        const { listMcpToolDefinitions } = await import("@repo/agentc2/mcp");
        const { definitions, serverErrors } = await listMcpToolDefinitions(organizationId);

        const errorCount = Object.keys(serverErrors).length;
        components.push({
            id: "mcp-tools",
            name: "MCP Tools",
            status: errorCount > 0 ? "warning" : "ok",
            latencyMs: Date.now() - mcpStart,
            detail: `${definitions.length} tools from MCP servers`,
            error:
                errorCount > 0
                    ? `${errorCount} server(s) failed to load: ${Object.entries(serverErrors)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join("; ")}`
                    : null,
            metadata: {
                count: definitions.length,
                serverErrors
            }
        });
    } catch (err) {
        components.push({
            id: "mcp-tools",
            name: "MCP Tools",
            status: "error",
            latencyMs: Date.now() - mcpStart,
            detail: null,
            error: err instanceof Error ? err.message : "Failed to load MCP tools"
        });
    }

    return buildLayerResult("tools", components);
}

const DEFAULT_MODELS: Record<string, string> = {
    openai: "gpt-4o-mini",
    anthropic: "claude-sonnet-4-20250514",
    google: "gemini-2.0-flash"
};

async function testModels(organizationId: string): Promise<LayerResult> {
    const aiConnections = await prisma.integrationConnection.findMany({
        where: {
            organizationId,
            isActive: true,
            provider: { providerType: "ai-model" }
        },
        include: { provider: true }
    });

    if (aiConnections.length === 0) {
        return {
            layer: "models",
            status: "skipped",
            components: [
                {
                    id: "none",
                    name: "No AI Providers",
                    status: "skipped",
                    latencyMs: null,
                    detail: "No AI model providers configured",
                    error: null
                }
            ],
            testedAt: new Date().toISOString()
        };
    }

    const results = await Promise.allSettled(
        aiConnections.map(async (conn) => {
            const providerKey = conn.provider.key;
            const modelId = DEFAULT_MODELS[providerKey] || "default";
            const start = Date.now();

            const hasKey = await getOrgApiKey(providerKey, organizationId);
            if (!hasKey) {
                return {
                    id: conn.id,
                    name: conn.name || conn.provider.name,
                    status: "skipped" as const,
                    latencyMs: null,
                    detail: null,
                    error: `No API key configured for ${providerKey}`,
                    metadata: { providerKey }
                };
            }

            try {
                const model = await resolveModelForOrg(providerKey, modelId, organizationId);
                if (!model) {
                    return {
                        id: conn.id,
                        name: conn.name || conn.provider.name,
                        status: "error" as const,
                        latencyMs: Date.now() - start,
                        detail: null,
                        error: `Could not resolve model ${providerKey}/${modelId}`,
                        metadata: { providerKey, modelId }
                    };
                }

                const result = await generateText({
                    model,
                    prompt: "Say hello in exactly 3 words.",
                    maxRetries: 1
                });
                return {
                    id: conn.id,
                    name: conn.name || conn.provider.name,
                    status: "ok" as const,
                    latencyMs: Date.now() - start,
                    detail: `${providerKey}/${modelId}: "${result.text.slice(0, 80)}"`,
                    error: null,
                    metadata: { providerKey, modelId }
                };
            } catch (err) {
                return {
                    id: conn.id,
                    name: conn.name || conn.provider.name,
                    status: "error" as const,
                    latencyMs: Date.now() - start,
                    detail: null,
                    error: err instanceof Error ? err.message : String(err),
                    metadata: { providerKey, modelId }
                };
            }
        })
    );

    const components: ComponentResult[] = results.map((settled, idx) => {
        if (settled.status === "fulfilled") return settled.value;
        return {
            id: aiConnections[idx]!.id,
            name: aiConnections[idx]!.name || aiConnections[idx]!.provider.name,
            status: "error" as const,
            latencyMs: null,
            detail: null,
            error: settled.reason instanceof Error ? settled.reason.message : "Unknown error"
        };
    });

    return buildLayerResult("models", components);
}

async function testSkills(
    organizationId: string,
    workspaceId: string | null
): Promise<LayerResult> {
    const skills = await prisma.skill.findMany({
        where: workspaceId ? { organizationId, workspaceId } : { organizationId },
        include: {
            tools: true,
            _count: { select: { documents: true } }
        }
    });

    if (skills.length === 0) {
        return {
            layer: "skills",
            status: "skipped",
            components: [
                {
                    id: "none",
                    name: "No Skills",
                    status: "skipped",
                    latencyMs: null,
                    detail: "No skills configured in this workspace",
                    error: null
                }
            ],
            testedAt: new Date().toISOString()
        };
    }

    const components: ComponentResult[] = skills.map((skill) => {
        const issues: string[] = [];
        if (!skill.instructions) {
            issues.push("No instructions defined");
        }

        return {
            id: skill.id,
            name: skill.name,
            status: issues.length > 0 ? "warning" : "ok",
            latencyMs: null,
            detail: `${skill.tools.length} tools, ${skill._count.documents} documents`,
            error: issues.length > 0 ? issues.join("; ") : null,
            metadata: {
                slug: skill.slug,
                toolCount: skill.tools.length,
                documentCount: skill._count.documents
            }
        };
    });

    return buildLayerResult("skills", components);
}

async function testAgents(
    organizationId: string,
    workspaceId: string | null,
    deep: boolean
): Promise<LayerResult> {
    const agents = await prisma.agent.findMany({
        where: workspaceId
            ? { workspace: { organizationId }, workspaceId }
            : { workspace: { organizationId } },
        include: {
            tools: true,
            _count: { select: { skills: true } }
        },
        orderBy: { name: "asc" }
    });

    if (agents.length === 0) {
        return {
            layer: "agents",
            status: "skipped",
            components: [
                {
                    id: "none",
                    name: "No Agents",
                    status: "skipped",
                    latencyMs: null,
                    detail: "No agents configured in this workspace",
                    error: null
                }
            ],
            testedAt: new Date().toISOString()
        };
    }

    const results = await Promise.allSettled(
        agents.map(async (agent) => {
            const start = Date.now();
            try {
                const resolved = await agentResolver.resolve({ slug: agent.slug });

                if (deep) {
                    const response = await resolved.agent.generate(
                        "Say hello in exactly 3 words.",
                        { maxSteps: 1 }
                    );
                    return {
                        id: agent.id,
                        name: agent.name,
                        status: "ok" as const,
                        latencyMs: Date.now() - start,
                        detail: `Resolved and generated: "${response.text.slice(0, 80)}"`,
                        error: null,
                        metadata: {
                            slug: agent.slug,
                            model: `${agent.modelProvider}/${agent.modelName}`,
                            toolCount: agent.tools.length,
                            skillCount: agent._count.skills,
                            memoryEnabled: agent.memoryEnabled
                        }
                    };
                }

                return {
                    id: agent.id,
                    name: agent.name,
                    status: "ok" as const,
                    latencyMs: Date.now() - start,
                    detail: `Resolved (${agent.modelProvider}/${agent.modelName})`,
                    error: null,
                    metadata: {
                        slug: agent.slug,
                        model: `${agent.modelProvider}/${agent.modelName}`,
                        toolCount: agent.tools.length,
                        skillCount: agent._count.skills,
                        memoryEnabled: agent.memoryEnabled
                    }
                };
            } catch (err) {
                return {
                    id: agent.id,
                    name: agent.name,
                    status: "error" as const,
                    latencyMs: Date.now() - start,
                    detail: null,
                    error: err instanceof Error ? err.message : "Resolution failed",
                    metadata: {
                        slug: agent.slug,
                        model: `${agent.modelProvider}/${agent.modelName}`
                    }
                };
            }
        })
    );

    const components: ComponentResult[] = results.map((settled, idx) => {
        if (settled.status === "fulfilled") return settled.value;
        return {
            id: agents[idx]!.id,
            name: agents[idx]!.name,
            status: "error" as const,
            latencyMs: null,
            detail: null,
            error: settled.reason instanceof Error ? settled.reason.message : "Unknown error"
        };
    });

    return buildLayerResult("agents", components);
}

async function testWorkflows(
    organizationId: string,
    workspaceId: string | null
): Promise<LayerResult> {
    const workflows = await prisma.workflow.findMany({
        where: workspaceId
            ? { workspace: { organizationId }, workspaceId }
            : { workspace: { organizationId } },
        orderBy: { name: "asc" }
    });

    if (workflows.length === 0) {
        return {
            layer: "workflows",
            status: "skipped",
            components: [
                {
                    id: "none",
                    name: "No Workflows",
                    status: "skipped",
                    latencyMs: null,
                    detail: "No workflows configured in this workspace",
                    error: null
                }
            ],
            testedAt: new Date().toISOString()
        };
    }

    const components: ComponentResult[] = workflows.map((wf) => {
        const issues: string[] = [];

        if (!wf.definitionJson) {
            issues.push("No definition JSON");
        } else {
            try {
                const def =
                    typeof wf.definitionJson === "string"
                        ? JSON.parse(wf.definitionJson)
                        : wf.definitionJson;
                if (!def.steps || !Array.isArray(def.steps) || def.steps.length === 0) {
                    issues.push("Definition has no steps");
                }
            } catch {
                issues.push("Definition JSON is invalid");
            }
        }

        const def = wf.definitionJson as { steps?: unknown[] } | null;
        const stepCount = def && Array.isArray(def.steps) ? def.steps.length : 0;

        return {
            id: wf.id,
            name: wf.name,
            status: issues.length > 0 ? ("error" as const) : ("ok" as const),
            latencyMs: null,
            detail: issues.length > 0 ? null : `${stepCount} steps defined`,
            error: issues.length > 0 ? issues.join("; ") : null,
            metadata: {
                slug: wf.slug,
                stepCount,
                isPublished: wf.isPublished,
                isActive: wf.isActive
            }
        };
    });

    return buildLayerResult("workflows", components);
}

async function testNetworks(
    organizationId: string,
    workspaceId: string | null
): Promise<LayerResult> {
    const networks = await prisma.network.findMany({
        where: workspaceId
            ? { workspace: { organizationId }, workspaceId }
            : { workspace: { organizationId } },
        include: {
            primitives: true
        },
        orderBy: { name: "asc" }
    });

    if (networks.length === 0) {
        return {
            layer: "networks",
            status: "skipped",
            components: [
                {
                    id: "none",
                    name: "No Networks",
                    status: "skipped",
                    latencyMs: null,
                    detail: "No networks configured in this workspace",
                    error: null
                }
            ],
            testedAt: new Date().toISOString()
        };
    }

    const components: ComponentResult[] = networks.map((net) => {
        const issues: string[] = [];
        const agentPrimitives = net.primitives.filter((p) => p.primitiveType === "AGENT");
        const workflowPrimitives = net.primitives.filter((p) => p.primitiveType === "WORKFLOW");

        if (net.primitives.length === 0) {
            issues.push("No primitives configured");
        }

        return {
            id: net.id,
            name: net.name,
            status: issues.length > 0 ? ("warning" as const) : ("ok" as const),
            latencyMs: null,
            detail:
                issues.length > 0
                    ? null
                    : `${agentPrimitives.length} agents, ${workflowPrimitives.length} workflows`,
            error: issues.length > 0 ? issues.join("; ") : null,
            metadata: {
                slug: net.slug,
                primitiveCount: net.primitives.length,
                agentCount: agentPrimitives.length,
                workflowCount: workflowPrimitives.length
            }
        };
    });

    return buildLayerResult("networks", components);
}

function buildLayerResult(layer: LayerName, components: ComponentResult[]): LayerResult {
    const hasError = components.some((c) => c.status === "error");
    const allSkipped = components.every((c) => c.status === "skipped");
    const hasWarning = components.some((c) => c.status === "warning" || c.status === "error");

    let status: LayerResult["status"];
    if (allSkipped) status = "skipped";
    else if (hasError)
        status = hasError && components.some((c) => c.status === "ok") ? "degraded" : "error";
    else if (hasWarning) status = "degraded";
    else status = "ok";

    return {
        layer,
        status,
        components,
        testedAt: new Date().toISOString()
    };
}

/**
 * POST /api/system/health
 *
 * Run connectivity and validation tests across the entire dependency chain.
 *
 * Body: {
 *   layers?: string[]  — which layers to test (defaults to all)
 *   deep?: boolean      — if true, agents send a test prompt (not just resolve)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { userId, organizationId } = authContext;
        const workspaceId = await getDefaultWorkspaceIdForUser(userId);

        let body: { layers?: string[]; deep?: boolean } = {};
        try {
            body = await request.json();
        } catch {
            // empty body is fine — test all layers
        }

        const requestedLayers = body.layers?.length
            ? (body.layers.filter((l) => VALID_LAYERS.includes(l as LayerName)) as LayerName[])
            : [...VALID_LAYERS];

        const deep = body.deep ?? false;
        const results: LayerResult[] = [];

        for (const layer of requestedLayers) {
            switch (layer) {
                case "infrastructure":
                    results.push(await testInfrastructure());
                    break;
                case "connections":
                    results.push(await testConnections(organizationId, userId));
                    break;
                case "tools":
                    results.push(await testTools(organizationId));
                    break;
                case "models":
                    results.push(await testModels(organizationId));
                    break;
                case "skills":
                    results.push(await testSkills(organizationId, workspaceId));
                    break;
                case "agents":
                    results.push(await testAgents(organizationId, workspaceId, deep));
                    break;
                case "workflows":
                    results.push(await testWorkflows(organizationId, workspaceId));
                    break;
                case "networks":
                    results.push(await testNetworks(organizationId, workspaceId));
                    break;
            }
        }

        const overallOk = results.every((r) => r.status === "ok" || r.status === "skipped");
        const overallError = results.some((r) => r.status === "error");

        return NextResponse.json({
            success: true,
            status: overallOk ? "healthy" : overallError ? "critical" : "degraded",
            layers: results,
            testedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("[System Health] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "System health check failed"
            },
            { status: 500 }
        );
    }
}
