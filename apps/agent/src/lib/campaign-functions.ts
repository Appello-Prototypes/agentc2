/**
 * Campaign / Mission / Task Inngest Functions
 *
 * Implements the Campaign-Mission architecture for autonomous multi-agent orchestration.
 * Uses the "Mission Command" principle: tell the platform WHAT to achieve, not HOW.
 *
 * Event Chain:
 *   campaign/created
 *     -> campaign/analyze  (task decomposition via generateObject)
 *       -> campaign/plan   (agent assignment, dependency ordering)
 *         -> mission/execute (per mission, sequential or parallel)
 *           -> mission/task.execute (per task, creates AgentRun)
 *             -> [existing] run/completed -> run/evaluate (existing AAR pipeline)
 *           -> mission/tasks.complete (all tasks done)
 *             -> mission/aar (aggregate task evaluations)
 *         -> campaign/missions.complete (all missions done)
 *           -> campaign/aar (aggregate mission AARs)
 *             -> campaign/complete
 */

import { inngest } from "./inngest";
import {
    prisma,
    Prisma,
    CampaignStatus,
    MissionStatus,
    MissionTaskStatus,
    MissionTaskType
} from "@repo/database";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { agentResolver } from "@repo/mastra";
import { startRun } from "./run-recorder";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function logCampaignEvent(
    campaignId: string,
    event: string,
    message: string,
    metadata?: Record<string, unknown>
) {
    await prisma.campaignLog.create({
        data: {
            campaignId,
            event,
            message,
            metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined
        }
    });
}

// ─── Schemas for generateObject ──────────────────────────────────────────────

const TaskDecompositionSchema = z.object({
    missions: z.array(
        z.object({
            name: z.string().describe("Short mission name"),
            missionStatement: z.string().describe("Verb + in order to purpose format"),
            priority: z.number().int().min(0).max(10).describe("0=low, 10=critical"),
            sequence: z.number().int().min(0).describe("Execution order, 0 = can run in parallel"),
            tasks: z.array(
                z.object({
                    name: z.string().describe("Short task name"),
                    taskType: z.enum(["ASSIGNED", "IMPLIED", "ESSENTIAL"]),
                    taskVerb: z.string().describe("The specific action verb"),
                    sequence: z.number().int().min(0),
                    coordinatingInstructions: z
                        .string()
                        .nullable()
                        .describe("Dependencies, context, or instructions to pass to the agent")
                })
            )
        })
    ),
    essentialTask: z.string().describe("The single task that defines overall campaign success")
});

const PlanAssignmentSchema = z.object({
    assignments: z.array(
        z.object({
            missionName: z.string(),
            tasks: z.array(
                z.object({
                    taskName: z.string(),
                    agentSlug: z.string().describe("Slug of the agent best suited for this task"),
                    reasoning: z.string().describe("Why this agent was chosen"),
                    estimatedTokens: z.number().nullable(),
                    estimatedCostUsd: z.number().nullable()
                })
            )
        })
    ),
    executionStrategy: z
        .string()
        .describe("Overall execution approach: sequential, parallel, or mixed"),
    estimatedTotalCostUsd: z.number(),
    estimatedDurationMinutes: z.number()
});

const MissionAarSchema = z.object({
    plannedTasks: z.number(),
    completedTasks: z.number(),
    failedTasks: z.number(),
    skippedTasks: z.number(),
    avgTaskScore: z.number(),
    lowestScoringTask: z
        .object({
            name: z.string(),
            score: z.number(),
            reason: z.string()
        })
        .nullable(),
    totalCostUsd: z.number(),
    totalTokens: z.number(),
    durationMs: z.number(),
    sustainPatterns: z.array(z.string()),
    improvePatterns: z.array(z.string()),
    summary: z.string().describe("1-2 sentence mission outcome summary")
});

