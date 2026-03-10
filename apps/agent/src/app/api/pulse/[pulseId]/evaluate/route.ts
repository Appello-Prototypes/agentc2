import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requirePulseAccess } from "@/lib/authz";
import { evaluatePulseMembers } from "@repo/agentc2";
import type { PulseWithMembers } from "@repo/agentc2";

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

        const pulse = await prisma.pulse.findUnique({
            where: { id: pulseId },
            include: {
                members: {
                    include: {
                        agent: {
                            select: { id: true, slug: true, name: true, maxSteps: true }
                        }
                    }
                }
            }
        });

        if (!pulse) {
            return NextResponse.json({ success: false, error: "Pulse not found" }, { status: 404 });
        }

        if (pulse.members.length === 0) {
            return NextResponse.json(
                { success: false, error: "No members to evaluate" },
                { status: 400 }
            );
        }

        const windowEnd = new Date();
        const windowStart = new Date(windowEnd.getTime() - pulse.evalWindowDays * 86400000);

        const result = await evaluatePulseMembers(
            pulse as unknown as PulseWithMembers,
            windowStart,
            windowEnd
        );

        return NextResponse.json({
            success: true,
            rankings: result.rankings,
            actions: result.actions,
            report: result.report,
            autoScore: result.autoScore
        });
    } catch (error) {
        console.error("[pulse/evaluate] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
