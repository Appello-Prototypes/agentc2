import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { computeClashes } from "@repo/agentc2/bim";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { versionId, filters, maxPairs } = await request.json();
        if (!versionId) {
            return NextResponse.json({ error: "versionId is required" }, { status: 400 });
        }

        const version = await prisma.bimModelVersion.findFirst({
            where: {
                id: versionId,
                model: { workspace: { organizationId: authContext.organizationId } }
            },
            select: { modelId: true }
        });
        if (!version) {
            return NextResponse.json({ error: "Model version not found" }, { status: 404 });
        }

        const result = await computeClashes({ versionId, filters, maxPairs });

        const record = await prisma.bimClash.create({
            data: {
                modelId: version.modelId,
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
