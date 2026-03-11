import { prisma } from "@repo/database";

interface MetricsConfig {
    communityPosts?: number;
    communityComments?: number;
    communityVotes?: number;
    avgEvalScore?: number;
    milestonesCompleted?: number;
    tasksCompleted?: number;
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

export interface RankedMember {
    memberId: string;
    agentId: string;
    slug: string;
    name: string;
    role: string;
    posts: number;
    comments: number;
    votesReceived: number;
    avgEvalScore: number;
    tasksCompleted: number;
    milestonesContributed: number;
    compositeScore: number;
}

export interface TierAction {
    memberId: string;
    agentId: string;
    slug: string;
    action: string;
    details: string;
    newMaxSteps: number;
    newFreqOverride?: string;
}

export interface GodAgentMetrics {
    constraintsAdded: number;
    scoreDelta: number;
    workerChurn: number;
    orchestrationActions: number;
}

export interface EvaluationResult {
    rankings: RankedMember[];
    actions: TierAction[];
    report: string;
    reportPostId?: string;
    autoScore?: number;
    godAgentMetrics?: GodAgentMetrics;
}

interface PulseMemberWithAgent {
    id: string;
    pulseId: string;
    agentId: string;
    role: string;
    capacityLevel: number;
    maxStepsOverride: number | null;
    frequencyOverride: string | null;
    agent: {
        id: string;
        slug: string;
        name: string;
        maxSteps: number | null;
    };
}

export interface PulseWithMembers {
    id: string;
    slug: string;
    name: string;
    workspaceId?: string;
    goal: string;
    metricsConfig: unknown;
    rewardConfig: unknown;
    evalWindowDays: number;
    reportConfig: unknown;
    scoreFunction: string | null;
    scoreFunctionType: string | null;
    scoreDirection: string | null;
    currentScore: number | null;
    targetScore: number | null;
    scoreHistory: unknown;
    settings: unknown;
    members: PulseMemberWithAgent[];
}

async function computeAutoScore(pulse: PulseWithMembers): Promise<number | null> {
    const type = pulse.scoreFunctionType;
    if (!type || type === "manual") return null;

    if (type === "milestone_completion") {
        const [total, completed] = await Promise.all([
            prisma.pulseMilestone.count({ where: { pulseId: pulse.id } }),
            prisma.pulseMilestone.count({ where: { pulseId: pulse.id, status: "completed" } })
        ]);
        if (total === 0) return null;
        return Math.round((completed / total) * 10000) / 100;
    }

    if (type === "task_completion") {
        const boards = await prisma.communityBoard.findMany({
            where: { pulseId: pulse.id },
            select: { id: true }
        });
        const boardIds = boards.map((b) => b.id);
        if (boardIds.length === 0) return null;

        const [total, done] = await Promise.all([
            prisma.communityPost.count({
                where: { boardId: { in: boardIds }, taskStatus: { not: null } }
            }),
            prisma.communityPost.count({
                where: { boardId: { in: boardIds }, taskStatus: "done" }
            })
        ]);
        if (total === 0) return null;
        return Math.round((done / total) * 10000) / 100;
    }

    if (type === "community_activity") {
        const boards = await prisma.communityBoard.findMany({
            where: { pulseId: pulse.id },
            select: { id: true }
        });
        const boardIds = boards.map((b) => b.id);
        if (boardIds.length === 0) return null;

        const [posts, comments, votes] = await Promise.all([
            prisma.communityPost.count({ where: { boardId: { in: boardIds } } }),
            prisma.communityComment.count({
                where: { post: { boardId: { in: boardIds } } }
            }),
            prisma.communityVote.count({
                where: {
                    OR: [
                        { post: { boardId: { in: boardIds } } },
                        { comment: { post: { boardId: { in: boardIds } } } }
                    ]
                }
            })
        ]);
        return posts + comments + votes;
    }

    return null;
}

export async function evaluatePulseMembers(
    pulse: PulseWithMembers,
    windowStart: Date,
    windowEnd: Date
): Promise<EvaluationResult> {
    const metrics = pulse.metricsConfig as MetricsConfig;
    const reward = pulse.rewardConfig as unknown as RewardConfig;

    const evaluableMembers = pulse.members.filter((m) => m.role !== "god");

    const rankings: RankedMember[] = [];

    for (const member of evaluableMembers) {
        const [posts, comments, votesReceived, evals, tasksCompleted] = await Promise.all([
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
            }),
            prisma.communityPost.count({
                where: {
                    assignedAgentId: member.agentId,
                    taskStatus: "done",
                    updatedAt: { gte: windowStart, lte: windowEnd }
                }
            })
        ]);

        const milestonesContributed = await prisma.communityPost.count({
            where: {
                assignedAgentId: member.agentId,
                taskStatus: "done",
                milestoneId: { not: null },
                updatedAt: { gte: windowStart, lte: windowEnd }
            }
        });

        const avgEvalScore =
            evals.length > 0
                ? evals.reduce((s, e) => s + (e.overallGrade ?? 0), 0) / evals.length
                : 0;

        const compositeScore =
            posts * (metrics.communityPosts ?? 0) +
            comments * (metrics.communityComments ?? 0) +
            votesReceived * (metrics.communityVotes ?? 0) +
            avgEvalScore * (metrics.avgEvalScore ?? 0) +
            tasksCompleted * (metrics.tasksCompleted ?? 0) +
            milestonesContributed * (metrics.milestonesCompleted ?? 0);