const CampaignAarSchema = z.object({
    plannedMissions: z.number(),
    completedMissions: z.number(),
    failedMissions: z.number(),
    plannedTasks: z.number(),
    completedTasks: z.number(),
    avgTaskScore: z.number(),
    lowestScoringTask: z
        .object({
            name: z.string(),
            score: z.number(),
            reason: z.string()
        })
        .nullable(),
    plannedDurationMs: z.number(),
    actualDurationMs: z.number(),
    totalCostUsd: z.number(),
    totalTokens: z.number(),
    sustainPatterns: z.array(z.string()),
    improvePatterns: z.array(z.string()),
    intentAchieved: z.boolean(),
    endStateReached: z.boolean(),
    lessonsLearned: z.array(z.string()),
    summary: z.string().describe("Executive summary of campaign outcome")
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. campaign/analyze — Task decomposition via generateObject
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignAnalyzeFunction = inngest.createFunction(
    { id: "campaign-analyze", retries: 2 },
    { event: "campaign/analyze" },
    async ({ event, step }) => {
        const { campaignId } = event.data;

        console.log(`[Campaign] Analyzing campaign: ${campaignId}`);

        // Step 1: Load campaign
        const campaign = await step.run("load-campaign", async () => {
            const c = await prisma.campaign.findUniqueOrThrow({
                where: { id: campaignId }
            });
            await prisma.campaign.update({
                where: { id: campaignId },
                data: { status: CampaignStatus.ANALYZING }
            });
            await logCampaignEvent(campaignId, "analyzing", "Campaign analysis started");
            return c;
        });

        // Step 2: Decompose intent into missions and tasks
        const decomposition = await step.run("decompose-intent", async () => {
            const result = await generateObject({
                model: openai("gpt-4o"),
                schema: TaskDecompositionSchema,
                prompt: `You are a mission planner for an AI agent platform. Analyze the following campaign and decompose it into missions and tasks.

CAMPAIGN NAME: ${campaign.name}
INTENT (the WHY): ${campaign.intent}
END STATE (desired outcome): ${campaign.endState}
DESCRIPTION: ${campaign.description || "None"}
CONSTRAINTS (must-do): ${campaign.constraints.length > 0 ? campaign.constraints.join(", ") : "None"}
RESTRAINTS (must-not-do): ${campaign.restraints.length > 0 ? campaign.restraints.join(", ") : "None"}

Decompose this into missions (groups of related work) and tasks within each mission.

For each task, classify it as:
- ASSIGNED: Directly stated or implied by the intent
- IMPLIED: Not stated but necessary to accomplish the mission
- ESSENTIAL: The single most critical task that defines success

Use military-style mission statements: "verb + in order to purpose"

Order missions by dependency (sequence 0 = can run in parallel with others at sequence 0).
Order tasks within missions by dependency too.

Be thorough but practical. Don't over-decompose -- each task should map to a single agent action.`
            });
            return result.object;
        });

        // Step 3: Create Mission and MissionTask records
        await step.run("create-records", async () => {
            for (const mission of decomposition.missions) {
                const missionRecord = await prisma.mission.create({
                    data: {
                        campaignId,
                        name: mission.name,
                        missionStatement: mission.missionStatement,
                        priority: mission.priority,
                        sequence: mission.sequence,
                        status: MissionStatus.PENDING
                    }
                });

                for (const task of mission.tasks) {
                    await prisma.missionTask.create({
                        data: {
                            missionId: missionRecord.id,
                            name: task.name,
                            taskType:
                                task.taskType === "ASSIGNED"
                                    ? MissionTaskType.ASSIGNED
                                    : task.taskType === "IMPLIED"
                                      ? MissionTaskType.IMPLIED
                                      : MissionTaskType.ESSENTIAL,
                            taskVerb: task.taskVerb,
                            sequence: task.sequence,
                            coordinatingInstructions: task.coordinatingInstructions
                                ? { instructions: task.coordinatingInstructions }
                                : undefined,
                            status: MissionTaskStatus.PENDING
                        }
                    });
                }
            }

            // Store analysis output on campaign
            await prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    analysisOutput: decomposition as unknown as Prisma.InputJsonValue
                }
            });

            await logCampaignEvent(
                campaignId,
                "analyzed",
                `Decomposed into ${decomposition.missions.length} missions with ${decomposition.missions.reduce((sum, m) => sum + m.tasks.length, 0)} tasks`,
                {
                    missionCount: decomposition.missions.length,
                    essentialTask: decomposition.essentialTask
                }
            );
        });

        // Step 4: Trigger planning
        await step.sendEvent("trigger-plan", {
            name: "campaign/plan",
            data: { campaignId }
        });

        return { campaignId, missions: decomposition.missions.length };
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. campaign/plan — Agent assignment and dependency ordering
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignPlanFunction = inngest.createFunction(
    { id: "campaign-plan", retries: 2 },
    { event: "campaign/plan" },
    async ({ event, step }) => {
        const { campaignId } = event.data;

        console.log(`[Campaign] Planning campaign: ${campaignId}`);

        // Step 1: Load campaign + missions + available agents
        const context = await step.run("load-context", async () => {
            const campaign = await prisma.campaign.findUniqueOrThrow({
                where: { id: campaignId },
                include: {
                    missions: {
                        include: { tasks: true },
                        orderBy: { sequence: "asc" }
                    }
                }
            });

            // Get available agents with their tools
            const agents = await prisma.agent.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    instructions: true,
                    tools: { select: { toolId: true } }
                }
            });

            return { campaign, agents };
        });

        // Step 2: Use LLM to assign agents to tasks
        const plan = await step.run("generate-plan", async () => {
            const agentSummaries = context.agents.map((a) => ({
                slug: a.slug,
                name: a.name,
                description: a.instructions?.substring(0, 200) || "No description",
                tools: a.tools.map((t) => t.toolId).slice(0, 20)
            }));

            const missionSummaries = context.campaign.missions.map((m) => ({
                name: m.name,
                statement: m.missionStatement,
                sequence: m.sequence,
                tasks: m.tasks.map((t) => ({
                    name: t.name,
                    type: t.taskType,
                    verb: t.taskVerb,
                    sequence: t.sequence
                }))
            }));

            const result = await generateObject({
                model: openai("gpt-4o"),
                schema: PlanAssignmentSchema,
                prompt: `You are a mission planner assigning AI agents to tasks.

CAMPAIGN: ${context.campaign.name}
INTENT: ${context.campaign.intent}
CONSTRAINTS: ${context.campaign.constraints.join(", ") || "None"}
RESTRAINTS: ${context.campaign.restraints.join(", ") || "None"}
${context.campaign.maxCostUsd ? `BUDGET: $${context.campaign.maxCostUsd}` : ""}

AVAILABLE AGENTS:
${JSON.stringify(agentSummaries, null, 2)}

MISSIONS AND TASKS:
${JSON.stringify(missionSummaries, null, 2)}

For each task, assign the best-suited agent based on:
1. Agent's tools (does it have the right integrations?)
2. Agent's instructions (is it designed for this kind of work?)
3. Efficiency (minimize agent switching within a mission)

If no agent seems suitable, assign the agent with the closest capabilities.
Provide token and cost estimates per task.`
            });

            return result.object;
        });

        // Step 3: Update database with assignments
        await step.run("apply-assignments", async () => {
            for (const missionAssignment of plan.assignments) {
                const mission = context.campaign.missions.find(
                    (m) => m.name === missionAssignment.missionName
                );
                if (!mission) continue;

                for (const taskAssignment of missionAssignment.tasks) {
                    const task = mission.tasks.find((t) => t.name === taskAssignment.taskName);
                    if (!task) continue;

                    // Look up agent ID from slug
                    const agent = context.agents.find((a) => a.slug === taskAssignment.agentSlug);

                    const existingInstructions =
                        (task.coordinatingInstructions as Record<string, unknown>) || {};
                    await prisma.missionTask.update({
                        where: { id: task.id },
                        data: {
                            assignedAgentId: agent?.id || null,
                            coordinatingInstructions: {
                                ...existingInstructions,
                                agentSlug: taskAssignment.agentSlug,
                                reasoning: taskAssignment.reasoning,
                                estimatedTokens: taskAssignment.estimatedTokens,
                                estimatedCostUsd: taskAssignment.estimatedCostUsd
                            } as Prisma.InputJsonValue
                        }
                    });
                }
            }

            // Store execution plan
            await prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    executionPlan: plan as unknown as Prisma.InputJsonValue,
                    status: CampaignStatus.READY
                }
            });

            await logCampaignEvent(
                campaignId,
                "planned",
                `Execution plan created. Strategy: ${plan.executionStrategy}. Est. cost: $${plan.estimatedTotalCostUsd.toFixed(2)}`,
                {
                    strategy: plan.executionStrategy,
                    estimatedCostUsd: plan.estimatedTotalCostUsd,
                    estimatedDurationMinutes: plan.estimatedDurationMinutes
                }
            );
        });

        // Step 4: If no approval required, start execution immediately
        if (!context.campaign.requireApproval) {
            await step.sendEvent("trigger-execute", {
                name: "campaign/execute",
                data: { campaignId }
            });
        }

        return { campaignId, plan: plan.executionStrategy };
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 3. campaign/execute — Start campaign execution (fan out missions)
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignExecuteFunction = inngest.createFunction(
    { id: "campaign-execute", retries: 1 },
    { event: "campaign/execute" },
    async ({ event, step }) => {
        const { campaignId } = event.data;

        console.log(`[Campaign] Executing campaign: ${campaignId}`);

        // Step 1: Mark campaign as executing
        const campaign = await step.run("start-execution", async () => {
            const c = await prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    status: CampaignStatus.EXECUTING,
                    startedAt: new Date()
                },
                include: {
                    missions: {
                        orderBy: { sequence: "asc" }
                    }
                }
            });
            await logCampaignEvent(campaignId, "executing", "Campaign execution started");
            return c;
        });

        // Step 2: Group missions by sequence for phased execution
        const missionsBySequence = new Map<number, typeof campaign.missions>();
        for (const mission of campaign.missions) {
            const seq = mission.sequence;
            if (!missionsBySequence.has(seq)) {
                missionsBySequence.set(seq, []);
            }
            missionsBySequence.get(seq)!.push(mission);
        }

        // Step 3: Execute missions in sequence groups (parallel within each group)
        const sortedSequences = Array.from(missionsBySequence.keys()).sort((a, b) => a - b);

        for (const seq of sortedSequences) {
            const missions = missionsBySequence.get(seq)!;

            // Fan out all missions at this sequence level in parallel
            const events = missions.map((m) => ({
                name: "mission/execute" as const,
                data: { campaignId, missionId: m.id }
            }));

            await step.sendEvent(`execute-seq-${seq}`, events);

            // Wait for all missions at this sequence to complete
            for (const mission of missions) {
                await step.waitForEvent(`wait-mission-${mission.id}`, {
                    event: "mission/complete",
                    if: `async.data.missionId == '${mission.id}'`,
                    timeout: campaign.timeoutMinutes ? `${campaign.timeoutMinutes}m` : "24h"
                });
            }
        }

        // Step 4: All missions complete — trigger campaign AAR
        await step.sendEvent("trigger-campaign-aar", {
            name: "campaign/aar",
            data: { campaignId }
        });

        return { campaignId, status: "missions_complete" };
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 4. mission/execute — Execute a single mission (fan out tasks)
// ═══════════════════════════════════════════════════════════════════════════════

