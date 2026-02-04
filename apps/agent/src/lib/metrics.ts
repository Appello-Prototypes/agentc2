import { prisma } from "@repo/database";

function getDateBounds(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { start, end };
}

export async function refreshWorkflowMetrics(workflowId: string, date: Date) {
    const { start, end } = getDateBounds(date);
    const runs = await prisma.workflowRun.findMany({
        where: {
            workflowId,
            createdAt: { gte: start, lt: end }
        },
        include: { _count: { select: { steps: true } } }
    });

    const totalRuns = runs.length;
    const completedRuns = runs.filter((run) => run.status === "COMPLETED").length;
    const suspendedRuns = runs.filter((run) => run.suspendedAt !== null).length;
    const avgDurationMs =
        totalRuns === 0
            ? null
            : Math.round(runs.reduce((sum, run) => sum + (run.durationMs || 0), 0) / totalRuns);
    const avgStepsExecuted =
        totalRuns === 0
            ? null
            : runs.reduce((sum, run) => sum + (run._count?.steps || 0), 0) / totalRuns;

    await prisma.workflowMetricDaily.upsert({
        where: {
            workflowId_date: { workflowId, date: start }
        },
        update: {
            runs: totalRuns,
            successRate: totalRuns === 0 ? null : completedRuns / totalRuns,
            avgDurationMs,
            suspensionRate: totalRuns === 0 ? null : suspendedRuns / totalRuns,
            avgStepsExecuted
        },
        create: {
            workflowId,
            date: start,
            runs: totalRuns,
            successRate: totalRuns === 0 ? null : completedRuns / totalRuns,
            avgDurationMs,
            suspensionRate: totalRuns === 0 ? null : suspendedRuns / totalRuns,
            avgStepsExecuted
        }
    });
}

export async function refreshNetworkMetrics(networkId: string, date: Date) {
    const { start, end } = getDateBounds(date);
    const runs = await prisma.networkRun.findMany({
        where: {
            networkId,
            createdAt: { gte: start, lt: end }
        },
        include: { steps: true }
    });

    const totalRuns = runs.length;
    const completedRuns = runs.filter((run) => run.status === "COMPLETED").length;
    const avgDurationMs =
        totalRuns === 0
            ? null
            : Math.round(runs.reduce((sum, run) => sum + (run.durationMs || 0), 0) / totalRuns);
    const avgStepsExecuted =
        totalRuns === 0
            ? null
            : runs.reduce((sum, run) => sum + (run.steps?.length || 0), 0) / totalRuns;
    const totalCostUsd = runs.reduce((sum, run) => sum + (run.totalCostUsd || 0), 0);

    let agentCallCount = 0;
    let workflowCallCount = 0;
    let toolCallCount = 0;

    runs.forEach((run) => {
        run.steps?.forEach((step) => {
            if (step.primitiveType === "agent") agentCallCount += 1;
            if (step.primitiveType === "workflow") workflowCallCount += 1;
            if (step.primitiveType === "tool") toolCallCount += 1;
        });
    });

    await prisma.networkMetricDaily.upsert({
        where: {
            networkId_date: { networkId, date: start }
        },
        update: {
            runs: totalRuns,
            successRate: totalRuns === 0 ? null : completedRuns / totalRuns,
            avgDurationMs,
            avgStepsExecuted,
            totalCostUsd,
            agentCallCount,
            workflowCallCount,
            toolCallCount
        },
        create: {
            networkId,
            date: start,
            runs: totalRuns,
            successRate: totalRuns === 0 ? null : completedRuns / totalRuns,
            avgDurationMs,
            avgStepsExecuted,
            totalCostUsd,
            agentCallCount,
            workflowCallCount,
            toolCallCount
        }
    });
}
