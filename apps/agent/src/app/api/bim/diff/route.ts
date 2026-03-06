import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { computeDiff } from "@repo/agentc2/bim";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { fromVersionId, toVersionId, includeChanges } = await request.json();
        if (!fromVersionId || !toVersionId) {
            return NextResponse.json(
                { error: "fromVersionId and toVersionId are required" },
                { status: 400 }
            );
        }

        const fromVersion = await prisma.bimModelVersion.findFirst({
            where: {
                id: fromVersionId,
                model: { workspace: { organizationId: authContext.organizationId } }
            },
            select: { modelId: true }
        });
        if (!fromVersion) {
            return NextResponse.json({ error: "From model version not found" }, { status: 404 });
        }

        const toVersion = await prisma.bimModelVersion.findFirst({
            where: {
                id: toVersionId,
                model: { workspace: { organizationId: authContext.organizationId } }
            },
            select: { id: true }
        });
        if (!toVersion) {
            return NextResponse.json({ error: "To model version not found" }, { status: 404 });
        }

        const result = await computeDiff({ fromVersionId, toVersionId, includeChanges });

        const record = await prisma.bimDiffSummary.create({
            data: {
                modelId: fromVersion.modelId,
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
