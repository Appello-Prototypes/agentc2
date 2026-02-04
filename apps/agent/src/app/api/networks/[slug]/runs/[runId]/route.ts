import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string; runId: string }> }
) {
    try {
        const { slug, runId } = await params;
        const network = await prisma.network.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const run = await prisma.networkRun.findUnique({
            where: { id: runId },
            include: { steps: true }
        });

        if (!run || run.networkId !== network.id) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            run
        });
    } catch (error) {
        console.error("[Network Run Detail] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load network run" },
            { status: 500 }
        );
    }
}
