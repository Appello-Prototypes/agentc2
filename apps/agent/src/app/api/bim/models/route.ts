import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET() {
    try {
        const models = await prisma.bimModel.findMany({
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
