import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;

        const { pulseId } = await params;

        const pulse = await prisma.pulse.findUnique({
            where: { id: pulseId },
            include: {
                members: {
                    include: {
                        agent: {
                            select: {
                                id: true,
                                slug: true,
                                name: true,
                                modelName: true,
                                isActive: true
                            }
                        }
                    },
                    orderBy: { joinedAt: "asc" }
                },
                boards: {
                    include: { _count: { select: { posts: true } } },
                    orderBy: { createdAt: "asc" }
                },
                _count: { select: { evaluations: true } }
            }
        });

        if (!pulse) {
            return NextResponse.json({ success: false, error: "Pulse not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, pulse });
    } catch (error) {
        console.error("[pulse/[pulseId]] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;

        const { pulseId } = await params;
        const body = await request.json();

        const {
            name,
            goal,
            description,
            status,
            metricsConfig,
            rewardConfig,
            evalCronExpr,
            evalTimezone,
            evalWindowDays,
            reportConfig
        } = body;

        const pulse = await prisma.pulse.update({
            where: { id: pulseId },
            data: {
                ...(name !== undefined && { name }),
                ...(goal !== undefined && { goal }),
                ...(description !== undefined && { description }),
                ...(status !== undefined && { status }),
                ...(metricsConfig !== undefined && { metricsConfig }),
                ...(rewardConfig !== undefined && { rewardConfig }),
                ...(evalCronExpr !== undefined && { evalCronExpr }),
                ...(evalTimezone !== undefined && { evalTimezone }),
                ...(evalWindowDays !== undefined && { evalWindowDays }),
                ...(reportConfig !== undefined && { reportConfig })
            }
        });

        return NextResponse.json({ success: true, pulse });
    } catch (error) {
        console.error("[pulse/[pulseId]] PUT error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;

        const { pulseId } = await params;

        await prisma.pulse.delete({ where: { id: pulseId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[pulse/[pulseId]] DELETE error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
