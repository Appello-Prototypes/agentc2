/**
 * Fix BigJim2 Context Bloat (Issue #103)
 *
 * Updates BigJim2's configuration to prevent 265K token bloat:
 * - Sets contextConfig to cap per-step tokens
 * - Reduces semanticRecall aggressiveness
 * - Lowers maxSteps to prevent runaway execution
 *
 * Usage: cd packages/database && bun run fix-bigjim2-context-bloat.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const BIGJIM2_ID = "cmm1k9ird0006v6zlmo7pusm4";

    const current = await prisma.agent.findUnique({
        where: { id: BIGJIM2_ID },
        select: {
            name: true,
            slug: true,
            contextConfig: true,
            memoryConfig: true,
            maxSteps: true
        }
    });

    if (!current) {
        console.error("BigJim2 agent not found!");
        process.exit(1);
    }

    console.log("Current config:");
    console.log(JSON.stringify(current, null, 2));

    const memoryConfig = (current.memoryConfig as Record<string, unknown>) || {};

    const updatedMemoryConfig = {
        ...memoryConfig,
        lastMessages: 3,
        semanticRecall: {
            topK: 2,
            messageRange: 1
        },
        workingMemory: memoryConfig.workingMemory || { enabled: true }
    };

    const contextConfig = {
        maxContextTokens: 30000,
        windowSize: 3
    };

    const updated = await prisma.agent.update({
        where: { id: BIGJIM2_ID },
        data: {
            contextConfig,
            memoryConfig: updatedMemoryConfig,
            maxSteps: 10
        },
        select: {
            name: true,
            slug: true,
            contextConfig: true,
            memoryConfig: true,
            maxSteps: true
        }
    });

    console.log("\nUpdated config:");
    console.log(JSON.stringify(updated, null, 2));
    console.log("\nConfiguration update complete.");
    console.log("Changes:");
    console.log("  ✓ contextConfig: { maxContextTokens: 30000, windowSize: 3 }");
    console.log("  ✓ memoryConfig.semanticRecall: { topK: 2, messageRange: 1 }");
    console.log("  ✓ maxSteps: 10");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
