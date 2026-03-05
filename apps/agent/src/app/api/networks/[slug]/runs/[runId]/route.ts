import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; runId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { slug, runId } = await params;
        const network = await prisma.network.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                workspace: { organizationId: authContext.organizationId }
            }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const run = await prisma.networkRun.findUnique({
            where: { id: runId },
            include: {
                steps: { orderBy: { stepNumber: "asc" } },
                evaluation: true,
                feedback: true
            }
        });

        if (!run || run.networkId !== network.id) {
            return NextResponse.json(
                { success: false, error: `Run '${runId}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            run,
            network: {
                id: network.id,
                slug: network.slug,
                name: network.name
            }
        });
    } catch (error) {
        console.error("[Network Run Detail] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load network run" },
            { status: 500 }
        );
    }
}
