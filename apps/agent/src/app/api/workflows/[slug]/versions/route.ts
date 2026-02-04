import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const workflow = await prisma.workflow.findFirst({
            where: { OR: [{ slug }, { id: slug }] }
        });

        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const versions = await prisma.workflowVersion.findMany({
            where: { workflowId: workflow.id },
            orderBy: { version: "desc" }
        });

        return NextResponse.json({
            success: true,
            versions
        });
    } catch (error) {
        console.error("[Workflow Versions] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list workflow versions" },
            { status: 500 }
        );
    }
}