export const missionExecuteFunction = inngest.createFunction(
    { id: "mission-execute", retries: 1 },
    { event: "mission/execute" },
    async ({ event, step }) => {
        const { campaignId, missionId } = event.data;

        console.log(`[Mission] Executing mission: ${missionId}`);

        // Step 1: Load mission + tasks, mark as executing
        const mission = await step.run("start-mission", async () => {
            const m = await prisma.mission.update({
                where: { id: missionId },
                data: {
                    status: MissionStatus.EXECUTING,
                    startedAt: new Date()
                },
                include: {
                    tasks: { orderBy: { sequence: "asc" } },
                    campaign: true
                }
            });
            await logCampaignEvent(
                campaignId,
                "mission_started",
                `Mission "${m.name}" started with ${m.tasks.length} tasks`,
                { missionId }
            );
            return m;
        });

        // Step 2: Group tasks by sequence (parallel within groups)
        const tasksBySequence = new Map<number, typeof mission.tasks>();
        for (const task of mission.tasks) {
            const seq = task.sequence;
            if (!tasksBySequence.has(seq)) {
                tasksBySequence.set(seq, []);
            }
            tasksBySequence.get(seq)!.push(task);
        }

        const sortedSequences = Array.from(tasksBySequence.keys()).sort((a, b) => a - b);

        let missionFailed = false;

        // Step 3: Execute tasks in sequence groups
        for (const seq of sortedSequences) {
            if (missionFailed) break;

            const tasks = tasksBySequence.get(seq)!;

            // Execute all tasks at this sequence level
            const taskResults = await Promise.allSettled(
                tasks.map((task) =>
                    step.run(`task-${task.id}`, async () => {
                        return await executeTask(task, mission, campaignId);
                    })
                )
            );

            // Check results and handle actions-on
            for (let i = 0; i < taskResults.length; i++) {
                const result = taskResults[i];
                const task = tasks[i];

                if (result.status === "rejected") {
                    const actionsOn = mission.actionsOn as Record<string, string> | null;

                    console.error(`[Mission] Task "${task.name}" failed:`, result.reason);

                    if (actionsOn?.default === "skip") {
                        await prisma.missionTask.update({
                            where: { id: task.id },
                            data: {
                                status: MissionTaskStatus.SKIPPED,
                                error: String(result.reason),
                                completedAt: new Date()
                            }
                        });
                        await logCampaignEvent(
                            campaignId,
                            "task_skipped",
                            `Task "${task.name}" skipped due to error: ${String(result.reason).substring(0, 200)}`,
                            { missionId, taskId: task.id }
                        );
                    } else if (actionsOn?.default === "pause") {
                        // Pause the entire campaign
                        await prisma.campaign.update({
                            where: { id: campaignId },
                            data: { status: CampaignStatus.PAUSED }
                        });
                        await logCampaignEvent(
                            campaignId,
                            "paused",
                            `Campaign paused: task "${task.name}" failed`,
                            { missionId, taskId: task.id }
                        );
                        missionFailed = true;
                    } else {
                        // Default: fail the mission
                        missionFailed = true;
                        await prisma.missionTask.update({
                            where: { id: task.id },
                            data: {
                                status: MissionTaskStatus.FAILED,
                                error: String(result.reason),
                                completedAt: new Date()
                            }
                        });
                        await logCampaignEvent(
                            campaignId,
                            "task_failed",
                            `Task "${task.name}" failed: ${String(result.reason).substring(0, 200)}`,
                            { missionId, taskId: task.id }
                        );
                    }
                }
            }
        }

        // Step 4: Update mission status
        await step.run("finalize-mission", async () => {
            const finalStatus = missionFailed ? MissionStatus.FAILED : MissionStatus.REVIEWING;

            await prisma.mission.update({
                where: { id: missionId },
                data: {
                    status: finalStatus,
                    completedAt: new Date()
                }
            });
        });

        // Step 5: Trigger mission AAR
        await step.sendEvent("trigger-mission-aar", {
            name: "mission/aar",
            data: { campaignId, missionId }
        });

        return { missionId, failed: missionFailed };
    }
);

