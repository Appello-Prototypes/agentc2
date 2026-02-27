import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requirePulseAccess } from "@/lib/authz";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId } = await params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const members = await prisma.pulseMember.findMany({
            where: { pulseId },
            include: {
                agent: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        modelProvider: true,
                        modelName: true,
                        isActive: true,
                        maxSteps: true
                    }
                }
            },
            orderBy: { joinedAt: "asc" }
        });

        return NextResponse.json({ success: true, members });
    } catch (error) {
        console.error("[pulse/members] GET error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId } = await params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;
        const body = await request.json();
        const { agentId, role } = body;

        if (!agentId) {
            return NextResponse.json(
                { success: false, error: "agentId is required" },
                { status: 400 }
            );
        }

        const member = await prisma.pulseMember.create({
            data: {
                pulseId,
                agentId,
                role: role ?? "member"
            },
            include: {
                agent: { select: { id: true, slug: true, name: true } }
            }
        });

        return NextResponse.json({ success: true, member }, { status: 201 });
    } catch (error) {
        console.error("[pulse/members] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
