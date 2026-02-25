import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

type RouteContext = { params: Promise<{ boardId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { organizationId } = auth.context;
        const { boardId } = await context.params;

        const board = await prisma.communityBoard.findFirst({
            where: {
                OR: [{ id: boardId }, { slug: boardId }],
                AND: {
                    OR: [{ scope: "global" }, { organizationId }]
                }
            }
        });

        if (!board) {
            return NextResponse.json({ success: false, error: "Board not found" }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const sort = searchParams.get("sort") || "new";
        const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
        const cursor = searchParams.get("cursor");
        const category = searchParams.get("category");
        const excludeAuthorAgentId = searchParams.get("excludeAuthorAgentId");

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

        const orderBy =
            sort === "top" ? { voteScore: "desc" as const } : { createdAt: "desc" as const };

        const posts = await prisma.communityPost.findMany({
            where: {
                boardId: board.id,
                ...(category ? { category } : {}),
                ...(excludeAuthorAgentId ? { NOT: { authorAgentId: excludeAuthorAgentId } } : {}),
                ...timeWhere
            },
            include: {
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

        // Hot sort: rank by score-weighted recency (Reddit-style)
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

        return NextResponse.json({
            success: true,
            posts: items.map((p) => ({
                ...p,
                commentCount: p._count.comments,
                _count: undefined
            })),
            nextCursor: hasMore ? items[items.length - 1]?.id : null
        });
    } catch (error) {
        console.error("[community/boards/[boardId]/posts] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;
        const { boardId } = await context.params;

        const board = await prisma.communityBoard.findFirst({
            where: {
                OR: [{ id: boardId }, { slug: boardId }],
                AND: {
                    OR: [{ scope: "global" }, { organizationId }]
                }
            }
        });

        if (!board) {
            return NextResponse.json({ success: false, error: "Board not found" }, { status: 404 });
        }

        const body = await request.json();
        const { title, content, category, authorAgentId } = body;

        if (!title || !content) {
            return NextResponse.json(
                { success: false, error: "Title and content are required" },
                { status: 400 }
            );
        }

        if (authorAgentId) {
            const recentPosts = await prisma.communityPost.findMany({
                where: {
                    boardId: board.id,
                    authorAgentId,
                    createdAt: { gte: new Date(Date.now() - 3600000) }
                },
                select: { id: true, title: true },
                orderBy: { createdAt: "desc" }
            });

            const normalise = (s: string) =>
                s
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, "")
                    .trim();
            const normTitle = normalise(title);
            const duplicate = recentPosts.find((p) => {
                const normExisting = normalise(p.title);
                if (normExisting === normTitle) return true;
                const words = normTitle.split(/\s+/);
                const existingWords = normExisting.split(/\s+/);
                if (words.length === 0 || existingWords.length === 0) return false;
                const overlap = words.filter((w) => existingWords.includes(w)).length;
                return overlap / Math.max(words.length, existingWords.length) > 0.7;
            });

            if (duplicate) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `A similar post already exists: "${duplicate.title}". Try a different topic.`
                    },
                    { status: 409 }
                );
            }
        }

        const isAgentPost = !!authorAgentId;
        const post = await prisma.communityPost.create({
            data: {
                boardId: board.id,
                title,
                content,
                category: category || null,
                authorType: isAgentPost ? "agent" : "human",
                authorUserId: isAgentPost ? null : userId,
                authorAgentId: isAgentPost ? authorAgentId : null
            },
            include: {
                authorUser: {
                    select: { id: true, name: true, image: true }
                },
                authorAgent: {
                    select: { id: true, slug: true, name: true, metadata: true }
                }
            }
        });

        await prisma.communityBoard.update({
            where: { id: board.id },
            data: { postCount: { increment: 1 } }
        });

        return NextResponse.json({ success: true, post }, { status: 201 });
    } catch (error) {
        console.error("[community/boards/[boardId]/posts] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
