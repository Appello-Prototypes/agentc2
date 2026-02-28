/**
 * Reviews API
 *
 * GET: List reviews or fetch decision metrics
 * POST: Resolve single or batch reviews
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { resolveEngagement, type EngagementDecision } from "@repo/agentc2/workflows";
import { inngest } from "@/lib/inngest";

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        const type = url.searchParams.get("type");

        if (action === "metrics") {
            return await getMetrics();
        }

        if (type === "learning") {
            return await getLearningProposals(url);
        }

        const status = url.searchParams.get("status") || "pending";
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

        const reviews = await prisma.approvalRequest.findMany({
            where: {
                sourceType: "workflow-review",
                ...(status !== "all" ? { status } : {})
            },
            include: {
                workflowRun: {
                    select: {
                        id: true,
                        status: true,
                        inputJson: true,
                        workflow: {
                            select: { slug: true, name: true }
                        }
                    }
                },
                organization: { select: { name: true, slug: true } }
            },
            orderBy: { createdAt: "desc" },
            take: limit
        });

        const items = reviews.map((r) => ({
            id: r.id,
            status: r.status,
            workflowSlug: r.workflowRun?.workflow?.slug,
            workflowName: r.workflowRun?.workflow?.name,
            runId: r.workflowRunId,
            runStatus: r.workflowRun?.status,
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
        }));

        return NextResponse.json({ success: true, reviews: items, total: items.length });
    } catch (error) {
        console.error("[Reviews API] GET error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}

async function getLearningProposals(url: URL) {
    const status = url.searchParams.get("status") || "AWAITING_APPROVAL";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);

    const statusFilter = status === "all" ? {} : { status: status as "AWAITING_APPROVAL" };

    const sessions = await prisma.learningSession.findMany({
        where: statusFilter,
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

async function getMetrics() {
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const last24h = new Date(now - 24 * 60 * 60 * 1000);

    const [pendingItems, recentDecisions, resolved24h] = await Promise.all([
        prisma.approvalRequest.findMany({
            where: { sourceType: "workflow-review", status: "pending" },
            select: { createdAt: true }
        }),
        prisma.approvalRequest.findMany({
            where: {
                sourceType: "workflow-review",
                status: { not: "pending" },
                decidedAt: { gte: sevenDaysAgo }
            },
            select: { status: true, createdAt: true, decidedAt: true }
        }),
        prisma.approvalRequest.count({
            where: {
                sourceType: "workflow-review",
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

    return NextResponse.json({
        success: true,
        metrics: {
            pendingCount,
            avgWaitMinutes,
            approvalRate7d,
            decisionsToday,
            avgDecisionMinutes,
            resolved24h,
            queueTrend
        }
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Learning proposal approve/reject
        if (body.type === "learning") {
            return await handleLearningDecision(body);
        }

        if (Array.isArray(body.items)) {
            const results: Array<{ id: string; success: boolean; error?: string }> = [];
            for (const item of body.items) {
                try {
                    const result = await resolveEngagement({
                        approvalRequestId: item.approvalRequestId,
                        decision: item.decision,
                        message: item.message,
                        decidedBy: "web-ui",
                        channel: "web"
                    });
                    results.push({
                        id: item.approvalRequestId,
                        success: result.resumed,
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

        const { approvalRequestId, decision, message } = body as {
            approvalRequestId: string;
            decision: EngagementDecision;
            message?: string;
        };

        if (!approvalRequestId || !decision) {
            return NextResponse.json(
                { success: false, error: "approvalRequestId and decision are required" },
                { status: 400 }
            );
        }

        const result = await resolveEngagement({
            approvalRequestId,
            decision,
            message,
            decidedBy: "web-ui",
            channel: "web"
        });

        return NextResponse.json({ success: result.resumed, error: result.error });
    } catch (error) {
        console.error("[Reviews API] POST error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}

async function handleLearningDecision(body: {
    sessionId: string;
    decision: "approve" | "reject";
    rationale?: string;
}) {
    const { sessionId, decision, rationale } = body;

    if (!sessionId || !decision) {
        return NextResponse.json(
            { success: false, error: "sessionId and decision are required" },
            { status: 400 }
        );
    }

    const session = await prisma.learningSession.findUnique({
        where: { id: sessionId },
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
