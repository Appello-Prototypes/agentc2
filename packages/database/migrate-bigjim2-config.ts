/**
 * One-time migration: Update BigJim2's modelConfig from deprecated flat format
 * to the new provider-keyed format with adaptive thinking.
 *
 * Usage: cd packages/database && bun run migrate-bigjim2-config.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const BIGJIM2_ID = "cmm1k9ird0006v6zlmo7pusm4";

    const current = await prisma.agent.findUnique({
        where: { id: BIGJIM2_ID },
        select: { name: true, slug: true, modelName: true, modelConfig: true, maxTokens: true }
    });

    if (!current) {
        console.error("BigJim2 agent not found!");
        process.exit(1);
    }

    console.log("Current config:");
    console.log(JSON.stringify(current, null, 2));

    const oldConfig = (current.modelConfig as Record<string, unknown>) || {};

    // Preserve non-thinking/non-cacheControl fields (e.g. toolChoice)
    const newConfig: Record<string, unknown> = {};

    if (oldConfig.toolChoice) {
        newConfig.toolChoice = oldConfig.toolChoice;
    }

    if (oldConfig.reasoning) {
        newConfig.reasoning = oldConfig.reasoning;
    }

    newConfig.anthropic = {
        thinking: { type: "adaptive" },
        effort: "high",
        cacheControl: { type: "ephemeral" }
    };

    const updated = await prisma.agent.update({
        where: { id: BIGJIM2_ID },
        data: {
            modelConfig: newConfig,
            maxTokens: null
        },
        select: { name: true, slug: true, modelName: true, modelConfig: true, maxTokens: true }
    });

    console.log("\nUpdated config:");
    console.log(JSON.stringify(updated, null, 2));
    console.log("\nMigration complete.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
