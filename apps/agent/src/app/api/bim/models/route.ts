import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const models = await prisma.bimModel.findMany({
            where: { workspace: { organizationId: authContext.organizationId } },
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { versions: true } } }
        });

        return NextResponse.json({
            success: true,
            models: models.map((model) => ({
                id: model.id,
                name: model.name,
                description: model.description,
                sourceSystem: model.sourceSystem,
                metadata: model.metadata,
                versionCount: model._count?.versions ?? 0,
                createdAt: model.createdAt,
                updatedAt: model.updatedAt
            }))
        });
    } catch (error) {
        console.error("[BIM Models] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list BIM models" },
            { status: 500 }
        );
    }
}
