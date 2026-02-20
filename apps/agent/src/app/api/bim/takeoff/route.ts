import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { computeTakeoff } from "@repo/agentc2/bim";
import { getDemoSession } from "@/lib/standalone-auth";

export async function POST(request: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const {
            modelId,
            versionId: providedVersionId,
            scope,
            filters,
            groupBy
        } = await request.json();

        // Resolve versionId: use provided versionId, or find latest version for modelId
        let versionId = providedVersionId;
        let resolvedModelId = modelId;

        if (!versionId) {
            if (!modelId) {
                return NextResponse.json(
                    { error: "modelId or versionId is required" },
                    { status: 400 }
                );
            }

            // Find the latest version for this model
            const latestVersion = await prisma.bimModelVersion.findFirst({
                where: { modelId },
                orderBy: { createdAt: "desc" },
                select: { id: true }
            });

            if (!latestVersion) {
                return NextResponse.json(
                    { error: "No versions found for this model" },
                    { status: 404 }
                );
            }

            versionId = latestVersion.id;
        } else {
            // If versionId provided, look up the modelId
            const version = await prisma.bimModelVersion.findUnique({
                where: { id: versionId },
                select: { modelId: true }
            });
            resolvedModelId = version?.modelId;
        }

        const result = await computeTakeoff({ versionId, filters, groupBy });

        const record = await prisma.bimTakeoff.create({
            data: {
                modelId: resolvedModelId,
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
