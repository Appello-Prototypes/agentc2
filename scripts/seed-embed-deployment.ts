/**
 * Seed an EmbedDeployment record for the Appello partner.
 *
 * Usage: bun run scripts/seed-embed-deployment.ts
 */
import { prisma } from "../packages/database/src/index";
import { randomBytes } from "crypto";

async function main() {
    // Find the Appello embed partner
    const partner = await prisma.embedPartner.findFirst({
        where: { slug: "appello" },
        select: { id: true, name: true, organizationId: true }
    });

    if (!partner) {
        console.error("No EmbedPartner with slug 'appello' found. Create it first.");
        process.exit(1);
    }

    console.log(`Found partner: ${partner.name} (${partner.id})`);

    // Find the agent for Mode 2 deployment (agentc2-developer)
    const agent = await prisma.agent.findFirst({
        where: { slug: "agentc2-developer" },
        select: { id: true, slug: true, name: true }
    });

    if (!agent) {
        console.warn(
            "No agent with slug 'agentc2-developer' found. Creating deployment without agent lock."
        );
    }

    // Generate a deployment token
    const deploymentToken = randomBytes(24).toString("base64url");

    // Check if deployment already exists
    const existing = await prisma.embedDeployment.findFirst({
        where: { partnerId: partner.id, label: "Appello Dashboard" }
    });

    if (existing) {
        console.log(
            `Deployment already exists: ${existing.id} (token: ${existing.deploymentToken})`
        );
        process.exit(0);
    }

    // Create Mode 2 (agent workspace) deployment for Appello
    const deployment = await prisma.embedDeployment.create({
        data: {
            partnerId: partner.id,
            agentId: agent?.id || null,
            deploymentToken,
            label: "Appello Dashboard",
            mode: "agent",
            features: ["chat", "settings"],
            branding: {
                appName: "Appello AI",
                showPoweredBy: true
            },
            embedConfig: {
                greeting: "How can I help you today?",
                showToolActivity: true
            },
            allowedDomains: ["app.appello.com.au", "staging.appello.com.au", "localhost"],
            isActive: true
        }
    });

    console.log("\nEmbedDeployment created:");
    console.log(`  ID:    ${deployment.id}`);
    console.log(`  Token: ${deployment.deploymentToken}`);
    console.log(`  Mode:  ${deployment.mode}`);
    console.log(`  Agent: ${agent?.slug || "none (full workspace)"}`);
    console.log(`\nEmbed URL:`);
    console.log(
        `  https://agentc2.ai/embed/workspace?dt=${deployment.deploymentToken}&identity={identityToken}`
    );
}

main()
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
