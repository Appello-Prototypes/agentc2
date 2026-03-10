import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requirePulseAccess } from "@/lib/authz";

type RouteContext = { params: Promise<{ pulseId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId } = await context.params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get("status");

        const milestones = await prisma.pulseMilestone.findMany({
            where: {
                pulseId,
                ...(status ? { status } : {})
            },
            orderBy: { sortOrder: "asc" },
            include: {
                _count: { select: { tasks: true } }
            }
        });

        const mapped = milestones.map((m) => ({
            ...m,
            taskCount: m._count.tasks,
            _count: undefined
        }));

        return NextResponse.json({ success: true, milestones: mapped });
    } catch (error) {
        console.error("[pulse/milestones] GET error:", error);
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

        const { pulseId } = await context.params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const body = await request.json();
        const { title, description, targetMetric, targetValue, dueDate, sortOrder } = body;

        if (!title) {
            return NextResponse.json(
                { success: false, error: "title is required" },
                { status: 400 }
            );
        }

        const milestone = await prisma.pulseMilestone.create({
            data: {
                pulseId,
                title,
                description: description ?? null,
                targetMetric: targetMetric ?? null,
                targetValue: targetValue ?? null,
                dueDate: dueDate ? new Date(dueDate) : null,
                sortOrder: sortOrder ?? 0
            }
        });

        return NextResponse.json({ success: true, milestone }, { status: 201 });
    } catch (error) {
        console.error("[pulse/milestones] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
