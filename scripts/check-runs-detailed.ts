import { prisma } from "../packages/database/src/index";

async function checkRunsDetailed() {
    console.log("\n========================================");
    console.log("DETAILED RUN DATA");
    console.log("========================================\n");

    // Get the most recent run with full details
    const recentRuns = await prisma.agentRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
            agent: { select: { name: true, slug: true } },
            trace: true,
            toolCalls: true,
            evaluation: true
        }
    });

    for (const run of recentRuns) {
        console.log(`\n========================================`);
        console.log(`Run: ${run.id}`);
        console.log(`Agent: ${run.agent?.name}`);
        console.log(`========================================`);

        console.log(`\n📊 METRICS:`);
        console.log(`  Status: ${run.status}`);
        console.log(`  Duration: ${run.durationMs}ms`);
        console.log(`  Prompt Tokens: ${run.promptTokens}`);
        console.log(`  Completion Tokens: ${run.completionTokens}`);
        console.log(`  Total Tokens: ${run.totalTokens}`);
        console.log(`  Cost: $${run.costUsd || 0}`);
        console.log(`  Model: ${run.modelProvider}/${run.modelName}`);

        if (run.toolCalls && run.toolCalls.length > 0) {
            console.log(`\n🔧 TOOL CALLS (${run.toolCalls.length}):`);
            for (const tc of run.toolCalls) {
                console.log(`  - ${tc.toolKey}`);
                console.log(`    Success: ${tc.success}`);
                console.log(`    Duration: ${tc.durationMs}ms`);
                console.log(`    Input: ${JSON.stringify(tc.inputJson).slice(0, 100)}`);
                if (tc.error) {
                    console.log(`    Error: ${tc.error}`);
                }
            }
        }

        if (run.evaluation) {
            console.log(`\n📈 EVALUATIONS:`);
            console.log(`  Raw scoresJson: ${JSON.stringify(run.evaluation.scoresJson)}`);
            const scores = run.evaluation.scoresJson as Record<string, number> | null;
            if (scores && typeof scores === "object") {
                for (const [name, score] of Object.entries(scores)) {
                    if (typeof score === "number") {
                        const percentage = (score * 100).toFixed(1);
                        console.log(`  ${name}: ${score.toFixed(3)} (${percentage}%)`);
                    } else {
                        console.log(`  ${name}: ${JSON.stringify(score)}`);
                    }
                }
            }
        }

        if (run.trace) {
            console.log(`\n📝 TRACE:`);
            console.log(`  Trace ID: ${run.trace.id}`);
            console.log(`  Status: ${run.trace.status}`);
        }
    }

    await prisma.$disconnect();
}

checkRunsDetailed().catch(console.error);
