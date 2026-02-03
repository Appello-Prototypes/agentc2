/**
 * Migration Script: Add Scorers to All Agents
 *
 * This one-time migration adds default scorers (relevancy, completeness) to all
 * SYSTEM agents that currently have empty scorer arrays.
 *
 * Run from packages/database: bun run prisma/add-scorers-to-agents.ts
 * Or from root: cd packages/database && bun run prisma/add-scorers-to-agents.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SCORERS = ["relevancy", "completeness"];

async function main() {
    console.log("Adding default scorers to agents with empty scorer arrays...\n");

    // Find all SYSTEM agents with empty scorers
    const agentsWithoutScorers = await prisma.agent.findMany({
        where: {
            type: "SYSTEM",
            scorers: { equals: [] }
        },
        select: {
            id: true,
            slug: true,
            name: true,
            scorers: true
        }
    });

    console.log(`Found ${agentsWithoutScorers.length} agents without scorers:\n`);

    if (agentsWithoutScorers.length === 0) {
        console.log("All agents already have scorers configured. Nothing to do.");
        return;
    }

    // Update each agent
    let updated = 0;
    for (const agent of agentsWithoutScorers) {
        console.log(`  Updating: ${agent.name} (${agent.slug})`);

        await prisma.agent.update({
            where: { id: agent.id },
            data: { scorers: DEFAULT_SCORERS }
        });

        updated++;
    }

    console.log(
        `\n✅ Updated ${updated} agents with default scorers: ${DEFAULT_SCORERS.join(", ")}`
    );

    // Verify the update
    console.log("\nVerifying updates...\n");

    const verifyAgents = await prisma.agent.findMany({
        where: { type: "SYSTEM" },
        select: {
            slug: true,
            name: true,
            scorers: true
        },
        orderBy: { slug: "asc" }
    });

    for (const agent of verifyAgents) {
        const scorerList = agent.scorers.length > 0 ? agent.scorers.join(", ") : "(none)";
        console.log(`  ${agent.slug}: ${scorerList}`);
    }

    console.log("\n✅ Migration complete!");
}

main()
    .catch((error) => {
        console.error("Migration error:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
