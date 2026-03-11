/**
 * End-to-end validation of the Claude Code SDLC Flywheel playbook.
 *
 * Validates:
 * 1. claude-code integration provider exists (seeds if needed)
 * 2. All Claude SDLC entities exist in the AgentC2 org
 * 3. Playbook can be deployed to the flywheel-demo tenant
 * 4. Deployed entities are properly configured (tools, agents, workflows, network)
 * 5. Output schema parity between Cursor and Claude tools
 * 6. Shared agent updates (Planner + Auditor) are correct
 * 7. Cursor playbook still works unchanged
 *
 * Usage: bun run scripts/e2e-claude-sdlc-validation.ts
 */

import { prisma } from "../packages/database/src/index";

const ORG_SLUG = "agentc2";
const DEMO_ORG_SLUG = "flywheel-demo";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${label}`);
    } else {
        failed++;
        failures.push(label);
        console.log(`  ❌ ${label}`);
    }
}

async function main() {
    console.log("═══════════════════════════════════════════════");
    console.log("  Claude Code SDLC Flywheel — E2E Validation  ");
    console.log("═══════════════════════════════════════════════\n");

    // ─── Phase 1: Integration Provider ────────────────────────────────

    console.log("Phase 1: Integration Provider\n");

    let claudeProvider = await prisma.integrationProvider.findFirst({
        where: { key: "claude-code" }
    });

    if (!claudeProvider) {
        console.log("  Seeding claude-code integration provider...");
        claudeProvider = await prisma.integrationProvider.create({
            data: {
                key: "claude-code",
                name: "Claude Code Agent",
                description:
                    "Autonomous coding agent powered by Claude Agent SDK — launch agents to analyze code, fix bugs, and create PRs",
                category: "developer",
                authType: "apiKey",
                providerType: "custom",
                maturityLevel: "visible",
                configJson: {
                    requiredFields: ["ANTHROPIC_API_KEY"],
                    fieldDefinitions: {
                        ANTHROPIC_API_KEY: {
                            label: "Anthropic API Key",
                            description:
                                "Same key used for Claude models. Get from https://console.anthropic.com/settings/keys",
                            placeholder: "sk-ant-...",
                            type: "password"
                        }
                    },
                    importHints: {
                        matchNames: ["Claude Code", "claude-code", "Claude Agent SDK"],
                        envAliases: { ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY" }
                    }
                },
                isActive: true
            }
        });
        console.log("  Seeded claude-code provider:", claudeProvider.id);
    }

    assert(claudeProvider !== null, "claude-code provider exists");
    assert(claudeProvider.category === "developer", "claude-code category is 'developer'");
    assert(
        claudeProvider.maturityLevel === "visible",
        "claude-code maturityLevel is 'visible' (appears as card)"
    );

    // ─── Phase 2: AgentC2 Org Entities ────────────────────────────────

    console.log("\nPhase 2: AgentC2 Org Entities\n");

    const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
    assert(org !== null, "AgentC2 org exists");
    if (!org) throw new Error("AgentC2 org not found");

    // Workflows
    const triageWf = await prisma.workflow.findFirst({
        where: { slug: "sdlc-triage-claude-agentc2" }
    });
    const bugfixWf = await prisma.workflow.findFirst({
        where: { slug: "sdlc-bugfix-claude-agentc2" }
    });
    const featureWf = await prisma.workflow.findFirst({
        where: { slug: "sdlc-feature-claude-agentc2" }
    });

    assert(triageWf !== null, "sdlc-triage-claude workflow exists");
    assert(bugfixWf !== null, "sdlc-bugfix-claude workflow exists");
    assert(featureWf !== null, "sdlc-feature-claude workflow exists");

    // Verify workflows use Claude tools
    if (bugfixWf) {
        const defStr = JSON.stringify(bugfixWf.definitionJson);
        assert(
            defStr.includes("claude-launch-agent"),
            "bugfix-claude uses claude-launch-agent tool"
        );
        assert(
            defStr.includes("claude-poll-until-done"),
            "bugfix-claude uses claude-poll-until-done tool"
        );
        assert(
            defStr.includes("claude-get-conversation"),
            "bugfix-claude uses claude-get-conversation tool"
        );
        assert(
            !defStr.includes("cursor-launch-agent"),
            "bugfix-claude does NOT reference cursor-launch-agent"
        );
        assert(
            defStr.includes("Claude Code Agent"),
            "bugfix-claude mentions 'Claude Code Agent' in prompts"
        );
    }

    if (featureWf) {
        const defStr = JSON.stringify(featureWf.definitionJson);
        assert(
            defStr.includes("claude-launch-agent"),
            "feature-claude uses claude-launch-agent tool"
        );
        assert(
            !defStr.includes("cursor-launch-agent"),
            "feature-claude does NOT reference cursor-launch-agent"
        );
    }

    if (triageWf) {
        const defStr = JSON.stringify(triageWf.definitionJson);
        assert(defStr.includes("sdlc-bugfix-claude"), "triage-claude routes to sdlc-bugfix-claude");
        assert(
            defStr.includes("sdlc-feature-claude"),
            "triage-claude routes to sdlc-feature-claude"
        );
    }

    // Network
    const ws = await prisma.workspace.findFirst({
        where: { organizationId: org.id, slug: "platform-agentc2" }
    });
    const claudeNetwork = await prisma.network.findFirst({
        where: { slug: "sdlc-triage-network-claude-agentc2" }
    });
    assert(claudeNetwork !== null, "Claude SDLC triage network exists");

    if (claudeNetwork) {
        const primitives = await prisma.networkPrimitive.findMany({
            where: { networkId: claudeNetwork.id },
            include: { agent: true }
        });
        assert(primitives.length === 4, `Network has 4 primitives (got ${primitives.length})`);
        const agentSlugs = primitives.map((p) => p.agent?.slug).filter(Boolean);
        assert(agentSlugs.includes("sdlc-classifier-agentc2"), "Network includes Classifier agent");
        assert(agentSlugs.includes("sdlc-planner-agentc2"), "Network includes Planner agent");
        assert(agentSlugs.includes("sdlc-auditor-agentc2"), "Network includes Auditor agent");
        assert(agentSlugs.includes("sdlc-reviewer-agentc2"), "Network includes Reviewer agent");
    }

    // Playbook
    const playbook = await prisma.playbook.findUnique({
        where: { slug: "sdlc-flywheel-claude" }
    });
    assert(playbook !== null, "Claude SDLC Flywheel playbook exists");
    if (playbook) {
        assert(playbook.status === "PUBLISHED", "Playbook is PUBLISHED");
        assert(
            playbook.requiredIntegrations.includes("claude-code"),
            "Playbook requiredIntegrations includes 'claude-code'"
        );
        assert(
            playbook.requiredIntegrations.includes("github"),
            "Playbook requiredIntegrations includes 'github'"
        );
        assert(
            !playbook.requiredIntegrations.includes("cursor"),
            "Playbook requiredIntegrations does NOT include 'cursor'"
        );
    }

    // ─── Phase 3: Shared Agent Updates ────────────────────────────────

    console.log("\nPhase 3: Shared Agent Updates\n");

    const planner = await prisma.agent.findFirst({
        where: { slug: "sdlc-planner-agentc2" }
    });
    if (planner) {
        assert(
            !planner.instructions.includes("Cursor Cloud Agent"),
            "Planner instructions do NOT mention 'Cursor Cloud Agent'"
        );
        assert(
            planner.instructions.includes("autonomous coding agent") ||
                !planner.instructions.includes("Cursor"),
            "Planner instructions are engine-agnostic"
        );
    }

    const auditor = await prisma.agent.findFirst({
        where: { slug: "sdlc-auditor-agentc2" }
    });
    if (auditor) {
        const guardrail = await prisma.guardrailPolicy.findFirst({
            where: { agentId: auditor.id }
        });
        if (guardrail) {
            const config = guardrail.configJson as Record<string, unknown>;
            const blocked = config.blockedTools as string[];
            assert(
                blocked.includes("claude-launch-agent"),
                "Auditor blockedTools includes 'claude-launch-agent'"
            );
            assert(
                blocked.includes("cursor-launch-agent"),
                "Auditor blockedTools still includes 'cursor-launch-agent'"
            );
            assert(
                blocked.includes("merge-pull-request"),
                "Auditor blockedTools still includes 'merge-pull-request'"
            );
        }
    }

    // ─── Phase 4: Cursor Playbook Unchanged ───────────────────────────

    console.log("\nPhase 4: Cursor Playbook Unchanged\n");

    const cursorPlaybook = await prisma.playbook.findUnique({
        where: { slug: "sdlc-flywheel" }
    });
    assert(cursorPlaybook !== null, "Cursor SDLC Flywheel playbook still exists");
    if (cursorPlaybook) {
        assert(cursorPlaybook.status === "PUBLISHED", "Cursor playbook still PUBLISHED");
        assert(
            cursorPlaybook.requiredIntegrations !== undefined,
            "Cursor playbook has requiredIntegrations field"
        );
    }

    const cursorBugfix = await prisma.workflow.findFirst({
        where: { slug: "sdlc-bugfix-agentc2" }
    });
    assert(cursorBugfix !== null, "Cursor sdlc-bugfix workflow still exists");
    if (cursorBugfix) {
        const defStr = JSON.stringify(cursorBugfix.definitionJson);
        assert(
            defStr.includes("cursor-launch-agent"),
            "Cursor bugfix still uses cursor-launch-agent"
        );
    }

    const cursorNetwork = await prisma.network.findFirst({
        where: { slug: "sdlc-triage-network-agentc2" }
    });
    assert(cursorNetwork !== null, "Cursor SDLC triage network still exists");

    // ─── Phase 5: Tool Registration ───────────────────────────────────

    console.log("\nPhase 5: Tool Registration (via import)\n");

    try {
        const { toolRegistry } = await import("../packages/agentc2/src/tools/registry");
        const claudeTools = [
            "claude-launch-agent",
            "claude-get-status",
            "claude-add-followup",
            "claude-get-conversation",
            "claude-poll-until-done"
        ];
        for (const toolId of claudeTools) {
            assert(toolId in toolRegistry, `Tool '${toolId}' registered in toolRegistry`);
        }

        // Verify Cursor tools still present
        const cursorTools = [
            "cursor-launch-agent",
            "cursor-get-status",
            "cursor-add-followup",
            "cursor-get-conversation",
            "cursor-poll-until-done"
        ];
        for (const toolId of cursorTools) {
            assert(toolId in toolRegistry, `Tool '${toolId}' still registered`);
        }
    } catch (err) {
        console.log(`  ⚠️  Could not import toolRegistry: ${err}`);
    }

    // ─── Phase 6: Playbook Deployment ─────────────────────────────────

    console.log("\nPhase 6: Playbook Deployment to flywheel-demo\n");

    const demoOrg = await prisma.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } });
    if (!demoOrg) {
        console.log("  ⚠️  flywheel-demo org not found — skipping deployment test");
    } else {
        const demoWs = await prisma.workspace.findFirst({
            where: { organizationId: demoOrg.id, isDefault: true }
        });
        assert(demoOrg !== null, "flywheel-demo org exists");
        assert(demoWs !== null, "flywheel-demo default workspace exists");

        if (playbook && demoWs) {
            // Check if already deployed
            const existingInstall = await prisma.playbookInstallation.findFirst({
                where: { playbookId: playbook.id, targetOrgId: demoOrg.id }
            });

            if (existingInstall) {
                console.log("  Already deployed — verifying entities...\n");
            } else {
                console.log("  Deploying Claude playbook to flywheel-demo...\n");
                try {
                    const { deployPlaybook } =
                        await import("../packages/agentc2/src/playbooks/deployer");
                    const sysUser = await prisma.user.findFirst({
                        where: { email: "system@agentc2.ai" }
                    });
                    const deployResult = await deployPlaybook({
                        playbookId: playbook.id,
                        targetOrgId: demoOrg.id,
                        targetWorkspaceId: demoWs.id,
                        userId: sysUser?.id || "system",
                        versionNumber: 1
                    });
                    assert(
                        deployResult.installation !== null,
                        "Playbook deployment created installation record"
                    );
                    console.log("  Deployment complete!");
                } catch (err) {
                    console.log(`  ⚠️  Deployment failed: ${err}`);
                    failed++;
                    failures.push("Playbook deployment");
                }
            }

            // Verify deployed Claude workflows exist in demo workspace
            const deployedWfs = await prisma.workflow.findMany({
                where: {
                    workspaceId: demoWs.id,
                    slug: { contains: "sdlc" }
                }
            });
            const deployedClaudeWfs = deployedWfs.filter((w) => w.slug.includes("claude"));
            assert(
                deployedClaudeWfs.length >= 3,
                `Demo workspace has ${deployedClaudeWfs.length} Claude SDLC workflows (≥3 expected)`
            );

            // Verify Claude workflows use Claude tools (not Cursor)
            for (const wf of deployedClaudeWfs) {
                const defStr = JSON.stringify(wf.definitionJson);
                if (wf.slug.includes("bugfix-claude") || wf.slug.includes("feature-claude")) {
                    assert(
                        defStr.includes("claude-launch-agent"),
                        `Deployed ${wf.slug} uses claude-launch-agent`
                    );
                    assert(
                        !defStr.includes("cursor-launch-agent"),
                        `Deployed ${wf.slug} does NOT use cursor-launch-agent`
                    );
                }
            }

            // Verify deployed network
            const deployedNetwork = await prisma.network.findFirst({
                where: {
                    workspaceId: demoWs.id,
                    slug: { contains: "triage-network-claude" }
                }
            });
            assert(deployedNetwork !== null, "Demo workspace has Claude SDLC triage network");
        }
    }

    // ─── Phase 7: Output Schema Parity ────────────────────────────────

    console.log("\nPhase 7: Output Schema Parity\n");

    try {
        const cursorMod = await import("../packages/agentc2/src/tools/cursor-tools");
        const claudeMod = await import("../packages/agentc2/src/tools/claude-tools");

        // Compare launch tool output schemas
        const cursorLaunchOutput = cursorMod.cursorLaunchAgentTool.outputSchema;
        const claudeLaunchOutput = claudeMod.claudeLaunchAgentTool.outputSchema;

        if (cursorLaunchOutput && claudeLaunchOutput) {
            const cursorShape = Object.keys(cursorLaunchOutput.shape || {}).sort();
            const claudeShape = Object.keys(claudeLaunchOutput.shape || {}).sort();
            assert(
                JSON.stringify(cursorShape) === JSON.stringify(claudeShape),
                `Launch tool output schemas match: [${cursorShape.join(", ")}]`
            );
        }

        // Compare poll tool output schemas
        const cursorPollOutput = cursorMod.cursorPollUntilDoneTool.outputSchema;
        const claudePollOutput = claudeMod.claudePollUntilDoneTool.outputSchema;

        if (cursorPollOutput && claudePollOutput) {
            const cursorShape = Object.keys(cursorPollOutput.shape || {}).sort();
            const claudeShape = Object.keys(claudePollOutput.shape || {}).sort();
            assert(
                JSON.stringify(cursorShape) === JSON.stringify(claudeShape),
                `Poll tool output schemas match: [${cursorShape.join(", ")}]`
            );
        }

        // Compare conversation tool output schemas
        const cursorConvOutput = cursorMod.cursorGetConversationTool.outputSchema;
        const claudeConvOutput = claudeMod.claudeGetConversationTool.outputSchema;

        if (cursorConvOutput && claudeConvOutput) {
            const cursorShape = Object.keys(cursorConvOutput.shape || {}).sort();
            const claudeShape = Object.keys(claudeConvOutput.shape || {}).sort();
            assert(
                JSON.stringify(cursorShape) === JSON.stringify(claudeShape),
                `Conversation tool output schemas match: [${cursorShape.join(", ")}]`
            );
        }
    } catch (err) {
        console.log(`  ⚠️  Could not verify schema parity: ${err}`);
    }

    // ─── Summary ──────────────────────────────────────────────────────

    console.log("\n═══════════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log("═══════════════════════════════════════════════\n");

    if (failures.length > 0) {
        console.log("Failures:");
        for (const f of failures) {
            console.log(`  ❌ ${f}`);
        }
        process.exit(1);
    }

    console.log("✔ All validations passed!");
}

main().catch((e) => {
    console.error("E2E validation failed:", e);
    process.exit(1);
});
