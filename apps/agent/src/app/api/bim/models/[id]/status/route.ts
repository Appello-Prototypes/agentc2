import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const searchParams = request.nextUrl.searchParams;
        const versionIdParam = searchParams.get("versionId");

        let version = null;
        const orgWhere = { model: { workspace: { organizationId: authContext.organizationId } } };
        if (versionIdParam) {
            version = await prisma.bimModelVersion.findFirst({
                where: {
                    id: versionIdParam,
                    modelId: id,
                    ...orgWhere
                }
            });
        } else {
            version = await prisma.bimModelVersion.findFirst({
                where: { modelId: id, ...orgWhere },
                orderBy: { version: "desc" }
            });
        }

        if (!version) {
            return NextResponse.json({ error: "Model version not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            modelId: id,
            versionId: version.id,
            version: version.version,
            status: version.status,
            sourceFormat: version.sourceFormat,
            metadata: version.metadata ?? undefined,
            updatedAt: version.updatedAt
        });
    } catch (error) {
        console.error("[BIM Status] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load BIM status" },
            { status: 500 }
        );
    }
}
