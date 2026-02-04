import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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

        const { searchParams } = new URL(request.url);
        const days = Number(searchParams.get("days") || 14);
        const since = new Date();
        since.setDate(since.getDate() - days);
        since.setHours(0, 0, 0, 0);

        const metrics = await prisma.workflowMetricDaily.findMany({
            where: {
                workflowId: workflow.id,
                date: { gte: since }
            },
            orderBy: { date: "asc" }
        });

        return NextResponse.json({
            success: true,
            metrics
        });
    } catch (error) {
        console.error("[Workflow Metrics] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to load workflow metrics" },
            { status: 500 }
        );
    }
}