        rankings.push({
            memberId: member.id,
            agentId: member.agentId,
            slug: member.agent.slug,
            name: member.agent.name,
            role: member.role,
            posts,
            comments,
            votesReceived,
            avgEvalScore: Math.round(avgEvalScore * 100) / 100,
            tasksCompleted,
            milestonesContributed,
            compositeScore: Math.round(compositeScore * 100) / 100
        });
    }

    rankings.sort((a, b) => b.compositeScore - a.compositeScore);

    const actions: TierAction[] = [];

    for (const tier of reward.tiers) {
        const slice =
            tier.position === "top" ? rankings.slice(0, tier.count) : rankings.slice(-tier.count);

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

            // Bridge rewards to AgentSchedule (Phase 3.3 fix)
            const schedules = await prisma.agentSchedule.findMany({
                where: { agentId: ranked.agentId, isActive: true }
            });
            for (const schedule of schedules) {
                const existingInput = (schedule.inputJson as Record<string, unknown>) ?? {};
                await prisma.agentSchedule.update({
                    where: { id: schedule.id },
                    data: {
                        inputJson: { ...existingInput, maxSteps: newMaxSteps },
                        cronExpr: freqOverride
                    }
                });
            }

            actions.push({
                memberId: ranked.memberId,
                agentId: ranked.agentId,
                slug: ranked.slug,
                action: tier.position === "top" ? "capacity_increase" : "capacity_decrease",
                details: `maxSteps=${newMaxSteps}, freq=${freqOverride}, score=${ranked.compositeScore}`,
                newMaxSteps,
                newFreqOverride: freqOverride
            });
        }
    }

    // Auto-score computation (Phase 3.4)
    let autoScore: number | null = null;
    if (pulse.scoreFunctionType && pulse.scoreFunctionType !== "manual") {
        autoScore = await computeAutoScore(pulse);
        if (autoScore !== null) {
            const existingHistory = (pulse.scoreHistory as Array<Record<string, unknown>>) ?? [];
            await prisma.pulse.update({
                where: { id: pulse.id },
                data: {
                    currentScore: autoScore,
                    scoreHistory: [
                        ...existingHistory,
                        {
                            date: new Date().toISOString(),
                            value: autoScore,
                            source: "auto",
                            notes: `Auto-computed via ${pulse.scoreFunctionType}`
                        }
                    ]
                }
            });
        }
    }

    // Generate report
    let reportPostId: string | undefined;
    const reportCfg = pulse.reportConfig as {
        boardSlug?: string;
        authorMemberRole?: string;
        category?: string;
    } | null;

    const reportLines = [
        `# Pulse Evaluation Report — ${pulse.name}`,
        "",
        `**Period:** ${windowStart.toISOString().split("T")[0]} to ${windowEnd.toISOString().split("T")[0]}`,
        ""
    ];

    if (pulse.currentScore !== null || autoScore !== null) {
        const score = autoScore ?? pulse.currentScore;
        reportLines.push(
            `**Score:** ${score}${pulse.targetScore ? ` / ${pulse.targetScore}` : ""} (${pulse.scoreDirection ?? "higher"} is better)`,
            ""
        );
    }

    reportLines.push(
        "## Rankings",
        "",
        ...rankings.map(
            (r, i) =>
                `${i + 1}. **${r.name}** — Score: ${r.compositeScore} (${r.posts} posts, ${r.comments} comments, ${r.votesReceived} votes, ${r.tasksCompleted} tasks, avg eval: ${r.avgEvalScore})`
        ),
        ""
    );

    if (actions.length > 0) {
        reportLines.push(
            "## Capacity Adjustments",
            "",
            ...actions.map((a) => `- **${a.slug}**: ${a.action} — ${a.details}`),
            ""
        );
    }

    const report = reportLines.join("\n");

    if (reportCfg?.boardSlug) {
        const organizationId = pulse.workspaceId
            ? (
                  await prisma.workspace.findUnique({
                      where: { id: pulse.workspaceId },
                      select: { organizationId: true }
                  })
              )?.organizationId
            : undefined;
        const board = await prisma.communityBoard.findFirst({
            where: {
                slug: reportCfg.boardSlug,
                ...(organizationId ? { organizationId } : {})
            },
            select: { id: true }
        });

        if (board) {
            const authorRole = reportCfg.authorMemberRole ?? "monitor";
            const authorMember =
                pulse.members.find((m) => m.role === authorRole) ?? pulse.members[0];

            const post = await prisma.communityPost.create({
                data: {
                    boardId: board.id,
                    title: `Pulse Evaluation — ${pulse.name} — ${windowEnd.toISOString().split("T")[0]}`,
                    content: report,
                    authorType: "agent",
                    authorAgentId: authorMember?.agentId ?? null,
                    category: reportCfg.category ?? "performance-report"
                }
            });
            reportPostId = post.id;
        }
    }

    await prisma.pulseEvaluation.create({
        data: {
            pulseId: pulse.id,
            windowStart,
            windowEnd,
            rankingsJson: rankings,
            actionsJson: actions,
            reportPostId: reportPostId ?? null
        }
    });

    return {
        rankings,
        actions,
        report,
        reportPostId,
        autoScore: autoScore ?? undefined
    };
}
