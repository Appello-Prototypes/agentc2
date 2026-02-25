/**
 * Backfill script: Convert synthetic Slack listeners into real AgentTrigger records.
 *
 * This script:
 * 1. Finds all agents that have received Slack TriggerEvents
 * 2. Creates an AgentTrigger (triggerType: "slack_listener") for each
 * 3. Links orphaned TriggerEvent records (sourceType: "slack") to their new trigger
 * 4. Links orphaned AgentRun records (source: "slack") to their new trigger
 *
 * Idempotent: safe to re-run. Skips agents that already have a slack_listener trigger.
 *
 * Usage: bun run scripts/backfill-slack-triggers.ts
 */

import { prisma } from "../packages/database/src/index";

async function main() {
    console.log("=== Backfill Slack Triggers ===\n");

    // 1. Find all agents with Slack TriggerEvent records
    const slackGroups = await prisma.triggerEvent.groupBy({
        by: ["agentId"],
        where: {
            sourceType: "slack",
            agentId: { not: null }
        },
        _count: { _all: true }
    });

    const agentIds = slackGroups.map((g) => g.agentId).filter(Boolean) as string[];
    console.log(`Found ${agentIds.length} agents with Slack events`);

    if (agentIds.length === 0) {
        console.log("Nothing to backfill.");
        return;
    }

    // 2. Fetch agent details
    const agents = await prisma.agent.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, slug: true, name: true, workspaceId: true }
    });
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    // 3. Check for existing slack_listener triggers to avoid duplicates
    const existingTriggers = await prisma.agentTrigger.findMany({
        where: {
            agentId: { in: agentIds },
            triggerType: "slack_listener"
        },
        select: { id: true, agentId: true }
    });
    const existingByAgent = new Map(existingTriggers.map((t) => [t.agentId, t.id]));

    let created = 0;
    let skipped = 0;
    const triggerIdByAgent = new Map<string, string>();

    // 4. Create AgentTrigger records for agents that don't have one
    for (const agentId of agentIds) {
        const agent = agentMap.get(agentId);
        if (!agent) {
            console.log(`  [SKIP] Agent ${agentId} not found in database`);
            skipped++;
            continue;
        }

        const existingId = existingByAgent.get(agentId);
        if (existingId) {
            console.log(`  [EXISTS] ${agent.name} (${agent.slug}) -> trigger ${existingId}`);
            triggerIdByAgent.set(agentId, existingId);
            skipped++;
            continue;
        }

        const eventCount = slackGroups.find((g) => g.agentId === agentId)?._count._all ?? 0;

        const trigger = await prisma.agentTrigger.create({
            data: {
                agentId,
                workspaceId: agent.workspaceId,
                name: `Slack Messages → ${agent.name}`,
                description: "Incoming Slack messages routed to this agent",
                triggerType: "slack_listener",
                eventName: "slack.message",
                isActive: true,
                triggerCount: eventCount
            }
        });

        triggerIdByAgent.set(agentId, trigger.id);
        console.log(
            `  [CREATED] ${agent.name} (${agent.slug}) -> trigger ${trigger.id} (${eventCount} events)`
        );
        created++;
    }

    console.log(`\nTriggers: ${created} created, ${skipped} skipped\n`);

    // 5. Link orphaned TriggerEvent records
    let linkedEvents = 0;
    for (const [agentId, triggerId] of triggerIdByAgent) {
        const result = await prisma.triggerEvent.updateMany({
            where: {
                agentId,
                sourceType: "slack",
                triggerId: null
            },
            data: { triggerId }
        });
        linkedEvents += result.count;
    }
    console.log(`Linked ${linkedEvents} orphaned TriggerEvent records`);

    // 6. Link orphaned AgentRun records
    let linkedRuns = 0;
    for (const [agentId, triggerId] of triggerIdByAgent) {
        const result = await prisma.agentRun.updateMany({
            where: {
                agentId,
                source: "slack",
                triggerId: null
            },
            data: { triggerId }
        });
        linkedRuns += result.count;
    }
    console.log(`Linked ${linkedRuns} orphaned AgentRun records`);

    console.log("\n=== Backfill complete ===");
}

main()
    .catch((e) => {
        console.error("Backfill failed:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
