import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = !process.argv.includes("--apply");

async function main() {
    console.log("=== Backfill: Sync Skill installCount with actual AgentSkill attachments ===");
    console.log(`Mode: ${dryRun ? "DRY RUN (pass --apply to execute)" : "APPLYING CHANGES"}\n`);

    // Get all skills with their agent counts
    const skills = await prisma.skill.findMany({
        select: {
            id: true,
            slug: true,
            installCount: true,
            _count: {
                select: { agents: true }
            }
        }
    });

    console.log(`Found ${skills.length} total skills\n`);

    let fixedCount = 0;
    let correctCount = 0;

    for (const skill of skills) {
        const actualCount = skill._count.agents;
        const currentCount = skill.installCount;

        if (actualCount !== currentCount) {
            console.log(
                `  FIX: ${skill.slug} (${skill.id}) - installCount: ${currentCount} → ${actualCount}`
            );

            if (!dryRun) {
                await prisma.skill.update({
                    where: { id: skill.id },
                    data: { installCount: actualCount }
                });
            }
            fixedCount++;
        } else {
            correctCount++;
        }
    }

    console.log(`\nSummary:`);
    console.log(`  - ${correctCount} skills already correct`);
    console.log(`  - ${fixedCount} skills ${dryRun ? "need fixing" : "fixed"}`);

    if (dryRun) {
        console.log("\n[DRY RUN] No changes applied. Run with --apply to execute.");
    } else {
        console.log("\n✓ Backfill complete!");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
