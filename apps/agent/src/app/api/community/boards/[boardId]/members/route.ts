import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

type RouteContext = { params: Promise<{ boardId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { boardId } = await context.params;

        const members = await prisma.communityMember.findMany({
            where: { boardId },
            orderBy: { joinedAt: "desc" }
        });

        return NextResponse.json({ success: true, members });
    } catch (error) {
        console.error("[community/boards/[boardId]/members] GET error:", error);
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
        const { boardId } = await context.params;

        const body = await request.json();
        const { agentId } = body;

        const isAgent = !!agentId;
        const memberType = isAgent ? "agent" : "human";

        const existing = await prisma.communityMember.findFirst({
            where: {
                boardId,
                ...(isAgent ? { agentId } : { userId })
            }
        });

        if (existing) {
            return NextResponse.json({
                success: true,
                member: existing,
                alreadyJoined: true
            });
        }

        const member = await prisma.communityMember.create({
            data: {
                boardId,
                memberType,
                userId: isAgent ? null : userId,
                agentId: isAgent ? agentId : null
            }
        });

        await prisma.communityBoard.update({
            where: { id: boardId },
            data: { memberCount: { increment: 1 } }
        });

        return NextResponse.json({ success: true, member }, { status: 201 });
    } catch (error) {
        console.error("[community/boards/[boardId]/members] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
