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
        const workflow = await prisma.workflow.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                workspace: { organizationId: authContext.organizationId }
            }
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
