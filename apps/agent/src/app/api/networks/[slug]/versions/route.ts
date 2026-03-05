import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { slug } = await params;
        const network = await prisma.network.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                workspace: { organizationId: authContext.organizationId }
            }
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
