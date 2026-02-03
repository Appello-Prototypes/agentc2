import { prisma } from "../packages/database/src/index";

async function checkRuns() {
    console.log("\n========================================");
    console.log("DATABASE RUNS CHECK");
    console.log("========================================\n");

    // Get recent runs
    const recentRuns = await prisma.agentRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
            agent: { select: { name: true, slug: true } },
            trace: true,
            toolCalls: true,
            evaluation: true
        }
    });

    console.log(`Found ${recentRuns.length} recent runs:\n`);

    for (const run of recentRuns) {
        console.log(`Run: ${run.id}`);
        console.log(`  Agent: ${run.agent?.name || "Unknown"} (${run.agent?.slug})`);
        console.log(`  Type: ${run.runType}, Status: ${run.status}`);
        console.log(`  Source: ${run.source || "NOT SET (old run)"}`);
        console.log(`  SessionId: ${run.sessionId || "NOT SET"}`);
        console.log(`  ThreadId: ${run.threadId || "NOT SET"}`);
        console.log(`  Input: "${run.inputText?.substring(0, 60)}..."`);
        console.log(`  Output: "${run.outputText?.substring(0, 60) || "None"}..."`);
        console.log(`  Duration: ${run.durationMs || 0}ms`);
        console.log(`  Tokens: ${run.totalTokens || 0}`);
        console.log(`  Cost: $${run.costUsd || 0}`);
        console.log(`  Has Trace: ${run.trace ? "YES" : "NO"}`);
        console.log(`  Tool Calls: ${run.toolCalls?.length || 0}`);
        console.log(`  Has Evaluation: ${run.evaluation ? "YES" : "NO"}`);
        console.log(`  Created: ${run.createdAt}`);
        console.log("");
    }

    // Stats
    console.log("\n========================================");
    console.log("SUMMARY STATS");
    console.log("========================================\n");

    const totalRuns = await prisma.agentRun.count();
    const runsWithSource = await prisma.agentRun.count({
        where: { source: { not: null } }
    });
    const prodRuns = await prisma.agentRun.count({
        where: { runType: "PROD" }
    });
    const testRuns = await prisma.agentRun.count({
        where: { runType: "TEST" }
    });
    const traces = await prisma.agentTrace.count();
    const toolCalls = await prisma.agentToolCall.count();
    const evals = await prisma.agentEvaluation.count();

    console.log(`Total Runs: ${totalRuns}`);
    console.log(`  - PROD runs: ${prodRuns}`);
    console.log(`  - TEST runs: ${testRuns}`);
    console.log(`  - With source field: ${runsWithSource}`);
    console.log(`Total Traces: ${traces}`);
    console.log(`Total Tool Calls: ${toolCalls}`);
    console.log(`Total Evaluations: ${evals}`);

    await prisma.$disconnect();
}

checkRuns().catch(console.error);
