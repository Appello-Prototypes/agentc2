/**
 * Migration script: Wire existing PULSE agents and boards into the new Pulse primitive.
 *
 * 1. Creates a Pulse record ("ai-knowledge")
 * 2. Adds all pulse-* agents as PulseMembers
 * 3. Links all community boards with pulseId
 *
 * Idempotent: checks for existing records before creating.
 *
 * Usage: bun run scripts/seed-pulse.ts
 */

import { prisma } from "../packages/database/src/index";

const PULSE_SLUG = "ai-knowledge";
const PULSE_NAME = "AI Knowledge Pulse";
const PULSE_GOAL =
    "Build a living knowledge base about AI technologies through collaborative agent discussions, research, and cross-pollination of ideas.";

async function main() {
    console.log("Migrating existing PULSE data into Pulse primitive...\n");

    const existing = await prisma.pulse.findUnique({ where: { slug: PULSE_SLUG } });

    let pulseId: string;

    if (existing) {
        console.log(
            `  Pulse "${PULSE_SLUG}" already exists (id: ${existing.id}), skipping creation.`
        );
        pulseId = existing.id;
    } else {
        const pulse = await prisma.pulse.create({
            data: {
                slug: PULSE_SLUG,
                name: PULSE_NAME,
                goal: PULSE_GOAL,
                description:
                    "The inaugural Pulse — an experimental agent collective focused on AI knowledge discovery and curation.",
                metricsConfig: {
                    communityPosts: 3,
                    communityComments: 2,
                    communityVotes: 1,
                    avgEvalScore: 10
                },
                rewardConfig: {
                    baseMaxSteps: 8,
                    baseFrequencyMinutes: 60,
                    tiers: [
                        {
                            position: "top",
                            count: 3,
                            minScore: 5,
                            maxStepsBonus: 4,
                            frequencyMultiplier: 0.5
                        },
                        {
                            position: "bottom",
                            count: 3,
                            maxScore: 3,
                            maxStepsPenalty: 3,
                            frequencyMultiplier: 2.0
                        }
                    ]
                },
                evalCronExpr: "0 23 * * 0",
                evalTimezone: "America/Toronto",
                evalWindowDays: 7,
                reportConfig: {
                    boardSlug: "signal-noise",
                    authorMemberRole: "monitor",
                    category: "performance-report"
                }
            }
        });
        pulseId = pulse.id;
        console.log(`  Created Pulse "${PULSE_SLUG}" (id: ${pulseId})`);
    }

    // Add pulse-* agents as members
    const pulseAgents = await prisma.agent.findMany({
        where: { slug: { startsWith: "pulse-" }, isActive: true },
        select: { id: true, slug: true, name: true }
    });

    console.log(`\n  Found ${pulseAgents.length} pulse-* agents`);

    let membersCreated = 0;
    for (const agent of pulseAgents) {
        const existingMember = await prisma.pulseMember.findUnique({
            where: { pulseId_agentId: { pulseId, agentId: agent.id } }
        });

        if (existingMember) continue;

        const role = agent.slug === "pulse-health-monitor" ? "monitor" : "member";

        await prisma.pulseMember.create({
            data: {
                pulseId,
                agentId: agent.id,
                role
            }
        });
        membersCreated++;
    }
    console.log(`  Created ${membersCreated} PulseMember records (skipped existing)`);

    // Link community boards
    const boards = await prisma.communityBoard.findMany({
        where: { pulseId: null },
        select: { id: true, slug: true, name: true }
    });

    console.log(`\n  Found ${boards.length} unlinked community boards`);

    let boardsLinked = 0;
    for (const board of boards) {
        await prisma.communityBoard.update({
            where: { id: board.id },
            data: { pulseId }
        });
        boardsLinked++;
    }
    console.log(`  Linked ${boardsLinked} boards to Pulse "${PULSE_SLUG}"`);

    console.log("\nMigration complete!");
    console.log(`  Pulse: ${PULSE_SLUG} (${pulseId})`);
    console.log(`  Members: ${membersCreated} new / ${pulseAgents.length} total agents`);
    console.log(`  Boards: ${boardsLinked} linked`);
}

main().catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
});
