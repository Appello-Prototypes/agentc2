import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

type RouteContext = { params: Promise<{ postId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { postId } = await context.params;

        const post = await prisma.communityPost.findUnique({
            where: { id: postId },
            include: {
                board: {
                    select: { id: true, slug: true, name: true, scope: true, organizationId: true }
                },
                authorUser: {
                    select: { id: true, name: true, image: true }
                },
                authorAgent: {
                    select: { id: true, slug: true, name: true, metadata: true }
                },
                comments: {
                    include: {
                        authorUser: {
                            select: { id: true, name: true, image: true }
                        },
                        authorAgent: {
                            select: { id: true, slug: true, name: true, metadata: true }
                        },
                        _count: { select: { votes: true } }
                    },
                    orderBy: { createdAt: "asc" }
                },
                _count: { select: { votes: true, comments: true } }
            }
        });

        if (!post) {
            return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, post });
    } catch (error) {
        console.error("[community/posts/[postId]] GET error:", error);
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

        const post = await prisma.communityPost.findUnique({
            where: { id: postId },
            select: { id: true, authorType: true, authorUserId: true }
        });

        if (!post) {
            return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
        }

        if (post.authorType !== "human" || post.authorUserId !== userId) {
            return NextResponse.json(
                { success: false, error: "You can only edit your own posts" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { title, content, category } = body;

        const updated = await prisma.communityPost.update({
            where: { id: postId },
            data: {
                ...(title !== undefined && { title }),
                ...(content !== undefined && { content }),
                ...(category !== undefined && { category: category || null })
            },
            include: {
                board: {
                    select: { id: true, slug: true, name: true, scope: true, organizationId: true }
                },
                authorUser: { select: { id: true, name: true, image: true } },
                authorAgent: { select: { id: true, slug: true, name: true, metadata: true } },
                comments: {
                    include: {
                        authorUser: { select: { id: true, name: true, image: true } },
                        authorAgent: {
                            select: { id: true, slug: true, name: true, metadata: true }
                        },
                        _count: { select: { votes: true } }
                    },
                    orderBy: { createdAt: "asc" }
                },
                _count: { select: { votes: true, comments: true } }
            }
        });

        return NextResponse.json({ success: true, post: updated });
    } catch (error) {
        console.error("[community/posts/[postId]] PUT error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { postId } = await context.params;

        const post = await prisma.communityPost.findUnique({
            where: { id: postId },
            select: { id: true, isPinned: true, isLocked: true }
        });

        if (!post) {
            return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
        }

        const body = await request.json();
        const { isPinned, isLocked } = body;

        const updated = await prisma.communityPost.update({
            where: { id: postId },
            data: {
                ...(isPinned !== undefined && { isPinned }),
                ...(isLocked !== undefined && { isLocked })
            },
            select: { id: true, isPinned: true, isLocked: true }
        });

        return NextResponse.json({ success: true, post: updated });
    } catch (error) {
        console.error("[community/posts/[postId]] PATCH error:", error);
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

        const post = await prisma.communityPost.findUnique({
            where: { id: postId },
            select: { id: true, boardId: true, authorType: true, authorUserId: true }
        });

        if (!post) {
            return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
        }

        if (post.authorType !== "human" || post.authorUserId !== userId) {
            return NextResponse.json(
                { success: false, error: "You can only delete your own posts" },
                { status: 403 }
            );
        }

        await prisma.$transaction([
            prisma.communityVote.deleteMany({
                where: {
                    OR: [{ postId }, { comment: { postId } }]
                }
            }),
            prisma.communityComment.deleteMany({ where: { postId } }),
            prisma.communityPost.delete({ where: { id: postId } }),
            prisma.communityBoard.update({
                where: { id: post.boardId },
                data: { postCount: { decrement: 1 } }
            })
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[community/posts/[postId]] DELETE error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
