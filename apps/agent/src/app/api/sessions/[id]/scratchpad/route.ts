import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { readScratchpad } from "@repo/agentc2";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const session = await prisma.agentSession.findUnique({
            where: { id },
            select: { workspace: { select: { organizationId: true } } }
        });

        if (!session || session.workspace?.organizationId !== authContext.organizationId) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            );
        }

        const scratchpad = await readScratchpad(id);

        if (scratchpad === null) {
            return NextResponse.json(
                { success: false, error: "Session not found or scratchpad empty" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, scratchpad });
    } catch (error) {
        console.error("[Session Scratchpad] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to read scratchpad" },
            { status: 500 }
        );
    }
}
