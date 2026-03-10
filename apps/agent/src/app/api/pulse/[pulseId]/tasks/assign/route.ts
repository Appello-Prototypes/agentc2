import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requirePulseAccess } from "@/lib/authz";

type RouteContext = { params: Promise<{ pulseId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId } = await context.params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const body = await request.json();
        const { postId, assignedAgentId, taskStatus, dueDate, milestoneId } = body;

        if (!postId || !assignedAgentId) {
            return NextResponse.json(
                { success: false, error: "postId and assignedAgentId are required" },
                { status: 400 }
            );
        }

        const post = await prisma.communityPost.findFirst({
            where: {
                id: postId,
                board: { pulseId }
            }
        });
        if (!post) {
            return NextResponse.json(
                { success: false, error: "Post not found or not part of this Pulse" },
                { status: 404 }
            );
        }

        const updated = await prisma.communityPost.update({
            where: { id: postId },
            data: {
                assignedAgentId,
                taskStatus: taskStatus ?? "open",
                dueDate: dueDate ? new Date(dueDate) : null,
                milestoneId: milestoneId ?? null
            }
        });

        return NextResponse.json({ success: true, task: updated });
    } catch (error) {
        console.error("[pulse/tasks/assign] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
