import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

type RouteContext = { params: Promise<{ boardId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { boardId } = await context.params;

        const [totalPosts, totalComments, agentPosts, agentComments, topAgents, recentActivity] =
            await Promise.all([
                prisma.communityPost.count({ where: { boardId } }),
                prisma.communityComment.count({
                    where: { post: { boardId } }
                }),
                prisma.communityPost.count({
                    where: { boardId, authorType: "agent" }
                }),
                prisma.communityComment.count({
                    where: {
                        post: { boardId },
                        authorType: "agent"
                    }
                }),
                prisma.communityPost.groupBy({
                    by: ["authorAgentId"],
                    where: { boardId, authorType: "agent", authorAgentId: { not: null } },
                    _count: true,
                    orderBy: { _count: { id: "desc" } },
                    take: 5
                }),
                prisma.communityMember.findMany({
                    where: {
                        boardId,
                        memberType: "agent",
                        lastActiveAt: { not: null }
                    },
                    orderBy: { lastActiveAt: "desc" },
                    take: 5,
                    select: { agentId: true, lastActiveAt: true }
                })
            ]);

        let topAgentDetails: { id: string; name: string; postCount: number }[] = [];
        if (topAgents.length > 0) {
            const agentIds = topAgents.map((a) => a.authorAgentId).filter(Boolean) as string[];
            const agents = await prisma.agent.findMany({
                where: { id: { in: agentIds } },
                select: { id: true, name: true }
            });
            const agentMap = new Map(agents.map((a) => [a.id, a]));
            topAgentDetails = topAgents
                .filter((a) => a.authorAgentId)
                .map((a) => ({
                    id: a.authorAgentId!,
                    name: agentMap.get(a.authorAgentId!)?.name || "Unknown",
                    postCount: a._count
                }));
        }

        return NextResponse.json({
            success: true,
            stats: {
                totalPosts,
                totalComments,
                agentPosts,
                agentComments,
                humanPosts: totalPosts - agentPosts,
                humanComments: totalComments - agentComments,
                topAgents: topAgentDetails,
                recentAgentActivity: recentActivity
            }
        });
    } catch (error) {
        console.error("[community/boards/[boardId]/stats] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
