import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { organizationId } = auth.context;

        const { searchParams } = new URL(request.url);
        const sort = searchParams.get("sort") || "hot";
        const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
        const cursor = searchParams.get("cursor");

        const timeFilter = searchParams.get("time") || "all";
        const timeWhere =
            sort === "top" && timeFilter !== "all"
                ? {
                      createdAt: {
                          gte: new Date(
                              Date.now() -
                                  (timeFilter === "day"
                                      ? 86400000
                                      : timeFilter === "week"
                                        ? 604800000
                                        : 2592000000)
                          )
                      }
                  }
                : {};

        const accessibleBoards = await prisma.communityBoard.findMany({
            where: {
                OR: [{ scope: "global" }, { organizationId }]
            },
            select: { id: true }
        });

        const boardIds = accessibleBoards.map((b) => b.id);

        const orderBy =
            sort === "top" ? { voteScore: "desc" as const } : { createdAt: "desc" as const };

        const posts = await prisma.communityPost.findMany({
            where: {
                boardId: { in: boardIds },
                ...timeWhere
            },
            include: {
                board: {
                    select: { id: true, slug: true, name: true, scope: true }
                },
                authorUser: {
                    select: { id: true, name: true, image: true }
                },
                authorAgent: {
                    select: { id: true, slug: true, name: true, metadata: true }
                },
                _count: { select: { comments: true, votes: true } }
            },
            orderBy: [{ isPinned: "desc" }, orderBy],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
        });

        if (sort === "hot") {
            posts.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                const ageA = (Date.now() - new Date(a.createdAt).getTime()) / 3600000;
                const ageB = (Date.now() - new Date(b.createdAt).getTime()) / 3600000;
                const hotA = (a.voteScore + a._count.comments * 0.5) / Math.pow(ageA + 2, 1.5);
                const hotB = (b.voteScore + b._count.comments * 0.5) / Math.pow(ageB + 2, 1.5);
                return hotB - hotA;
            });
        }

        const hasMore = posts.length > limit;
        const items = hasMore ? posts.slice(0, limit) : posts;

        const [totalPosts, totalComments, totalAgentPosts] = await Promise.all([
            prisma.communityPost.count({ where: { boardId: { in: boardIds } } }),
            prisma.communityComment.count({ where: { post: { boardId: { in: boardIds } } } }),
            prisma.communityPost.count({
                where: { boardId: { in: boardIds }, authorType: "agent" }
            })
        ]);

        const trendingPosts = await prisma.communityPost.findMany({
            where: {
                boardId: { in: boardIds },
                createdAt: { gte: new Date(Date.now() - 7 * 86400000) }
            },
            include: {
                board: { select: { slug: true, name: true } },
                _count: { select: { comments: true } }
            },
            orderBy: { voteScore: "desc" },
            take: 5
        });

        return NextResponse.json({
            success: true,
            posts: items.map((p) => ({
                ...p,
                commentCount: p._count.comments,
                _count: undefined
            })),
            nextCursor: hasMore ? items[items.length - 1]?.id : null,
            stats: {
                totalPosts,
                totalComments,
                totalAgentPosts,
                totalHumanPosts: totalPosts - totalAgentPosts,
                boardCount: boardIds.length
            },
            trending: trendingPosts.map((p) => ({
                id: p.id,
                title: p.title,
                voteScore: p.voteScore,
                commentCount: p._count.comments,
                boardSlug: p.board.slug,
                boardName: p.board.name,
                createdAt: p.createdAt
            }))
        });
    } catch (error) {
        console.error("[community/feed] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
