/**
 * Reviews API
 *
 * GET: List reviews across all source types, or fetch decision metrics
 * POST: Resolve single or batch reviews with source-type-aware dispatch
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { resolveEngagement, type EngagementDecision } from "@repo/agentc2/workflows";
import { inngest } from "@/lib/inngest";
import { authenticateRequest } from "@/lib/api-auth";

const SOURCE_TYPE_MAP: Record<string, string> = {
    workflow: "workflow-review",
    learning: "learning",
    integration: "integration",
    financial: "financial_action",
    campaign: "campaign"
};

export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        const type = url.searchParams.get("type");
        const source = url.searchParams.get("source");

        if (action === "metrics") {
            return await getMetrics(source, authContext.organizationId);
        }

        if (action === "daily-counts") {
            return await getDailyCounts(url, source, authContext.organizationId);
        }

        if (type === "learning") {
            return await getLearningProposals(url, authContext.organizationId);
        }

        const status = url.searchParams.get("status") || "pending";
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

        const sourceTypeFilter = source ? { sourceType: SOURCE_TYPE_MAP[source] ?? source } : {};

        const reviews = await prisma.approvalRequest.findMany({
            where: {
                organizationId: authContext.organizationId,
                ...sourceTypeFilter,
                ...(status !== "all" ? { status } : {})
            },
            include: {
                workflowRun: {
                    select: {
                        id: true,
                        status: true,
                        source: true,
                        inputJson: true,
                        workflow: {
                            select: { slug: true, name: true }
                        }
                    }
                },
                agent: {
                    select: { id: true, slug: true, name: true }
                },
                organization: { select: { name: true, slug: true } }
            },
            orderBy: { createdAt: "desc" },
            take: limit
        });

        const items = reviews.map((r) => {
            const runSource = r.workflowRun?.source || null;
            const originChannel = runSource?.startsWith("channel-")
                ? runSource.replace("channel-", "")
                : runSource === "admin-dispatch"
                  ? "admin"
                  : runSource || null;

            return {
                id: r.id,
                status: r.status,
                sourceType: r.sourceType,
                agentId: r.agentId,
                agentSlug: r.agent?.slug ?? null,
                agentName: r.agent?.name ?? null,
                workflowSlug: r.workflowRun?.workflow?.slug,
                workflowName: r.workflowRun?.workflow?.name,
                runId: r.workflowRunId,
                runStatus: r.workflowRun?.status,
                originChannel,
                suspendedStep: r.sourceId,
                reviewContext: r.reviewContext,
                githubRepo: r.githubRepo,
                githubIssueNumber: r.githubIssueNumber,
                notifiedChannels: r.notifiedChannels,
                responseChannel: r.responseChannel,
                feedbackRound: r.feedbackRound,
                feedbackText: r.feedbackText,
                decidedBy: r.decidedBy,
                decidedAt: r.decidedAt,
                decisionReason: r.decisionReason,
                orgName: r.organization?.name,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt
            };
        });

        return NextResponse.json({ success: true, reviews: items, total: items.length });
    } catch (error) {
        console.error("[Reviews API] GET error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}

async function getLearningProposals(url: URL, organizationId: string) {
    const status = url.searchParams.get("status") || "AWAITING_APPROVAL";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

    const statusFilter = status === "all" ? {} : { status: status as "AWAITING_APPROVAL" };

    const sessions = await prisma.learningSession.findMany({
        where: {
            ...statusFilter,
            agent: { workspace: { organizationId } }
        },
        include: {
            agent: { select: { id: true, slug: true, name: true, version: true } },
            proposals: {
                where: { isSelected: true }
            },
            experiments: {
                take: 1,
                orderBy: { createdAt: "desc" }
            },
            approval: true
        },
        orderBy: { createdAt: "desc" },
        take: limit
    });

    const items = sessions.map((s) => {
        const proposal = s.proposals[0];
        const experiment = s.experiments[0];
        const metadata = s.metadata as Record<string, unknown> | null;

        return {
            id: s.id,
            status: s.status,
            agentId: s.agent.id,
            agentSlug: s.agent.slug,
            agentName: s.agent.name,
            agentVersion: s.agent.version,
            triggerReason: (metadata?.triggerReason as string) || null,
            riskTier: (metadata?.riskTier as string) || proposal?.riskTier || "UNKNOWN",
            proposal: proposal
                ? {
                      id: proposal.id,
                      title: proposal.title,
                      description: proposal.description,
                      changeDescription: proposal.instructionsDiff,
                      candidateVersionId: proposal.candidateVersionId
                  }
                : null,
            experiment: experiment
                ? {
                      id: experiment.id,
                      status: experiment.status,
                      winRate: experiment.winRate,
                      gatingDecision: experiment.gatingResult,
                      baselineRuns: experiment.baselineRunCount,
                      candidateRuns: experiment.candidateRunCount
                  }
                : null,
            approval: s.approval
                ? {
                      id: s.approval.id,
                      status: s.approval.decision,
                      decidedBy: s.approval.approvedBy,
                      decidedAt: s.approval.reviewedAt
                  }
                : null,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt
        };
    });

    return NextResponse.json({ success: true, learningProposals: items, total: items.length });
}

async function getMetrics(sourceFilter: string | null | undefined, organizationId: string) {
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const last24h = new Date(now - 24 * 60 * 60 * 1000);

    const sourceTypeWhere = sourceFilter
        ? { sourceType: SOURCE_TYPE_MAP[sourceFilter] ?? sourceFilter }
        : {};

    const [pendingItems, recentDecisions, resolved24h] = await Promise.all([
        prisma.approvalRequest.findMany({
            where: { organizationId, ...sourceTypeWhere, status: "pending" },
            select: { createdAt: true, sourceType: true }
        }),
        prisma.approvalRequest.findMany({
            where: {
                organizationId,
                ...sourceTypeWhere,
                status: { not: "pending" },
                decidedAt: { gte: sevenDaysAgo }
            },
            select: { status: true, sourceType: true, createdAt: true, decidedAt: true }
        }),
        prisma.approvalRequest.count({
            where: {
                organizationId,
                ...sourceTypeWhere,
                status: { not: "pending" },
                decidedAt: { gte: last24h }
            }
        })
    ]);

    const pendingCount = pendingItems.length;
    const avgWaitMinutes =
        pendingCount > 0
            ? Math.round(
                  pendingItems.reduce((sum, r) => sum + (now - r.createdAt.getTime()), 0) /
                      pendingCount /
                      60_000
              )
            : 0;

    const approved7d = recentDecisions.filter((r) => r.status === "approved").length;
    const approvalRate7d =
        recentDecisions.length > 0 ? Math.round((approved7d / recentDecisions.length) * 100) : 0;

    const decisionsToday = recentDecisions.filter(
        (r) => r.decidedAt && r.decidedAt >= todayStart
    ).length;

    const withDecisionTime = recentDecisions.filter((r) => r.decidedAt);
    const avgDecisionMinutes =
        withDecisionTime.length > 0
            ? Math.round(
                  withDecisionTime.reduce(
                      (sum, r) => sum + (r.decidedAt!.getTime() - r.createdAt.getTime()),
                      0
                  ) /
                      withDecisionTime.length /
                      60_000
              )
            : 0;

    const queueTrend = pendingCount - resolved24h;

    // Per-source breakdown
    const bySource: Record<string, number> = {};
    for (const item of pendingItems) {
        const src = item.sourceType ?? "unknown";
        bySource[src] = (bySource[src] ?? 0) + 1;
    }

    return NextResponse.json({
        success: true,
        metrics: {
            pendingCount,
            avgWaitMinutes,
            approvalRate7d,
            decisionsToday,
            avgDecisionMinutes,
            resolved24h,
            queueTrend,
            bySource
        }
    });
}

async function getDailyCounts(
    url: URL,
    sourceFilter: string | null | undefined,
    organizationId: string
) {
    const days = Math.min(Number(url.searchParams.get("days")) || 30, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const sourceTypeWhere = sourceFilter
        ? { sourceType: SOURCE_TYPE_MAP[sourceFilter] ?? sourceFilter }
        : {};

    const records = await prisma.approvalRequest.findMany({
        where: {
            organizationId,
            ...sourceTypeWhere,
            createdAt: { gte: since }
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" }
    });

    const countsMap = new Map<string, number>();
    for (let d = 0; d < days; d++) {
        const date = new Date(since);
        date.setDate(date.getDate() + d);
        countsMap.set(date.toISOString().slice(0, 10), 0);
    }

    for (const r of records) {
        const key = r.createdAt.toISOString().slice(0, 10);
        countsMap.set(key, (countsMap.get(key) ?? 0) + 1);
    }

    const dailyCounts = Array.from(countsMap.entries()).map(([date, count]) => ({
        date,
        count
    }));

    return NextResponse.json({ success: true, dailyCounts });
}

export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const authUser = await prisma.user.findUnique({
            where: { id: authContext.userId },
            select: { name: true }
        });
        const decidedBy = authUser?.name || authContext.userId;

        // Learning proposal approve/reject
        if (body.type === "learning") {
            return await handleLearningDecision(body, authContext.organizationId);
        }

        if (Array.isArray(body.items)) {
            const itemIds = body.items.map(
                (item: { approvalRequestId: string }) => item.approvalRequestId
            );
            const validApprovals = await prisma.approvalRequest.findMany({
                where: {
                    id: { in: itemIds },
                    organizationId: authContext.organizationId
                },
                select: { id: true }
            });
            const validIds = new Set(validApprovals.map((a) => a.id));

            const results: Array<{ id: string; success: boolean; error?: string }> = [];
            for (const item of body.items) {
                if (!validIds.has(item.approvalRequestId)) {
                    results.push({
                        id: item.approvalRequestId,
                        success: false,
                        error: "Not found"
                    });
                    continue;
                }
                try {
                    const result = await resolveBySourceType({
                        approvalRequestId: item.approvalRequestId,
                        decision: item.decision,
                        message: item.message,
                        decidedBy
                    });
                    results.push({
                        id: item.approvalRequestId,
                        success: result.success,
                        error: result.error
                    });
                } catch (err) {
                    results.push({
                        id: item.approvalRequestId,
                        success: false,
                        error: err instanceof Error ? err.message : "Failed"
                    });
                }
            }
            const successCount = results.filter((r) => r.success).length;
            return NextResponse.json({
                success: true,
                results,
                successCount,
                totalCount: results.length
            });
        }

        const { approvalRequestId, decision, message, conditionMeta } = body as {
            approvalRequestId: string;
            decision: EngagementDecision;
            message?: string;
            conditionMeta?: { conditionType: "ci-checks"; repository?: string; ref?: string };
        };

        if (!approvalRequestId || !decision) {
            return NextResponse.json(
                { success: false, error: "approvalRequestId and decision are required" },
                { status: 400 }
            );
        }

        const ownershipCheck = await prisma.approvalRequest.findFirst({
            where: { id: approvalRequestId, organizationId: authContext.organizationId }
        });
        if (!ownershipCheck) {
            return NextResponse.json(
                { success: false, error: "Approval request not found" },
                { status: 404 }
            );
        }

        const result = await resolveBySourceType({
            approvalRequestId,
            decision,
            message,
            decidedBy,
            conditionMeta
        });

        return NextResponse.json({
            success: result.success,
            conditional: result.conditional,
            error: result.error
        });
    } catch (error) {
        console.error("[Reviews API] POST error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}

async function resolveBySourceType(params: {
    approvalRequestId: string;
    decision: EngagementDecision;
    message?: string;
    decidedBy: string;
    conditionMeta?: { conditionType: "ci-checks"; repository?: string; ref?: string };
}): Promise<{ success: boolean; conditional?: boolean; error?: string }> {
    const approval = await prisma.approvalRequest.findUnique({
        where: { id: params.approvalRequestId },
        select: { sourceType: true }
    });

    if (!approval) {
        return { success: false, error: "Approval request not found" };
    }

    const sourceType = approval.sourceType;

    if (sourceType === "campaign") {
        await prisma.approvalRequest.update({
            where: { id: params.approvalRequestId },
            data: {
                status: params.decision === "approved" ? "approved" : "rejected",
                decidedBy: params.decidedBy,
                decidedAt: new Date(),
                decisionReason: params.message
            }
        });

        if (params.decision === "approved") {
            const ar = await prisma.approvalRequest.findUnique({
                where: { id: params.approvalRequestId },
                select: { metadata: true }
            });
            const meta = ar?.metadata as Record<string, unknown> | null;
            const campaignId = meta?.campaignId as string | undefined;
            const missionId = meta?.missionId as string | undefined;
            const sequence = meta?.sequence as string | undefined;

            if (campaignId) {
                await inngest.send({
                    name: "mission/approved",
                    data: { campaignId, missionId, sequence }
                });
            }
        }

        return { success: true };
    }

    // Default: workflow-review (human engagement resolution)
    const result = await resolveEngagement({
        approvalRequestId: params.approvalRequestId,
        decision: params.decision,
        message: params.message,
        decidedBy: params.decidedBy,
        channel: "web",
        conditionMeta: params.conditionMeta
    });

    if (result.conditional) {
        await inngest.send({
            name: "command/check-conditions",
            data: { approvalRequestId: params.approvalRequestId }
        });
        return { success: true, conditional: true };
    }

    return { success: result.resumed, error: result.error };
}

async function handleLearningDecision(
    body: {
        sessionId: string;
        decision: "approve" | "reject";
        rationale?: string;
    },
    organizationId: string
) {
    const { sessionId, decision, rationale } = body;

    if (!sessionId || !decision) {
        return NextResponse.json(
            { success: false, error: "sessionId and decision are required" },
            { status: 400 }
        );
    }

    const session = await prisma.learningSession.findFirst({
        where: {
            id: sessionId,
            agent: { workspace: { organizationId } }
        },
        include: {
            proposals: { where: { isSelected: true } }
        }
    });

    if (!session) {
        return NextResponse.json(
            { success: false, error: "Learning session not found" },
            { status: 404 }
        );
    }

    if (session.status !== "AWAITING_APPROVAL") {
        return NextResponse.json(
            {
                success: false,
                error: `Session is not awaiting approval (status: ${session.status})`
            },
            { status: 400 }
        );
    }

    if (decision === "approve") {
        const selectedProposal = session.proposals[0];
        if (!selectedProposal?.candidateVersionId) {
            return NextResponse.json(
                { success: false, error: "No candidate version found" },
                { status: 400 }
            );
        }

        await inngest.send({
            name: "learning/version.promote",
            data: { sessionId, approvedBy: "web-ui", rationale }
        });

        return NextResponse.json({
            success: true,
            message: "Approved — version promotion in progress",
            sessionId
        });
    }

    // Reject
    await prisma.learningSession.update({
        where: { id: sessionId },
        data: { status: "REJECTED" }
    });

    return NextResponse.json({
        success: true,
        message: "Learning proposal rejected",
        sessionId
    });
}
