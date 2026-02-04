import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { computeTakeoff } from "@repo/mastra";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(request: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { versionId, scope, filters, groupBy } = await request.json();
        if (!versionId) {
            return NextResponse.json({ error: "versionId is required" }, { status: 400 });
        }

        const result = await computeTakeoff({ versionId, filters, groupBy });
        const version = await prisma.bimModelVersion.findUnique({
            where: { id: versionId },
            select: { modelId: true }
        });

        const record = await prisma.bimTakeoff.create({
            data: {
                modelId: version?.modelId,
                versionId,
                scope: scope || null,
                query: { filters, groupBy },
                result
            }
        });

        return NextResponse.json({ success: true, recordId: record.id, result });
    } catch (error) {
        console.error("[BIM Takeoff] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to compute takeoff" },
            { status: 500 }
        );
    }
}
