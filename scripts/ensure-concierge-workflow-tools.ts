#!/usr/bin/env bun
/**
 * Ensure Concierge Workflow Tools
 *
 * Ensures all concierge agents (bigjim2*, workspace-concierge*) have the
 * required workflow tools assigned. Run after deployment or when new orgs
 * are created.
 *
 * Usage: bun run scripts/ensure-concierge-workflow-tools.ts
 */

import { prisma } from "../packages/database/src";

const REQUIRED_TOOLS = [
    "workflow-execute",
    "workflow-list-runs",
    "workflow-get-run",
    "workflow-resume"
];

async function main() {
    const concierges = await prisma.agent.findMany({
        where: {
            OR: [
                { slug: { startsWith: "bigjim2" } },
                { slug: { startsWith: "workspace-concierge" } }
            ],
            isActive: true
        },
        include: { tools: true }
    });

    console.log(`Found ${concierges.length} concierge agent(s)`);

    let totalAdded = 0;

    for (const agent of concierges) {
        const existing = new Set(agent.tools.map((t) => t.toolId));
        const missing = REQUIRED_TOOLS.filter((t) => !existing.has(t));

        if (missing.length === 0) {
            console.log(`  ✓ ${agent.slug} — all workflow tools present`);
            continue;
        }

        await prisma.agentTool.createMany({
            data: missing.map((toolId) => ({
                agentId: agent.id,
                toolId
            })),
            skipDuplicates: true
        });

        totalAdded += missing.length;
        console.log(`  + ${agent.slug} — added ${missing.length} tools: ${missing.join(", ")}`);
    }

    console.log(`\nDone. Added ${totalAdded} tool(s) across ${concierges.length} agent(s).`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
