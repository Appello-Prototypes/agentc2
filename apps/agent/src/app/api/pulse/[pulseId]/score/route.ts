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

        const pulse = await prisma.pulse.findUnique({
            where: { id: pulseId },
            select: {
                scoreFunction: true,
                scoreFunctionType: true,
                scoreDirection: true,
                currentScore: true,
                targetScore: true,
                scoreHistory: true
            }
        });

        if (!pulse) {
            return NextResponse.json({ success: false, error: "Pulse not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, score: pulse });
    } catch (error) {
        console.error("[pulse/score] GET error:", error);
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
        const { score, notes, source } = body;

        if (score === undefined || score === null) {
            return NextResponse.json(
                { success: false, error: "score is required" },
                { status: 400 }
            );
        }

        const pulse = await prisma.pulse.findUnique({
            where: { id: pulseId },
            select: { scoreHistory: true }
        });
        if (!pulse) {
            return NextResponse.json({ success: false, error: "Pulse not found" }, { status: 404 });
        }

        const existingHistory = (pulse.scoreHistory as Array<Record<string, unknown>>) ?? [];
        const newEntry = {
            date: new Date().toISOString(),
            value: score,
            source: source ?? "manual",
            notes: notes ?? null
        };

        const updated = await prisma.pulse.update({
            where: { id: pulseId },
            data: {
                currentScore: score,
                scoreHistory: [...existingHistory, newEntry]
            },
            select: {
                currentScore: true,
                targetScore: true,
                scoreDirection: true,
                scoreHistory: true
            }
        });

        return NextResponse.json({ success: true, score: updated });
    } catch (error) {
        console.error("[pulse/score] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
