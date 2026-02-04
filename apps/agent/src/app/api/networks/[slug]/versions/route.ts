import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const network = await prisma.network.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const versions = await prisma.networkVersion.findMany({
            where: { networkId: network.id },
            orderBy: { version: "desc" }
        });

        return NextResponse.json({
            success: true,
            versions
        });
    } catch (error) {
        console.error("[Network Versions] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list network versions" },
            { status: 500 }
        );
    }
}
