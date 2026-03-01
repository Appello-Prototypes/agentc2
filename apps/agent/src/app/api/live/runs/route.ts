import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

type RunKind = "agent" | "workflow" | "network";

interface UnifiedRun {
    id: string;
    kind: RunKind;
    name: string;
    slug: string;
    status: string;
    inputText: string;
    outputText?: string | null;
    durationMs?: number | null;
    startedAt: string;
    completedAt?: string | null;
    source?: string | null;
    triggerType: string;
    totalTokens?: number | null;
    costUsd?: number | null;
    stepsCount?: number | null;
    modelName?: string | null;
    modelProvider?: string | null;
    toolCallCount?: number | null;
    versionNumber?: number | null;
    suspendedStep?: string | null;
    environment?: string | null;
    runType?: string | null;
    agentId?: string | null;
    sessionId?: string | null;
    threadId?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    failureReason?: string | null;
}

/**
 * GET /api/live/runs
 *
 * Returns production runs with optional filtering.
 *
 * Query Parameters:
 * - kind: Filter by primitive type (all, agent, workflow, network). Default: all
 * - status, source, agentId, versionId, modelName, runType, toolUsage
 * - search, from/to, limit, offset
 */
export async function GET(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const kind = (searchParams.get("kind") || "all") as RunKind | "all";
        const status = searchParams.get("status");
        const source = searchParams.get("source");
        const agentId = searchParams.get("agentId");
        const versionId = searchParams.get("versionId");
        const modelName = searchParams.get("modelName");
        const runType = searchParams.get("runType") || "PROD";
        const toolUsage = searchParams.get("toolUsage");
        const search = searchParams.get("search");
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        const includeAgents = kind === "all" || kind === "agent";
        const includeWorkflows = kind === "all" || kind === "workflow";
        const includeNetworks = kind === "all" || kind === "network";

        const statusFilter =
            status && status !== "all" ? status.toUpperCase() : null;

        const startedAtFilter: Record<string, Date> = {};
        if (from) startedAtFilter.gte = new Date(from);
        if (to) startedAtFilter.lte = new Date(to);
        const hasDateFilter = Object.keys(startedAtFilter).length > 0;

        const allRuns: UnifiedRun[] = [];
        let agentTotal = 0;
        let workflowTotal = 0;
        let networkTotal = 0;

        // --- Agent runs ---
        let budgetAlerts: Array<{
            agentId: string;
            agentSlug: string;
            agentName: string;
            currentSpendUsd: number;
            monthlyLimitUsd: number;
            percentUsed: number;
        }> = [];

        if (includeAgents) {
            const baseWhere: Prisma.AgentRunWhereInput = {
                agent: { workspace: { organizationId: authContext.organizationId } }
            };

            if (runType && runType.toLowerCase() !== "all") {
                baseWhere.runType = runType.toUpperCase() as Prisma.EnumRunTypeFilter;
            }
            if (statusFilter) {
                baseWhere.status = statusFilter as Prisma.EnumRunStatusFilter;
            }
            if (source && source !== "all") {
                baseWhere.source = source.toLowerCase();
            }
            if (agentId && agentId !== "all") {
                baseWhere.agentId = agentId;
            }
            if (versionId && versionId !== "all") {
                baseWhere.versionId = versionId;
            }
            if (modelName && modelName !== "all") {
                baseWhere.modelName = modelName;
            }
            if (toolUsage === "with_tools") {
                baseWhere.toolCalls = { some: {} };
            }
            if (toolUsage === "without_tools") {
                baseWhere.toolCalls = { none: {} };
            }
            if (search) {
                baseWhere.OR = [
                    { id: { contains: search, mode: "insensitive" } },
                    { inputText: { contains: search, mode: "insensitive" } },
                    { outputText: { contains: search, mode: "insensitive" } }
                ];
            }
            if (hasDateFilter) {
                baseWhere.startedAt = startedAtFilter as Prisma.DateTimeFilter;
            }

            const [agentRuns, agentCount] = await Promise.all([
                prisma.agentRun.findMany({
                    where: baseWhere,
                    include: {
                        agent: { select: { slug: true, name: true } },
                        trace: {
                            select: {
                                stepsJson: true,
                                tokensJson: true,
                                _count: { select: { steps: true, toolCalls: true } }
                            }
                        },
                        toolCalls: { select: { toolKey: true } },
                        _count: { select: { toolCalls: true } }
                    },
                    orderBy: { startedAt: "desc" },
                    take: kind === "all" ? limit : limit,
                    skip: kind === "agent" ? offset : 0
                }),
                prisma.agentRun.count({ where: baseWhere })
            ]);

            agentTotal = agentCount;

            const versionIds = Array.from(
                new Set(agentRuns.map((r) => r.versionId).filter(Boolean))
            ) as string[];
            const versionMap = new Map<string, number>();
            if (versionIds.length > 0) {
                const versions = await prisma.agentVersion.findMany({
                    where: { id: { in: versionIds } },
                    select: { id: true, version: true }
                });
                for (const v of versions) versionMap.set(v.id, v.version);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const run of agentRuns as any[]) {
                const stepCount = (() => {
                    const s = run.trace?._count?.steps ?? 0;
                    if (s > 0) return s;
                    return Array.isArray(run.trace?.stepsJson) ? run.trace.stepsJson.length : 0;
                })();
                allRuns.push({
                    id: run.id,
                    kind: "agent",
                    name: run.agent.name,
                    slug: run.agent.slug,
                    status: run.status,
                    inputText: run.inputText,
                    outputText: run.outputText,
                    durationMs: run.durationMs,
                    startedAt: run.startedAt.toISOString(),
                    completedAt: run.completedAt?.toISOString() || null,
                    source: run.source || null,
                    triggerType: run.triggerType || "API",
                    totalTokens:
                        run.totalTokens ??
                        (run.trace?.tokensJson?.total as number | undefined) ??
                        0,
                    costUsd: run.costUsd,
                    stepsCount: stepCount,
                    modelName: run.modelName,
                    modelProvider: run.modelProvider,
                    toolCallCount:
                        run._count.toolCalls > 0
                            ? run._count.toolCalls
                            : (run.trace?._count?.toolCalls ?? 0),
                    versionNumber: run.versionId
                        ? versionMap.get(run.versionId) || null
                        : null,
                    suspendedStep: null,
                    environment: null,
                    runType: run.runType,
                    agentId: run.agentId,
                    sessionId: run.sessionId || null,
                    threadId: run.threadId || null,
                    promptTokens:
                        run.promptTokens ??
                        (run.trace?.tokensJson?.prompt as number | undefined) ??
                        0,
                    completionTokens:
                        run.completionTokens ??
                        (run.trace?.tokensJson?.completion as number | undefined) ??
                        0,
                    failureReason: run.failureReason || null
                });
            }

            budgetAlerts = await getBudgetAlerts();
        }

        // --- Workflow runs ---
        if (includeWorkflows) {
            const wfWhere: Prisma.WorkflowRunWhereInput = {
                workflow: { workspace: { organizationId: authContext.organizationId } }
            };
            if (statusFilter) {
                wfWhere.status = statusFilter as Prisma.EnumRunStatusFilter;
            }
            if (source && source !== "all") {
                wfWhere.source = source.toLowerCase();
            }
            if (search) {
                wfWhere.OR = [
                    { id: { contains: search, mode: "insensitive" } },
                    { inputJson: { path: [], string_contains: search } }
                ];
            }
            if (hasDateFilter) {
                wfWhere.startedAt = startedAtFilter as Prisma.DateTimeFilter;
            }

            const [wfRuns, wfCount] = await Promise.all([
                prisma.workflowRun.findMany({
                    where: wfWhere,
                    include: {
                        workflow: { select: { slug: true, name: true } },
                        _count: { select: { steps: true } }
                    },
                    orderBy: { startedAt: "desc" },
                    take: kind === "all" ? limit : limit,
                    skip: kind === "workflow" ? offset : 0
                }),
                prisma.workflowRun.count({ where: wfWhere })
            ]);

            workflowTotal = wfCount;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const run of wfRuns as any[]) {
                const inputText =
                    typeof run.inputJson === "object" && run.inputJson !== null
                        ? (run.inputJson as Record<string, unknown>).title ||
                          (run.inputJson as Record<string, unknown>).description ||
                          JSON.stringify(run.inputJson).slice(0, 500)
                        : String(run.inputJson || "");
                const outputText =
                    run.outputJson != null
                        ? JSON.stringify(run.outputJson).slice(0, 500)
                        : null;

                allRuns.push({
                    id: run.id,
                    kind: "workflow",
                    name: run.workflow?.name || "Unknown Workflow",
                    slug: run.workflow?.slug || "unknown",
                    status: run.status,
                    inputText: String(inputText),
                    outputText,
                    durationMs: run.durationMs,
                    startedAt: run.startedAt.toISOString(),
                    completedAt: run.completedAt?.toISOString() || null,
                    source: run.source || null,
                    triggerType: run.triggerType || "API",
                    totalTokens: run.totalTokens,
                    costUsd: run.totalCostUsd,
                    stepsCount: run._count?.steps ?? 0,
                    modelName: null,
                    modelProvider: null,
                    toolCallCount: null,
                    versionNumber: null,
                    suspendedStep: run.suspendedStep || null,
                    environment: run.environment || null,
                    runType: null,
                    agentId: null,
                    sessionId: null,
                    threadId: null,
                    promptTokens: null,
                    completionTokens: null,
                    failureReason: null
                });
            }
        }

        // --- Network runs ---
        if (includeNetworks) {
            const netWhere: Prisma.NetworkRunWhereInput = {
                network: { workspace: { organizationId: authContext.organizationId } }
            };
            if (statusFilter) {
                netWhere.status = statusFilter as Prisma.EnumRunStatusFilter;
            }
            if (source && source !== "all") {
                netWhere.source = source.toLowerCase();
            }
            if (search) {
                netWhere.OR = [
                    { id: { contains: search, mode: "insensitive" } },
                    { inputText: { contains: search, mode: "insensitive" } },
                    { outputText: { contains: search, mode: "insensitive" } }
                ];
            }
            if (hasDateFilter) {
                netWhere.startedAt = startedAtFilter as Prisma.DateTimeFilter;
            }

            const [netRuns, netCount] = await Promise.all([
                prisma.networkRun.findMany({
                    where: netWhere,
                    include: {
                        network: { select: { slug: true, name: true } },
                        _count: { select: { steps: true } }
                    },
                    orderBy: { startedAt: "desc" },
                    take: kind === "all" ? limit : limit,
                    skip: kind === "network" ? offset : 0
                }),
                prisma.networkRun.count({ where: netWhere })
            ]);

            networkTotal = netCount;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const run of netRuns as any[]) {
                allRuns.push({
                    id: run.id,
                    kind: "network",
                    name: run.network?.name || "Unknown Network",
                    slug: run.network?.slug || "unknown",
                    status: run.status,
                    inputText: run.inputText || "",
                    outputText: run.outputText,
                    durationMs: run.durationMs,
                    startedAt: run.startedAt.toISOString(),
                    completedAt: run.completedAt?.toISOString() || null,
                    source: run.source || null,
                    triggerType: run.triggerType || "API",
                    totalTokens: run.totalTokens,
                    costUsd: run.totalCostUsd,
                    stepsCount: run.stepsExecuted ?? run._count?.steps ?? 0,
                    modelName: null,
                    modelProvider: null,
                    toolCallCount: null,
                    versionNumber: null,
                    suspendedStep: null,
                    environment: run.environment || null,
                    runType: null,
                    agentId: null,
                    sessionId: null,
                    threadId: run.threadId || null,
                    promptTokens: null,
                    completionTokens: null,
                    failureReason: null
                });
            }
        }

        // Sort merged results by startedAt desc and paginate for kind=all
        if (kind === "all") {
            allRuns.sort(
                (a, b) =>
                    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
            );
            const paginated = allRuns.slice(offset, offset + limit);
            const grandTotal = agentTotal + workflowTotal + networkTotal;

            return NextResponse.json({
                success: true,
                runs: paginated,
                counts: {
                    total: grandTotal,
                    byKind: {
                        agent: agentTotal,
                        workflow: workflowTotal,
                        network: networkTotal
                    }
                },
                budgetAlerts,
                pagination: {
                    limit,
                    offset,
                    hasMore: offset + paginated.length < grandTotal
                }
            });
        }

        // Single-kind response
        const total =
            kind === "agent"
                ? agentTotal
                : kind === "workflow"
                  ? workflowTotal
                  : networkTotal;

        return NextResponse.json({
            success: true,
            runs: allRuns,
            counts: {
                total,
                byKind: {
                    agent: agentTotal,
                    workflow: workflowTotal,
                    network: networkTotal
                }
            },
            budgetAlerts,
            pagination: {
                limit,
                offset,
                hasMore: offset + allRuns.length < total
            }
        });
    } catch (error) {
        console.error("[Live Runs] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch production runs" },
            { status: 500 }
        );
    }
}

