import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId } = auth.context;

        const body = await request.json();
        const { targetType, targetId, value, voterAgentId } = body;

        if (!targetType || !targetId || ![1, -1].includes(value)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "targetType, targetId, and value (+1/-1) are required"
                },
                { status: 400 }
            );
        }

        const isAgentVoter = !!voterAgentId;
        const voterUserId = isAgentVoter ? null : userId;
        const effectiveAgentId = isAgentVoter ? voterAgentId : null;

        if (targetType === "post") {
            const post = await prisma.communityPost.findUnique({
                where: { id: targetId },
                select: { id: true }
            });
            if (!post) {
                return NextResponse.json(
                    { success: false, error: "Post not found" },
                    { status: 404 }
                );
            }

            const uniqueField = isAgentVoter ? "postId_voterAgentId" : "postId_voterUserId";
            const uniqueWhere = isAgentVoter
                ? { postId: targetId, voterAgentId: effectiveAgentId! }
                : { postId: targetId, voterUserId: voterUserId! };

            const existing = await prisma.communityVote.findUnique({
                where: { [uniqueField]: uniqueWhere } as never
            });

            if (existing) {
                if (existing.value === value) {
                    await prisma.communityVote.delete({
                        where: { id: existing.id }
                    });
                    await prisma.communityPost.update({
                        where: { id: targetId },
                        data: { voteScore: { decrement: value } }
                    });
                    return NextResponse.json({
                        success: true,
                        action: "removed"
                    });
                }

                await prisma.communityVote.update({
                    where: { id: existing.id },
                    data: { value }
                });
                const scoreDelta = value - existing.value;
                await prisma.communityPost.update({
                    where: { id: targetId },
                    data: { voteScore: { increment: scoreDelta } }
                });
                return NextResponse.json({
                    success: true,
                    action: "changed",
                    value
                });
            }

            await prisma.communityVote.create({
                data: {
                    targetType: "post",
                    postId: targetId,
                    voterType: isAgentVoter ? "agent" : "human",
                    voterUserId,
                    voterAgentId: effectiveAgentId,
                    value
                }
            });
            await prisma.communityPost.update({
                where: { id: targetId },
                data: { voteScore: { increment: value } }
            });
            return NextResponse.json({ success: true, action: "created", value }, { status: 201 });
        }

        if (targetType === "comment") {
            const comment = await prisma.communityComment.findUnique({
                where: { id: targetId },
                select: { id: true }
            });
            if (!comment) {
                return NextResponse.json(
                    { success: false, error: "Comment not found" },
                    { status: 404 }
                );
            }

            const uniqueField = isAgentVoter ? "commentId_voterAgentId" : "commentId_voterUserId";
            const uniqueWhere = isAgentVoter
                ? { commentId: targetId, voterAgentId: effectiveAgentId! }
                : { commentId: targetId, voterUserId: voterUserId! };

            const existing = await prisma.communityVote.findUnique({
                where: { [uniqueField]: uniqueWhere } as never
            });

            if (existing) {
                if (existing.value === value) {
                    await prisma.communityVote.delete({
                        where: { id: existing.id }
                    });
                    await prisma.communityComment.update({
                        where: { id: targetId },
                        data: { voteScore: { decrement: value } }
                    });
                    return NextResponse.json({
                        success: true,
                        action: "removed"
                    });
                }

                await prisma.communityVote.update({
                    where: { id: existing.id },
                    data: { value }
                });
                const scoreDelta = value - existing.value;
                await prisma.communityComment.update({
                    where: { id: targetId },
                    data: { voteScore: { increment: scoreDelta } }
                });
                return NextResponse.json({
                    success: true,
                    action: "changed",
                    value
                });
            }

            await prisma.communityVote.create({
                data: {
                    targetType: "comment",
                    commentId: targetId,
                    voterType: isAgentVoter ? "agent" : "human",
                    voterUserId,
                    voterAgentId: effectiveAgentId,
                    value
                }
            });
            await prisma.communityComment.update({
                where: { id: targetId },
                data: { voteScore: { increment: value } }
            });
            return NextResponse.json({ success: true, action: "created", value }, { status: 201 });
        }

        return NextResponse.json({ success: false, error: "Invalid targetType" }, { status: 400 });
    } catch (error) {
        console.error("[community/votes] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
