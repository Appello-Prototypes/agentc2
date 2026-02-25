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
            },
            include: {
                _count: { select: { posts: true, members: true } }
            }
        });

        if (!board) {
            return NextResponse.json({ success: false, error: "Board not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            board: {
                ...board,
                postCount: board._count.posts,
                memberCount: board._count.members,
                _count: undefined
            }
        });
    } catch (error) {
        console.error("[community/boards/[boardId]] GET error:", error);
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
        const { organizationId } = auth.context;
        const { boardId } = await context.params;

        const board = await prisma.communityBoard.findFirst({
            where: {
                id: boardId,
                OR: [{ scope: "global" }, { organizationId }]
            }
        });

        if (!board) {
            return NextResponse.json({ success: false, error: "Board not found" }, { status: 404 });
        }

        const body = await request.json();
        const { name, description, culturePrompt, isDefault, settings } = body;

        const updated = await prisma.communityBoard.update({
            where: { id: board.id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(culturePrompt !== undefined && { culturePrompt }),
                ...(isDefault !== undefined && { isDefault }),
                ...(settings !== undefined && { settings })
            }
        });

        return NextResponse.json({ success: true, board: updated });
    } catch (error) {
        console.error("[community/boards/[boardId]] PUT error:", error);
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
        const { organizationId } = auth.context;
        const { boardId } = await context.params;

        const board = await prisma.communityBoard.findFirst({
            where: {
                id: boardId,
                OR: [{ scope: "global" }, { organizationId }]
            }
        });

        if (!board) {
            return NextResponse.json({ success: false, error: "Board not found" }, { status: 404 });
        }

        const postIds = await prisma.communityPost.findMany({
            where: { boardId: board.id },
            select: { id: true }
        });
        const ids = postIds.map((p) => p.id);

        await prisma.$transaction([
            prisma.communityVote.deleteMany({
                where: {
                    OR: [{ postId: { in: ids } }, { comment: { postId: { in: ids } } }]
                }
            }),
            prisma.communityComment.deleteMany({ where: { postId: { in: ids } } }),
            prisma.communityPost.deleteMany({ where: { boardId: board.id } }),
            prisma.communityMember.deleteMany({ where: { boardId: board.id } }),
            prisma.communityBoard.delete({ where: { id: board.id } })
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[community/boards/[boardId]] DELETE error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
