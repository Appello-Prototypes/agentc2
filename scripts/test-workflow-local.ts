import "dotenv/config";
import { prisma } from "../packages/database/src/index";
import {
    executeWorkflowDefinition,
    type WorkflowDefinition
} from "../packages/agentc2/src/workflows/builder/runtime";
import { createEngagement } from "../packages/agentc2/src/workflows/human-engagement";
import { randomUUID } from "crypto";

const orgId = "cmm1k7tm00000v6uxewe2cd7i";

async function main() {
    console.log("=== SDLC Bugfix Workflow — Human Engagement Test ===\n");

    const workflow = await prisma.workflow.findFirst({
        where: { slug: "sdlc-bugfix" }
    });

    if (!workflow) {
        console.error("Workflow not found!");
        await prisma.$disconnect();
        return;
    }

    const run = await prisma.workflowRun.create({
        data: {
            workflowId: workflow.id,
            status: "RUNNING",
            triggerType: "MANUAL",
            inputJson: {}
        }
    });
    const runId = run.id;
    console.log("Workflow:", workflow.name, "v" + workflow.version);
    console.log("Org:", orgId);
    console.log("RunId:", runId);
    console.log("Starting...\n");

    let result;
    try {
        result = await executeWorkflowDefinition({
            definition: workflow.definitionJson as unknown as WorkflowDefinition,
            input: {
                title: "[Test] Human engagement review flow validation",
                description:
                    "## Bug Report\n\n" +
                    "### Description\n" +
                    "When the SDLC workflow suspends at a human review gate, it should " +
                    "automatically post a structured review comment on the GitHub issue " +
                    "with /approve, /reject, /feedback slash commands.\n\n" +
                    "### Acceptance Criteria\n" +
                    "- Workflow suspends at human step\n" +
                    "- Review comment posted on GitHub issue with slash commands\n" +
                    "- ApprovalRequest record created in database\n\n" +
                    "_Test ticket for human engagement validation._",
                repository: "Appello-Prototypes/agentc2",
                labels: ["test", "signatures"]
            },
            requestContext: { tenantId: orgId },
            workflowMeta: { runId, workflowSlug: "sdlc-bugfix" },
            onStepEvent: (event) => {
                console.log(`[STEP] ${event.stepId} (${event.stepType}) => ${event.status}`);
            }
        });
    } catch (err) {
        console.error("WORKFLOW EXECUTION ERROR:", err);
        await prisma.$disconnect();
        process.exit(1);
    }

    console.log("\n=== RESULT ===");
    console.log("Status:", result.status);
    console.log("Steps:", result.steps.length);
    console.log();

    for (const step of result.steps) {
        const output = step.output as Record<string, unknown> | undefined;
        console.log(`--- Step: ${step.stepId} (${step.stepType}) ---`);
        console.log("  Status:", step.status);
        if (step.error) console.log("  Error:", step.error);

        if (step.stepId === "intake" && output) {
            console.log("  Issue:", output.issueUrl);
        }
        if (step.stepId === "analyze-launch" && output) {
            console.log("  Agent:", output.agentId);
            console.log("  Branch:", output.branchName);
        }
        if (step.stepId === "analyze-wait" && output) {
            console.log("  Duration:", output.durationMs, "ms");
            console.log("  Summary length:", String(output.summary || "").length, "chars");
            console.log("  Summary preview:", String(output.summary || "").substring(0, 300));
        }
        if (step.stepId === "post-analysis" && output) {
            console.log("  Comment:", output.commentUrl);
        }
        console.log();
    }

    if (result.suspended) {
        console.log("SUSPENDED at:", result.suspended.stepId);
        console.log("\n--- Creating Human Engagement ---");
        try {
            const engagementId = await createEngagement({
                organizationId: orgId,
                workspaceId: null,
                workflowRunId: runId,
                workflowSlug: "sdlc-bugfix",
                suspendedStep: result.suspended.stepId,
                suspendData: result.suspended.data as Record<string, unknown>,
                stepOutputs: result.steps.map((s) => ({
                    stepId: s.stepId,
                    stepType: s.stepType,
                    output: s.output
                })),
                channels: ["github"]
            });
            console.log("Engagement created:", engagementId);
        } catch (err) {
            console.error("Failed to create engagement:", err);
        }
    }

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
