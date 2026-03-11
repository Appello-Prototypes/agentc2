/**
 * Repackage the SDLC Flywheel playbook with all components.
 *
 * Uses the network as entry point to pull in all 4 agents + their skills/documents,
 * and explicitly includes all 3 active workflows.
 *
 * Usage: bun run scripts/repackage-sdlc-playbook.ts
 */

import { prisma } from "../packages/database/src/index";
import { repackagePlaybook } from "../packages/agentc2/src/playbooks/packager";

async function main() {
    const playbook = await prisma.playbook.findUnique({
        where: { slug: "sdlc-flywheel" }
    });
    if (!playbook) throw new Error("Playbook not found");

    const org = await prisma.organization.findUnique({
        where: { slug: "agentc2" }
    });
    if (!org) throw new Error("AgentC2 org not found");

    const systemUser = await prisma.user.findFirst({
        where: { email: "system@agentc2.ai" }
    });
    if (!systemUser) throw new Error("System user not found");

    const network = await prisma.network.findFirst({
        where: { slug: "sdlc-triage-network-agentc2" }
    });
    if (!network) throw new Error("SDLC Triage Network not found");

    const triageWf = await prisma.workflow.findFirst({
        where: { slug: "sdlc-triage-agentc2" }
    });
    const bugfixWf = await prisma.workflow.findFirst({
        where: { slug: "sdlc-bugfix-agentc2" }
    });
    const featureWf = await prisma.workflow.findFirst({
        where: { slug: "sdlc-feature-agentc2" }
    });

    if (!triageWf || !bugfixWf || !featureWf) {
        throw new Error("Missing SDLC workflows");
    }

    console.log("Repackaging SDLC Flywheel playbook...");
    console.log("  Playbook:", playbook.id, "(current version:", playbook.version, ")");
    console.log("  Entry network:", network.slug, "(", network.id, ")");
    console.log("  Include workflows:", [triageWf.slug, bugfixWf.slug, featureWf.slug].join(", "));

    const result = await repackagePlaybook({
        playbookId: playbook.id,
        entryNetworkId: network.id,
        includeWorkflows: [triageWf.id, bugfixWf.id, featureWf.id],
        organizationId: org.id,
        userId: systemUser.id,
        changelog:
            "v4: Full repackage with network entry point. Captures all 4 SDLC agents " +
            "(classifier, planner, auditor, reviewer) with skills, documents, guardrails, " +
            "scorecards, and test cases. All 3 active workflows (triage, bugfix, feature). " +
            "SDLC Triage Network with all 4 agent primitives. Post-V&V production state " +
            "with hardened concurrency-safe workflow definitions.",
        mode: "full",
        includeSkills: true,
        includeDocuments: true
    });

    console.log("\nRepackage complete!");
    console.log("  New version:", result.playbook.version);
    console.log("  Warnings:", result.warnings.length > 0 ? result.warnings : "none");
    console.log("  Agents:", result.manifest.agents.map((a) => a.slug).join(", "));
    console.log("  Skills:", result.manifest.skills.map((s) => s.slug).join(", "));
    console.log("  Documents:", result.manifest.documents.map((d) => d.slug).join(", "));
    console.log("  Workflows:", result.manifest.workflows.map((w) => w.slug).join(", "));
    console.log("  Networks:", result.manifest.networks.map((n) => n.slug).join(", "));
    console.log(
        "  Entry point:",
        result.manifest.entryPoint.type,
        "->",
        result.manifest.entryPoint.slug
    );
}

main().catch((e) => {
    console.error("Repackage failed:", e);
    process.exit(1);
});
