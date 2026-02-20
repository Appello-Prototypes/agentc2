import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { computeDiff } from "@repo/agentc2/bim";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(request: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { fromVersionId, toVersionId, includeChanges } = await request.json();
        if (!fromVersionId || !toVersionId) {
            return NextResponse.json(
                { error: "fromVersionId and toVersionId are required" },
                { status: 400 }
            );
        }

        const result = await computeDiff({ fromVersionId, toVersionId, includeChanges });
        const fromVersion = await prisma.bimModelVersion.findUnique({
            where: { id: fromVersionId },
            select: { modelId: true }
        });

        const record = await prisma.bimDiffSummary.create({
            data: {
                modelId: fromVersion?.modelId,
                fromVersionId,
                toVersionId,
                summary: result
            }
        });

        return NextResponse.json({ success: true, recordId: record.id, result });
    } catch (error) {
        console.error("[BIM Diff] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to compute diff" },
            { status: 500 }
        );
    }
}
