import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma, RunStatus } from "@repo/database";
import { parseRunEnvironmentFilter, parseRunTriggerTypeFilter } from "@/lib/run-metadata";

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
        const limit = Number(searchParams.get("limit") || 50);
        const statusFilter = searchParams.get("status");
        const environmentFilter = parseRunEnvironmentFilter(searchParams.get("environment"));
        const triggerTypeFilter = parseRunTriggerTypeFilter(searchParams.get("triggerType"));
        const search = searchParams.get("search")?.trim();
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");

        const where: Prisma.WorkflowRunWhereInput = {
            workflowId: workflow.id
        };

        if (statusFilter) {
            const normalized = statusFilter.toUpperCase();
            if (normalized === "SUSPENDED") {
                where.suspendedAt = { not: null };
            } else {
                const validStatuses = ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"];
                if (validStatuses.includes(normalized)) {
                    where.status = normalized as RunStatus;
                }
            }
        }

        if (environmentFilter) {
            where.environment = environmentFilter;
        }

        if (triggerTypeFilter) {
            where.triggerType = triggerTypeFilter;
        }

        if (fromParam || toParam) {
            const startedAtFilter: Prisma.DateTimeFilter = {};
            if (fromParam) {
                const fromDate = new Date(fromParam);
                if (!Number.isNaN(fromDate.getTime())) {
                    startedAtFilter.gte = fromDate;
                }
            }
            if (toParam) {
                const toDate = new Date(toParam);
                if (!Number.isNaN(toDate.getTime())) {
                    startedAtFilter.lte = toDate;
                }
            }
            if (Object.keys(startedAtFilter).length > 0) {
                where.startedAt = startedAtFilter;
            }
        }

        if (search) {
            where.OR = [
                {
                    id: {
                        contains: search,
                        mode: "insensitive"
                    }
                }
            ];
        }

        const runs = await prisma.workflowRun.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            include: { _count: { select: { steps: true } } }
        });

        return NextResponse.json({
            success: true,
            runs: runs.map((run) => ({
                id: run.id,
                status: run.status,
                inputJson: run.inputJson,
                outputJson: run.outputJson,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
                suspendedAt: run.suspendedAt,
                suspendedStep: run.suspendedStep,
                durationMs: run.durationMs,
                environment: run.environment,
                triggerType: run.triggerType,
                stepsCount: run._count?.steps ?? 0
            }))
        });
    } catch (error) {
        console.error("[Workflow Runs] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list workflow runs" },
            { status: 500 }
        );
    }
}
