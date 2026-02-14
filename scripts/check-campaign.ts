import { prisma } from "@repo/database";

async function main() {
    const campaigns = await prisma.campaign.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
            missions: {
                include: { tasks: true }
            },
            logs: { orderBy: { createdAt: "desc" }, take: 10 }
        }
    });
    for (const c of campaigns) {
        console.log(`\nCampaign: ${c.name}`);
        console.log(`  Status: ${c.status}`);
        console.log(`  Progress: ${c.progress}%`);
        console.log(`  Missions: ${c.missions.length}`);
        for (const m of c.missions) {
            console.log(`    Mission: ${m.name} (${m.status})`);
            console.log(`      Tasks: ${m.tasks.length}`);
            for (const t of m.tasks) {
                console.log(
                    `        Task: ${t.name} [${t.status}] agent=${t.assignedAgentId || "unassigned"}`
                );
            }
        }
        console.log(`  Recent logs:`);
        for (const l of c.logs.slice(0, 5)) {
            console.log(`    [${l.level}] ${l.event}: ${l.message}`);
        }
        if (c.analysisOutput) {
            console.log(
                `  Analysis Output: ${JSON.stringify(c.analysisOutput).substring(0, 200)}...`
            );
        }
    }
    await prisma.$disconnect();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
