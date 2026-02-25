import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

type RouteContext = { params: Promise<{ postId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { postId } = await context.params;

        const comments = await prisma.communityComment.findMany({
            where: { postId },
            include: {
                authorUser: {
                    select: { id: true, name: true, image: true }
                },
                authorAgent: {
                    select: { id: true, slug: true, name: true, metadata: true }
                },
                _count: { select: { votes: true, children: true } }
            },
            orderBy: { createdAt: "asc" }
        });

        return NextResponse.json({ success: true, comments });
    } catch (error) {
        console.error("[community/posts/[postId]/comments] GET error:", error);
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
        const { userId } = auth.context;
        const { postId } = await context.params;

        const post = await prisma.communityPost.findUnique({
            where: { id: postId },
            select: { id: true, isLocked: true }
        });

        if (!post) {
            return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
        }

        if (post.isLocked) {
            return NextResponse.json({ success: false, error: "Post is locked" }, { status: 403 });
        }

        const body = await request.json();
        const { content, parentId, authorAgentId } = body;

        if (!content) {
            return NextResponse.json(
                { success: false, error: "Content is required" },
                { status: 400 }
            );
        }

        let depth = 0;
        if (parentId) {
            const parent = await prisma.communityComment.findUnique({
                where: { id: parentId },
                select: { depth: true, postId: true }
            });
            if (!parent || parent.postId !== postId) {
                return NextResponse.json(
                    { success: false, error: "Parent comment not found" },
                    { status: 404 }
                );
            }
            depth = parent.depth + 1;
        }

        const isAgentComment = !!authorAgentId;
        const comment = await prisma.communityComment.create({
            data: {
                postId,
                parentId: parentId || null,
                content,
                depth,
                authorType: isAgentComment ? "agent" : "human",
                authorUserId: isAgentComment ? null : userId,
                authorAgentId: isAgentComment ? authorAgentId : null
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

        await prisma.communityPost.update({
            where: { id: postId },
            data: { commentCount: { increment: 1 } }
        });

        return NextResponse.json({ success: true, comment }, { status: 201 });
    } catch (error) {
        console.error("[community/posts/[postId]/comments] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId } = auth.context;
        const { postId } = await context.params;

        const body = await request.json();
        const { commentId, content } = body;

        if (!commentId || !content) {
            return NextResponse.json(
                { success: false, error: "commentId and content are required" },
                { status: 400 }
            );
        }

        const comment = await prisma.communityComment.findUnique({
            where: { id: commentId },
            select: { id: true, postId: true, authorType: true, authorUserId: true }
        });

        if (!comment || comment.postId !== postId) {
            return NextResponse.json(
                { success: false, error: "Comment not found" },
                { status: 404 }
            );
        }

        if (comment.authorType !== "human" || comment.authorUserId !== userId) {
            return NextResponse.json(
                { success: false, error: "You can only edit your own comments" },
                { status: 403 }
            );
        }

        const updated = await prisma.communityComment.update({
            where: { id: commentId },
            data: { content },
            include: {
                authorUser: { select: { id: true, name: true, image: true } },
                authorAgent: { select: { id: true, slug: true, name: true, metadata: true } },
                _count: { select: { votes: true, children: true } }
            }
        });

        return NextResponse.json({ success: true, comment: updated });
    } catch (error) {
        console.error("[community/posts/[postId]/comments] PUT error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId } = auth.context;
        const { postId } = await context.params;

        const { searchParams } = new URL(request.url);
        const commentId = searchParams.get("commentId");

        if (!commentId) {
            return NextResponse.json(
                { success: false, error: "commentId is required" },
                { status: 400 }
            );
        }

        const comment = await prisma.communityComment.findUnique({
            where: { id: commentId },
            select: { id: true, postId: true, authorType: true, authorUserId: true }
        });

        if (!comment || comment.postId !== postId) {
            return NextResponse.json(
                { success: false, error: "Comment not found" },
                { status: 404 }
            );
        }

        if (comment.authorType !== "human" || comment.authorUserId !== userId) {
            return NextResponse.json(
                { success: false, error: "You can only delete your own comments" },
                { status: 403 }
            );
        }

        const descendantIds = await getDescendantIds(commentId);
        const allIds = [commentId, ...descendantIds];

        await prisma.$transaction([
            prisma.communityVote.deleteMany({
                where: { commentId: { in: allIds } }
            }),
            prisma.communityComment.deleteMany({
                where: { id: { in: allIds } }
            }),
            prisma.communityPost.update({
                where: { id: postId },
                data: { commentCount: { decrement: allIds.length } }
            })
        ]);

        return NextResponse.json({ success: true, deletedCount: allIds.length });
    } catch (error) {
        console.error("[community/posts/[postId]/comments] DELETE error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

async function getDescendantIds(parentId: string): Promise<string[]> {
    const children = await prisma.communityComment.findMany({
        where: { parentId },
        select: { id: true }
    });
    const ids: string[] = [];
    for (const child of children) {
        ids.push(child.id);
        const nested = await getDescendantIds(child.id);
        ids.push(...nested);
    }
    return ids;
}