/**
 * Execute a single task by resolving its assigned agent and running it.
 * Creates an AgentRun via startRun, which automatically triggers
 * the existing evaluation pipeline (Tier 1 + Tier 2 + AAR).
 */
async function executeTask(
    task: {
        id: string;
        name: string;
        taskVerb: string;
        assignedAgentId: string | null;
        coordinatingInstructions: unknown;
    },
    mission: {
        id: string;
        name: string;
        missionStatement: string;
        campaign: { id: string; intent: string; name: string };
    },
    campaignId: string
): Promise<{ runId: string; output: string }> {
    // Mark task as running
    await prisma.missionTask.update({
        where: { id: task.id },
        data: { status: MissionTaskStatus.RUNNING, startedAt: new Date() }
    });

    // Determine agent slug from coordinating instructions
    const instructions = task.coordinatingInstructions as Record<string, unknown> | null;
    const agentSlug = (instructions?.agentSlug as string) || "assistant";
    const taskContext = instructions?.instructions as string | undefined;

    // Resolve the agent
    const { agent, record } = await agentResolver.resolve({ slug: agentSlug });

    if (!record) {
        throw new Error(`Agent "${agentSlug}" not found in database`);
    }

    // Build the prompt for the agent
    const prompt = `You are executing a task as part of a campaign.

CAMPAIGN: ${mission.campaign.name}
CAMPAIGN INTENT: ${mission.campaign.intent}
MISSION: ${mission.name} — ${mission.missionStatement}
TASK: ${task.name}
ACTION: ${task.taskVerb}
${taskContext ? `ADDITIONAL CONTEXT: ${taskContext}` : ""}

Execute this task thoroughly. Use your available tools as needed.
Focus on completing the specific action described above.
Report your results clearly.`;

    // Create an AgentRun via startRun (this bridges into the existing evaluation pipeline)
    const runHandle = await startRun({
        agentId: record.id,
        agentSlug: record.slug,
        input: prompt,
        source: "event",
        tenantId: undefined,
        metadata: {
            campaignId,
            missionId: mission.id,
            taskId: task.id
        }
    });

    try {
        // Generate response
        const response = await agent.generate(prompt);

        const output = response.text || "";

        // Extract usage safely (AI SDK v6 uses inputTokens/outputTokens)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usage = (response as any).usage || {};
        const promptTokens: number = usage?.inputTokens || usage?.promptTokens || 0;
        const completionTokens: number = usage?.outputTokens || usage?.completionTokens || 0;
        const totalTokens = promptTokens + completionTokens;
        const costUsd = promptTokens * 0.0000025 + completionTokens * 0.00001;

        // Complete the run — this emits run/completed which triggers evaluation pipeline
        await runHandle.complete({
            output,
            modelProvider: record.modelProvider,
            modelName: record.modelName,
            promptTokens,
            completionTokens,
            costUsd
        });

        // Update task with results
        await prisma.missionTask.update({
            where: { id: task.id },
            data: {
                status: MissionTaskStatus.COMPLETE,
                agentRunId: runHandle.runId,
                result: {
                    output: output.substring(0, 2000),
                    tokens: totalTokens
                } as Prisma.InputJsonValue,
                costUsd,
                tokens: totalTokens,
                completedAt: new Date()
            }
        });

        await logCampaignEvent(
            campaignId,
            "task_complete",
            `Task "${task.name}" completed by ${record.slug}`,
            {
                missionId: mission.id,
                taskId: task.id,
                agentSlug: record.slug,
                runId: runHandle.runId,
                costUsd
            }
        );

        // Update mission cost aggregates
        await prisma.mission.update({
            where: { id: mission.id },
            data: {
                totalCostUsd: { increment: costUsd },
                totalTokens: { increment: totalTokens }
            }
        });

        // Update campaign cost aggregates
        await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                totalCostUsd: { increment: costUsd },
                totalTokens: { increment: totalTokens }
            }
        });

        return { runId: runHandle.runId, output };
    } catch (error) {
        // Fail the run
        await runHandle.fail(error instanceof Error ? error : new Error(String(error)));

        await prisma.missionTask.update({
            where: { id: task.id },
            data: {
                status: MissionTaskStatus.FAILED,
                agentRunId: runHandle.runId,
                error: String(error),
                completedAt: new Date()
            }
        });

        throw error;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. mission/aar — Aggregate task evaluations into mission AAR
// ═══════════════════════════════════════════════════════════════════════════════

export const missionAarFunction = inngest.createFunction(
    { id: "mission-aar", retries: 2 },
    { event: "mission/aar" },
    async ({ event, step }) => {
        const { campaignId, missionId } = event.data;

        console.log(`[Mission AAR] Generating AAR for mission: ${missionId}`);

        // Step 1: Load mission tasks with their linked AgentRun evaluations
        const missionData = await step.run("load-mission-data", async () => {
            const mission = await prisma.mission.findUniqueOrThrow({
                where: { id: missionId },
                include: {
                    tasks: {
                        include: {
                            agentRun: {
                                include: { evaluation: true }
                            }
                        }
                    },
                    campaign: true
                }
            });
            return mission;
        });

        // Step 2: Aggregate task-level AARs
        const aar = await step.run("generate-mission-aar", async () => {
            const taskSummaries = missionData.tasks.map((task) => {
                const eval_ = task.agentRun?.evaluation;
                const aarData = eval_?.aarJson as Record<string, unknown> | null;
                const scores = eval_?.scoresJson as Record<string, number> | null;
                const avgScore = scores
                    ? Object.values(scores).reduce((a, b) => a + b, 0) /
                      Object.values(scores).length
                    : 0;

                return {
                    name: task.name,
                    status: task.status,
                    taskType: task.taskType,
                    score: avgScore,
                    costUsd: task.costUsd || 0,
                    tokens: task.tokens || 0,
                    durationMs:
                        task.completedAt && task.startedAt
                            ? new Date(String(task.completedAt)).getTime() -
                              new Date(String(task.startedAt)).getTime()
                            : 0,
                    sustain: (aarData?.sustain as string[]) || [],
                    improve: (aarData?.improve as string[]) || [],
                    error: task.error
                };
            });

            const result = await generateObject({
                model: openai("gpt-4o"),
                schema: MissionAarSchema,
                prompt: `Generate a mission-level After Action Review (AAR) by aggregating these task results.

MISSION: ${missionData.name}
STATEMENT: ${missionData.missionStatement}

TASK RESULTS:
${JSON.stringify(taskSummaries, null, 2)}

Synthesize the individual task sustain/improve patterns into mission-level patterns.
Identify the lowest-scoring task and explain why.
Provide a concise summary of the mission outcome.`
            });

            return result.object;
        });

        // Step 3: Store AAR and update mission status
        await step.run("store-aar", async () => {
            await prisma.mission.update({
                where: { id: missionId },
                data: {
                    aarJson: aar as unknown as Prisma.InputJsonValue,
                    status: MissionStatus.COMPLETE
                }
            });

            await logCampaignEvent(
                campaignId,
                "mission_aar",
                `Mission "${missionData.name}" AAR complete. Score: ${aar.avgTaskScore.toFixed(2)}. ${aar.completedTasks}/${aar.plannedTasks} tasks completed.`,
                { missionId, aar }
            );
        });

        // Step 4: Update campaign progress
        await step.run("update-progress", async () => {
            const allMissions = await prisma.mission.findMany({
                where: { campaignId }
            });
            const completedCount = allMissions.filter(
                (m) => m.status === MissionStatus.COMPLETE || m.status === MissionStatus.FAILED
            ).length;
            const progress =
                allMissions.length > 0 ? (completedCount / allMissions.length) * 100 : 0;

            await prisma.campaign.update({
                where: { id: campaignId },
                data: { progress }
            });
        });

        // Step 5: Signal mission complete (for waitForEvent in campaign/execute)
        await step.sendEvent("signal-mission-complete", {
            name: "mission/complete",
            data: { campaignId, missionId }
        });

        return { missionId, aar };
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 6. campaign/aar — Aggregate mission AARs into campaign AAR
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignAarFunction = inngest.createFunction(
    { id: "campaign-aar", retries: 2 },
    { event: "campaign/aar" },
    async ({ event, step }) => {
        const { campaignId } = event.data;

        console.log(`[Campaign AAR] Generating AAR for campaign: ${campaignId}`);

        // Step 1: Load everything
        const campaignData = await step.run("load-campaign-data", async () => {
            const campaign = await prisma.campaign.findUniqueOrThrow({
                where: { id: campaignId },
                include: {
                    missions: {
                        include: {
                            tasks: {
                                include: {
                                    agentRun: {
                                        include: { evaluation: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            return campaign;
        });

        // Step 2: Generate campaign-level AAR
        const aar = await step.run("generate-campaign-aar", async () => {
            const missionSummaries = campaignData.missions.map((m) => {
                const missionAar = m.aarJson as Record<string, unknown> | null;
                return {
                    name: m.name,
                    status: m.status,
                    statement: m.missionStatement,
                    taskCount: m.tasks.length,
                    completedTasks: m.tasks.filter((t) => t.status === MissionTaskStatus.COMPLETE)
                        .length,
                    failedTasks: m.tasks.filter((t) => t.status === MissionTaskStatus.FAILED)
                        .length,
                    costUsd: m.totalCostUsd,
                    tokens: m.totalTokens,
                    aar: missionAar
                };
            });

            const startTime = campaignData.startedAt
                ? new Date(String(campaignData.startedAt)).getTime()
                : Date.now();
            const endTime = Date.now();

            const result = await generateObject({
                model: openai("gpt-4o"),
                schema: CampaignAarSchema,
                prompt: `Generate a campaign-level After Action Review (AAR) by aggregating these mission AARs.

CAMPAIGN: ${campaignData.name}
INTENT: ${campaignData.intent}
END STATE: ${campaignData.endState}
CONSTRAINTS: ${campaignData.constraints.join(", ") || "None"}
RESTRAINTS: ${campaignData.restraints.join(", ") || "None"}
${campaignData.maxCostUsd ? `BUDGET: $${campaignData.maxCostUsd}` : ""}

PLANNED DURATION: Campaign started ${new Date(startTime).toISOString()}, ended ${new Date(endTime).toISOString()}
ACTUAL COST: $${campaignData.totalCostUsd.toFixed(2)}

MISSION RESULTS:
${JSON.stringify(missionSummaries, null, 2)}

Evaluate:
1. Was the commander's intent achieved?
2. Was the desired end state reached?
3. Roll up sustain/improve patterns from missions
4. Identify campaign-level lessons learned
5. Provide an executive summary`
            });

            return result.object;
        });

        // Step 3: Store AAR and complete campaign
        await step.run("complete-campaign", async () => {
            const allMissionsFailed = campaignData.missions.every(
                (m) => m.status === MissionStatus.FAILED
            );

            await prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    aarJson: aar as unknown as Prisma.InputJsonValue,
                    status: allMissionsFailed ? CampaignStatus.FAILED : CampaignStatus.COMPLETE,
                    progress: 100,
                    completedAt: new Date()
                }
            });

            await logCampaignEvent(
                campaignId,
                "campaign_aar",
                `Campaign AAR complete. Intent achieved: ${aar.intentAchieved}. End state: ${aar.endStateReached}. Score: ${aar.avgTaskScore.toFixed(2)}.`,
                { aar }
            );

            await logCampaignEvent(
                campaignId,
                "complete",
                `Campaign "${campaignData.name}" ${allMissionsFailed ? "FAILED" : "COMPLETE"}. Cost: $${aar.totalCostUsd.toFixed(2)}. Missions: ${aar.completedMissions}/${aar.plannedMissions}.`
            );
        });

        return { campaignId, aar };
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Export all campaign functions
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignFunctions = [
    campaignAnalyzeFunction,
    campaignPlanFunction,
    campaignExecuteFunction,
    missionExecuteFunction,
    missionAarFunction,
    campaignAarFunction
];
