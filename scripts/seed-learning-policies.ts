/**
 * Seed Learning Policies for Existing Agents
 *
 * This script creates default LearningPolicy records for all agents
 * that don't already have one, enabling the continuous learning system.
 *
 * Usage: bun run scripts/seed-learning-policies.ts
 */

import { prisma } from "../packages/database/src";

async function seedLearningPolicies() {
    console.log("🔍 Finding agents without learning policies...");

    // Find all agents that don't have a learning policy
    const agentsWithoutPolicy = await prisma.agent.findMany({
        where: {
            learningPolicy: null
        },
        select: {
            id: true,
            slug: true,
            name: true
        }
    });

    if (agentsWithoutPolicy.length === 0) {
        console.log("✅ All agents already have learning policies!");
        return;
    }

    console.log(`📝 Found ${agentsWithoutPolicy.length} agents without policies:`);
    agentsWithoutPolicy.forEach((agent) => {
        console.log(`   - ${agent.name} (${agent.slug})`);
    });

    // Create learning policies for each agent
    console.log("\n🚀 Creating learning policies...");

    const results = await Promise.allSettled(
        agentsWithoutPolicy.map(async (agent) => {
            const policy = await prisma.learningPolicy.create({
                data: {
                    agentId: agent.id,
                    enabled: true,
                    autoPromotionEnabled: false, // Start conservative - require human approval
                    scheduledEnabled: true, // Enable scheduled learning triggers
                    thresholdEnabled: true, // Enable threshold-based triggers
                    paused: false // Start active
                }
            });

            // Create audit log entry
            await prisma.auditLog.create({
                data: {
                    action: "LEARNING_POLICY_CREATED",
                    entityType: "Agent",
                    entityId: agent.id,
                    actorId: "system:seed-script",
                    metadata: {
                        source: "seed-learning-policies.ts",
                        policyId: policy.id,
                        settings: {
                            enabled: true,
                            autoPromotionEnabled: false,
                            scheduledEnabled: true,
                            thresholdEnabled: true
                        }
                    }
                }
            });

            return { agent, policy };
        })
    );

    // Report results
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    console.log("\n📊 Results:");
    console.log(`   ✅ Successfully created: ${succeeded.length}`);
    if (failed.length > 0) {
        console.log(`   ❌ Failed: ${failed.length}`);
        failed.forEach((r, i) => {
            if (r.status === "rejected") {
                console.log(`      ${i + 1}. ${r.reason}`);
            }
        });
    }

    // List created policies
    if (succeeded.length > 0) {
        console.log("\n📋 Created policies for:");
        succeeded.forEach((r) => {
            if (r.status === "fulfilled") {
                const { agent, policy } = r.value;
                console.log(`   - ${agent.name}: policy ${policy.id}`);
            }
        });
    }

    console.log("\n✨ Done!");
}

// Run the script
seedLearningPolicies()
    .catch((error) => {
        console.error("❌ Error seeding learning policies:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