async function getBudgetAlerts() {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const policies = await prisma.budgetPolicy.findMany({
            where: { enabled: true, hardLimit: true },
            include: { agent: { select: { id: true, slug: true, name: true } } }
        });

        const alerts: Array<{
            agentId: string;
            agentSlug: string;
            agentName: string;
            currentSpendUsd: number;
            monthlyLimitUsd: number;
            percentUsed: number;
        }> = [];

        for (const policy of policies) {
            if (!policy.monthlyLimitUsd || !policy.agent) continue;
            const costEvents = await prisma.costEvent.findMany({
                where: {
                    agentId: policy.agentId ?? undefined,
                    createdAt: { gte: startOfMonth }
                },
                select: { costUsd: true }
            });
            const currentSpend = costEvents.reduce(
                (sum, e) => sum + (e.costUsd || 0),
                0
            );
            if (currentSpend >= policy.monthlyLimitUsd) {
                alerts.push({
                    agentId: policy.agent.id,
                    agentSlug: policy.agent.slug,
                    agentName: policy.agent.name,
                    currentSpendUsd: Math.round(currentSpend * 100) / 100,
                    monthlyLimitUsd: policy.monthlyLimitUsd,
                    percentUsed: Math.round(
                        (currentSpend / policy.monthlyLimitUsd) * 100
                    )
                });
            }
        }
        return alerts;
    } catch {
        return [];
    }
}
