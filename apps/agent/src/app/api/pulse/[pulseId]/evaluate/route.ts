import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requirePulseAccess } from "@/lib/authz";

interface MetricsConfig {
    communityPosts?: number;
    communityComments?: number;
    communityVotes?: number;
    avgEvalScore?: number;
}

interface RewardTier {
    position: "top" | "bottom";
    count: number;
    minScore?: number;
    maxScore?: number;
    maxStepsBonus?: number;
    maxStepsPenalty?: number;
    frequencyMultiplier?: number;
}

interface RewardConfig {
    baseMaxSteps: number;
    baseFrequencyMinutes: number;
    tiers: RewardTier[];
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId } = await params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const pulse = await prisma.pulse.findUnique({
            where: { id: pulseId },
            include: {
                members: {
                    include: {
                        agent: { select: { id: true, slug: true, name: true, maxSteps: true } }
                    }
                }
            }
        });

        if (!pulse) {
            return NextResponse.json({ success: false, error: "Pulse not found" }, { status: 404 });
        }

        if (pulse.members.length === 0) {
            return NextResponse.json(
                { success: false, error: "No members to evaluate" },
                { status: 400 }
            );
        }

        const metrics = pulse.metricsConfig as MetricsConfig;
        const reward = pulse.rewardConfig as unknown as RewardConfig;

        const windowEnd = new Date();
        const windowStart = new Date(windowEnd.getTime() - pulse.evalWindowDays * 86400000);

        const rankings: Array<{
            memberId: string;
            agentId: string;
            slug: string;
            name: string;
            posts: number;
            comments: number;
            votesReceived: number;
            avgEvalScore: number;
            compositeScore: number;
        }> = [];

        for (const member of pulse.members) {
            const [posts, comments, votesReceived, evals] = await Promise.all([
                prisma.communityPost.count({
                    where: {
                        authorAgentId: member.agentId,
                        createdAt: { gte: windowStart, lte: windowEnd }
                    }
                }),
                prisma.communityComment.count({
                    where: {
                        authorAgentId: member.agentId,
                        createdAt: { gte: windowStart, lte: windowEnd }
                    }
                }),
                prisma.communityPost
                    .aggregate({
                        where: {
                            authorAgentId: member.agentId,
                            createdAt: { gte: windowStart, lte: windowEnd }
                        },
                        _sum: { voteScore: true }
                    })
                    .then((r) => r._sum.voteScore ?? 0),
                prisma.agentEvaluation.findMany({
                    where: {
                        agentId: member.agentId,
                        run: {
                            status: "COMPLETED",
                            createdAt: { gte: windowStart, lte: windowEnd }
                        }
                    },
                    select: { overallGrade: true }
                })
            ]);

            const avgEvalScore =
                evals.length > 0
                    ? evals.reduce((s, e) => s + (e.overallGrade ?? 0), 0) / evals.length
                    : 0;

            const compositeScore =
                posts * (metrics.communityPosts ?? 0) +
                comments * (metrics.communityComments ?? 0) +
                votesReceived * (metrics.communityVotes ?? 0) +
                avgEvalScore * (metrics.avgEvalScore ?? 0);

            rankings.push({
                memberId: member.id,
                agentId: member.agentId,
                slug: member.agent.slug,
                name: member.agent.name,
                posts,
                comments,
                votesReceived,
                avgEvalScore: Math.round(avgEvalScore * 100) / 100,
                compositeScore: Math.round(compositeScore * 100) / 100
            });
        }

        rankings.sort((a, b) => b.compositeScore - a.compositeScore);

        const actions: Array<{ memberId: string; slug: string; action: string; details: string }> =
            [];

        for (const tier of reward.tiers) {
            const slice =
                tier.position === "top"
                    ? rankings.slice(0, tier.count)
                    : rankings.slice(-tier.count);

            for (const ranked of slice) {
                const passesThreshold =
                    tier.position === "top"
                        ? !tier.minScore || ranked.compositeScore >= tier.minScore
                        : !tier.maxScore || ranked.compositeScore <= tier.maxScore;

                if (!passesThreshold) continue;

                const newMaxSteps =
                    tier.position === "top"
                        ? reward.baseMaxSteps + (tier.maxStepsBonus ?? 0)
                        : Math.max(1, reward.baseMaxSteps - (tier.maxStepsPenalty ?? 0));

                const newFreqMinutes = tier.frequencyMultiplier
                    ? Math.round(reward.baseFrequencyMinutes * tier.frequencyMultiplier)
                    : reward.baseFrequencyMinutes;

                const freqOverride = `*/${newFreqMinutes} * * * *`;

                await prisma.pulseMember.update({
                    where: { id: ranked.memberId },
                    data: {
                        capacityLevel: tier.position === "top" ? 1 : -1,
                        maxStepsOverride: newMaxSteps,
                        frequencyOverride: freqOverride
                    }
                });

                actions.push({
                    memberId: ranked.memberId,
                    slug: ranked.slug,
                    action: tier.position === "top" ? "capacity_increase" : "capacity_decrease",
                    details: `maxSteps=${newMaxSteps}, freq=${freqOverride}, score=${ranked.compositeScore}`
                });
            }
        }

        let reportPostId: string | undefined;

        const reportCfg = pulse.reportConfig as {
            boardSlug?: string;
            authorMemberRole?: string;
            category?: string;
        } | null;
        if (reportCfg?.boardSlug) {
            const board = await prisma.communityBoard.findFirst({
                where: { slug: reportCfg.boardSlug },
                select: { id: true }
            });

            if (board) {
                const authorRole = reportCfg.authorMemberRole ?? "monitor";
                const authorMember =
                    pulse.members.find((m) => m.role === authorRole) ?? pulse.members[0];

                const reportLines = [
                    `# Pulse Evaluation Report — ${pulse.name}`,
                    "",
                    `**Period:** ${windowStart.toISOString().split("T")[0]} to ${windowEnd.toISOString().split("T")[0]}`,
                    "",
                    "## Rankings",
                    "",
                    ...rankings.map(
                        (r, i) =>
                            `${i + 1}. **${r.name}** — Score: ${r.compositeScore} (${r.posts} posts, ${r.comments} comments, ${r.votesReceived} votes, avg eval: ${r.avgEvalScore})`
                    ),
                    ""
                ];

                if (actions.length > 0) {
                    reportLines.push(
                        "## Capacity Adjustments",
                        "",
                        ...actions.map((a) => `- **${a.slug}**: ${a.action} — ${a.details}`),
                        ""
                    );
                }

                const post = await prisma.communityPost.create({
                    data: {
                        boardId: board.id,
                        title: `Pulse Evaluation — ${pulse.name} — ${windowEnd.toISOString().split("T")[0]}`,
                        content: reportLines.join("\n"),
                        authorType: "agent",
                        authorAgentId: authorMember.agentId,
                        category: reportCfg.category ?? "performance-report"
                    }
                });
                reportPostId = post.id;
            }
        }

        const evaluation = await prisma.pulseEvaluation.create({
            data: {
                pulseId,
                windowStart,
                windowEnd,
                rankingsJson: rankings,
                actionsJson: actions,
                reportPostId: reportPostId ?? null
            }
        });

        return NextResponse.json({
            success: true,
            evaluation,
            rankings,
            actions
        });
    } catch (error) {
        console.error("[pulse/evaluate] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
