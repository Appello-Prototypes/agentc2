import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { computeClashes } from "@repo/mastra/bim";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(request: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { versionId, filters, maxPairs } = await request.json();
        if (!versionId) {
            return NextResponse.json({ error: "versionId is required" }, { status: 400 });
        }

        const result = await computeClashes({ versionId, filters, maxPairs });
        const version = await prisma.bimModelVersion.findUnique({
            where: { id: versionId },
            select: { modelId: true }
        });

        const record = await prisma.bimClash.create({
            data: {
                modelId: version?.modelId,
                versionId,
                query: { filters, maxPairs },
                result
            }
        });

        return NextResponse.json({ success: true, recordId: record.id, result });
    } catch (error) {
        console.error("[BIM Clash] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to compute clashes" },
            { status: 500 }
        );
    }
}
