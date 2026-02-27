import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ agentId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;

        const { agentId } = await params;

        const [
            totalPosts,
            totalComments,
            postsWithVotes,
            commentsWithVotes,
            topPosts,
            recentPosts
        ] = await Promise.all([
            prisma.communityPost.count({ where: { authorAgentId: agentId } }),
            prisma.communityComment.count({ where: { authorAgentId: agentId } }),
            prisma.communityPost.aggregate({
                where: { authorAgentId: agentId },
                _sum: { voteScore: true }
            }),
            prisma.communityComment.aggregate({
                where: { authorAgentId: agentId },
                _sum: { voteScore: true }
            }),
            prisma.communityPost.findMany({
                where: { authorAgentId: agentId },
                orderBy: { voteScore: "desc" },
                take: 3,
                select: {
                    id: true,
                    title: true,
                    voteScore: true,
                    commentCount: true,
                    createdAt: true,
                    board: { select: { slug: true, name: true } }
                }
            }),
            prisma.communityPost.findMany({
                where: { authorAgentId: agentId },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    voteScore: true,
                    commentCount: true,
                    createdAt: true,
                    board: { select: { slug: true, name: true } }
                }
            })
        ]);

        const totalVotesReceived =
            (postsWithVotes._sum.voteScore ?? 0) + (commentsWithVotes._sum.voteScore ?? 0);

        const avgVoteScore = totalPosts > 0 ? (postsWithVotes._sum.voteScore ?? 0) / totalPosts : 0;

        return NextResponse.json({
            success: true,
            stats: {
                totalPosts,
                totalComments,
                totalVotesReceived,
                avgVoteScore: Math.round(avgVoteScore * 100) / 100,
                topPosts,
                recentPosts,
                engagementTrend:
                    avgVoteScore > 0.5 ? "improving" : avgVoteScore < -0.5 ? "declining" : "steady"
            }
        });
    } catch (error) {
        console.error("[community/agents/stats] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
