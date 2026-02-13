import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/agents/[id]/calibration
 *
 * Get calibration stats for an agent -- how well auditor scores align with human feedback.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const checks = await prisma.calibrationCheck.findMany({
            where: {
                agentId: agent.id,
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { createdAt: "desc" }
        });

        if (checks.length === 0) {
            return NextResponse.json({
                success: true,
                stats: null,
                checks: [],
                message: "No calibration data available yet"
            });
        }

        const alignedCount = checks.filter((c) => c.aligned).length;
        const alignmentRate = alignedCount / checks.length;
        const avgDisagreement = checks.reduce((sum, c) => sum + c.disagreement, 0) / checks.length;
        const auditorHigherCount = checks.filter((c) => c.direction === "auditor_higher").length;
        const auditorLowerCount = checks.filter((c) => c.direction === "auditor_lower").length;

        // Compute bias direction
        const avgAuditorGrade = checks.reduce((sum, c) => sum + c.auditorGrade, 0) / checks.length;
        const avgHumanRating = checks.reduce((sum, c) => sum + c.humanRating, 0) / checks.length;
        const bias = avgAuditorGrade - avgHumanRating;

        return NextResponse.json({
            success: true,
            stats: {
                totalChecks: checks.length,
                alignedCount,
                alignmentRate: Math.round(alignmentRate * 100) / 100,
                avgDisagreement: Math.round(avgDisagreement * 1000) / 1000,
                auditorHigherCount,
                auditorLowerCount,
                bias: Math.round(bias * 1000) / 1000,
                biasDirection:
                    bias > 0.05
                        ? "auditor_too_generous"
                        : bias < -0.05
                          ? "auditor_too_harsh"
                          : "well_calibrated",
                driftDetected: alignmentRate < 0.7
            },
            checks: checks.slice(0, 20).map((c) => ({
                id: c.id,
                evaluationId: c.evaluationId,
                auditorGrade: c.auditorGrade,
                humanRating: c.humanRating,
                disagreement: c.disagreement,
                aligned: c.aligned,
                direction: c.direction,
                humanComment: c.humanComment,
                createdAt: c.createdAt
            })),
            dateRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
            }
        });
    } catch (error) {
        console.error("[Calibration Stats] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get calibration stats"
            },
            { status: 500 }
        );
    }
}
