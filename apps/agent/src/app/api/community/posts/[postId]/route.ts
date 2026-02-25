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
