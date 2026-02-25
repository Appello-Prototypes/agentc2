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
