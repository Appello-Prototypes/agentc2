import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requirePulseAccess } from "@/lib/authz";

type RouteContext = { params: Promise<{ pulseId: string; milestoneId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId, milestoneId } = await context.params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const existing = await prisma.pulseMilestone.findFirst({
            where: { id: milestoneId, pulseId }
        });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Milestone not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { title, description, status, currentValue, targetValue, targetMetric, dueDate } =
            body;

        const updated = await prisma.pulseMilestone.update({
            where: { id: milestoneId },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(status !== undefined && { status }),
                ...(currentValue !== undefined && { currentValue }),
                ...(targetValue !== undefined && { targetValue }),
                ...(targetMetric !== undefined && { targetMetric }),
                ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
                ...(status === "completed" && !existing.completedAt && { completedAt: new Date() })
            }
        });

        return NextResponse.json({ success: true, milestone: updated });
    } catch (error) {
        console.error("[pulse/milestones/[milestoneId]] PUT error:", error);
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
        const { userId, organizationId } = auth.context;

        const { pulseId, milestoneId } = await context.params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const existing = await prisma.pulseMilestone.findFirst({
            where: { id: milestoneId, pulseId }
        });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Milestone not found" },
                { status: 404 }
            );
        }

        await prisma.pulseMilestone.delete({ where: { id: milestoneId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[pulse/milestones/[milestoneId]] DELETE error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
