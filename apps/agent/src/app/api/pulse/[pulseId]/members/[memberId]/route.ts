import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requirePulseAccess } from "@/lib/authz";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string; memberId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId, memberId } = await params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const existing = await prisma.pulseMember.findFirst({
            where: { id: memberId, pulseId }
        });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Member not found in this pulse" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { role, capacityLevel, maxStepsOverride, frequencyOverride } = body;

        const member = await prisma.pulseMember.update({
            where: { id: memberId },
            data: {
                ...(role !== undefined && { role }),
                ...(capacityLevel !== undefined && { capacityLevel }),
                ...(maxStepsOverride !== undefined && { maxStepsOverride }),
                ...(frequencyOverride !== undefined && { frequencyOverride })
            },
            include: {
                agent: { select: { id: true, slug: true, name: true } }
            }
        });

        return NextResponse.json({ success: true, member });
    } catch (error) {
        console.error("[pulse/members/[memberId]] PUT error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string; memberId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId, memberId } = await params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const existing = await prisma.pulseMember.findFirst({
            where: { id: memberId, pulseId }
        });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Member not found in this pulse" },
                { status: 404 }
            );
        }

        await prisma.pulseMember.delete({ where: { id: memberId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[pulse/members/[memberId]] DELETE error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
