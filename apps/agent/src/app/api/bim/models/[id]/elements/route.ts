import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { queryBimElements } from "@repo/mastra/bim";

function parseListParam(value: string | null) {
    if (!value) {
        return undefined;
    }
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const searchParams = request.nextUrl.searchParams;
        const versionIdParam = searchParams.get("versionId");

        let versionId = versionIdParam;
        if (!versionId) {
            const latestVersion = await prisma.bimModelVersion.findFirst({
                where: { modelId: id },
                orderBy: { version: "desc" }
            });
            versionId = latestVersion?.id || null;
        }

        if (!versionId) {
            return NextResponse.json({ error: "Model version not found" }, { status: 404 });
        }

        const limitParam = Number(searchParams.get("limit"));
        const offsetParam = Number(searchParams.get("offset"));
        const limit = Number.isFinite(limitParam) ? limitParam : 200;
        const offset = Number.isFinite(offsetParam) ? offsetParam : 0;

        const result = await queryBimElements({
            versionId,
            limit,
            offset,
            includeProperties: searchParams.get("includeProperties") === "true",
            includeGeometry: searchParams.get("includeGeometry") !== "false",
            filters: {
                categories: parseListParam(searchParams.get("categories")),
                systems: parseListParam(searchParams.get("systems")),
                levels: parseListParam(searchParams.get("levels")),
                types: parseListParam(searchParams.get("types")),
                search: searchParams.get("search") || undefined
            }
        });

        return NextResponse.json({ success: true, versionId, ...result });
    } catch (error) {
        console.error("[BIM Elements] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to query BIM elements" },
            { status: 500 }
        );
    }
}
