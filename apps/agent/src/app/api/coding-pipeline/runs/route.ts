import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request);
        if (!authResult) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get("status");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

        const where: Record<string, unknown> = {
            organizationId: authResult.organizationId
        };
        if (statusFilter && statusFilter !== "all") {
            where.status = statusFilter;
        }

        const [runs, total, running, completed, failed] = await Promise.all([
            prisma.codingPipelineRun.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit
            }),
            prisma.codingPipelineRun.count({ where }),
            prisma.codingPipelineRun.count({
                where: {
                    ...where,
                    status: {
                        in: [
                            "running",
                            "awaiting_plan_approval",
                            "coding",
                            "verifying",
                            "awaiting_pr_review"
                        ]
                    }
                }
            }),
            prisma.codingPipelineRun.count({
                where: { ...where, status: { in: ["merged", "deployed"] } }
            }),
            prisma.codingPipelineRun.count({
                where: { ...where, status: "failed" }
            })
        ]);

        return NextResponse.json({
            runs,
            stats: {
                total,
                running,
                completed,
                failed,
                avgDurationMinutes: null
            }
        });
    } catch (error) {
        console.error("[CodingPipeline] List runs error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error"
            },
            { status: 500 }
        );
    }
}
