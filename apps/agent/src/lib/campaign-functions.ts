/**
 * Campaign / Mission / Task Inngest Functions
 *
 * Implements the Campaign-Mission architecture for autonomous multi-agent orchestration.
 * Uses the "Mission Command" principle: tell the platform WHAT to achieve, not HOW.
 *
 * Architecture: Agent-First
 * Every phase is driven by a system agent with skills. Inngest functions are thin wiring.
 * - campaign-analyst: Decomposes intent into missions/tasks
 * - campaign-planner: Assigns agents to tasks, detects capability gaps
 * - campaign-architect: Builds new agents/skills for capability gaps
 * - campaign-reviewer: Generates After Action Reviews
 *
 * Event Chain:
 *   campaign/created
 *     -> campaign/analyze  (campaign-analyst agent)
 *       -> campaign/plan   (campaign-planner agent)
 *         -> campaign/build-capabilities (campaign-architect, if gaps)
 *           -> campaign/plan (re-plan with new agents)
 *         -> mission/execute (per mission, sequential or parallel)
 *           -> mission/task.execute (per task, creates AgentRun)
 *             -> [existing] run/completed -> run/evaluate (existing AAR pipeline)
 *           -> mission/tasks.complete (all tasks done)
 *             -> mission/aar (campaign-reviewer agent)
 *         -> campaign/missions.complete (all missions done)
 *           -> campaign/aar (campaign-reviewer agent)
 *             -> campaign/complete
 */

import { inngest } from "./inngest";
import { prisma, Prisma, CampaignStatus, MissionStatus, MissionTaskStatus } from "@repo/database";
import { agentResolver } from "@repo/agentc2/agents";
import { invalidateMcpCacheForOrg } from "@repo/agentc2/mcp";
import { recordActivity } from "@repo/agentc2/activity/service";
import {
    startRun,
    extractToolCalls,
    extractTokenUsage,
    type RunRecorderHandle
} from "./run-recorder";
import { calculateCost } from "./cost-calculator";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TASK_MAX_RETRIES = 2;

/**
 * Classify whether an error is retryable (transient) or permanent.
 * Retryable: network errors, rate limits, timeouts, MCP tool-not-found (first attempt).
 * NOT retryable: auth errors, validation errors, budget exceeded.
 */
function isRetryableError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    // Network / transient errors
    if (msg.includes("econnrefused") || msg.includes("econnreset")) return true;
    if (msg.includes("timeout") || msg.includes("timed out")) return true;
    if (msg.includes("rate limit") || msg.includes("429")) return true;
    if (msg.includes("503") || msg.includes("service unavailable")) return true;
    if (msg.includes("502") || msg.includes("bad gateway")) return true;
    // Tool not found: retryable ONCE (MCP server may have been down on first load)
    if (msg.includes("tool") && msg.includes("not found")) return true;
    // NOT retryable — permanent errors
    if (msg.includes("unauthorized") || msg.includes("forbidden")) return false;
    if (msg.includes("budget exceeded")) return false;
    if (msg.includes("campaign budget exceeded")) return false;
    if (msg.includes("context limit") || msg.includes("context_length_exceeded")) return false;
    if (msg.includes("exceed context limit")) return false;
    return false;
}

/**
 * Check if an error is a tool-not-found error that may benefit from MCP cache clearing.
 */
function isToolNotFoundError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return msg.includes("tool") && msg.includes("not found");
}

/**
 * Extract and record tool calls from an agent.generate() response.
 * This ensures Inngest-triggered runs have the same trace/tool data as API-invoked runs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recordToolCallsFromResponse(response: any, runHandle: RunRecorderHandle) {
    const toolCalls = extractToolCalls(response);
    for (const tc of toolCalls) {
        await runHandle.addToolCall(tc);
    }
}

/**
 * Invoke a system agent for a campaign phase and record the run.
 *
 * Centralises the repeated resolve → startRun → generate → extractToolCalls →
 * extractTokenUsage → complete / fail pattern used by every campaign phase.
 */
async function invokeCampaignAgent(opts: {
    agentSlug: string;
    prompt: string;
    campaignId: string;
    phase: string;
    metadata?: Record<string, unknown>;
}): Promise<{ runId: string; output: string }> {
    const { agent, record } = await agentResolver.resolve({
        slug: opts.agentSlug,
        loadAllSkills: true // Campaign agents need full capability
    });
    if (!record) throw new Error(`${opts.agentSlug} agent not found in database`);

    const runHandle = await startRun({
        agentId: record.id,
        agentSlug: record.slug,
        input: opts.prompt,
        source: "event",
        metadata: { campaignId: opts.campaignId, phase: opts.phase, ...opts.metadata }
    });

    try {
        const response = await agent.generate(opts.prompt, {
            maxSteps: record.maxSteps || 8,
            ...(record.maxTokens ? { maxTokens: record.maxTokens } : { maxTokens: 16384 })
        });

        // Record tool calls for trace visibility
        await recordToolCallsFromResponse(response, runHandle);

        const output = response.text || "";

        // Use the robust token-extraction utility (handles totalUsage, step aggregation, etc.)
        const tokenUsage = extractTokenUsage(response) || {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
        };
        // Model-specific cost calculation using the pricing table
        const costUsd = calculateCost(
            record.modelName,
            record.modelProvider,
            tokenUsage.promptTokens,
            tokenUsage.completionTokens
        );

        await runHandle.complete({
            output,
            modelProvider: record.modelProvider,
            modelName: record.modelName,
            promptTokens: tokenUsage.promptTokens,
            completionTokens: tokenUsage.completionTokens,
            costUsd
        });

        // Include system agent costs in campaign total
        await prisma.campaign.update({
            where: { id: opts.campaignId },
            data: {
                totalCostUsd: { increment: costUsd },
                totalTokens: { increment: tokenUsage.totalTokens }
            }
        });

        await logCampaignEvent(
            opts.campaignId,
            opts.phase,
            `${opts.agentSlug} complete. Agent run: ${runHandle.runId}`,
            { runId: runHandle.runId, agentSlug: record.slug }
        );

        return { runId: runHandle.runId, output };
    } catch (err) {
        await runHandle.fail(err instanceof Error ? err.message : String(err));
        throw err;
    }
}

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

// ─── Note: Schemas previously used by generateObject have been removed. ──────
// All structured output is now handled by system agents (campaign-analyst,
// campaign-planner, campaign-architect, campaign-reviewer) using their
// respective tools (campaign-write-missions, campaign-write-plan, campaign-write-aar).
// The tools themselves enforce the data shape via their Zod input schemas.

// ═══════════════════════════════════════════════════════════════════════════════
// 1. campaign/analyze — Task decomposition via campaign-analyst agent
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignAnalyzeFunction = inngest.createFunction(
    {
        id: "campaign-analyze",
        retries: 2,
        onFailure: async ({ event, error }) => {
            const { campaignId } = event.data.event.data;
            console.error(`[Campaign] Analysis failed for ${campaignId}:`, error.message);
            await prisma.campaign.update({
                where: { id: campaignId },
                data: { status: CampaignStatus.FAILED }
            });
            await logCampaignEvent(
                campaignId,
                "failed",
                `Campaign analysis failed after all retries: ${error.message}`
            );
            recordActivity({
                type: "CAMPAIGN_FAILED",
                summary: `Campaign analysis failed: ${error.message}`,
                status: "failure",
                source: "campaign",
                campaignId
            });
        }
    },
    { event: "campaign/analyze" },
    async ({ event, step }) => {
        const { campaignId } = event.data;

        console.log(`[Campaign] Analyzing campaign: ${campaignId}`);

        // Step 1: Set status and log
        await step.run("set-status", async () => {
            await prisma.campaign.update({
                where: { id: campaignId },
                data: { status: CampaignStatus.ANALYZING }
            });
            await logCampaignEvent(
                campaignId,
                "analyzing",
                "Campaign analysis started — invoking campaign-analyst agent"
            );
        });

        // Step 2: Resolve campaign-analyst agent and let it decompose
        const result = await step.run("invoke-analyst", async () => {
            // Load campaign data directly (avoids HTTP auth issues in Inngest context)
            const campaignData = await prisma.campaign.findUniqueOrThrow({
                where: { id: campaignId },
                select: {
                    id: true,
                    name: true,
                    intent: true,
                    endState: true,
                    description: true,
                    constraints: true,
                    restraints: true
                }
            });

            const contextPrompt = `Analyze this campaign and decompose it into missions and tasks using the campaign-write-missions tool.

Campaign ID: ${campaignId}
Name: ${campaignData.name}
Intent: ${campaignData.intent}
End State: ${campaignData.endState}
${campaignData.description ? `Description: ${campaignData.description}` : ""}
${campaignData.constraints && (campaignData.constraints as string[]).length > 0 ? `Constraints: ${JSON.stringify(campaignData.constraints)}` : ""}
${campaignData.restraints && (campaignData.restraints as string[]).length > 0 ? `Restraints: ${JSON.stringify(campaignData.restraints)}` : ""}

Decompose this into missions (high-level objectives) and tasks (concrete work items). Use the campaign-write-missions tool to persist your analysis.`;

            return invokeCampaignAgent({
                agentSlug: "campaign-analyst",
                prompt: contextPrompt,
                campaignId,
                phase: "analysis"
            });
        });

        // Step 3: Validate that the analyst actually created missions
        const validation = await step.run("validate-analysis", async () => {
            const missionCount = await prisma.mission.count({ where: { campaignId } });
            if (missionCount === 0) {
                // Log the failure but don't throw — the agent may have generated text without calling the tool
                await logCampaignEvent(
                    campaignId,
                    "analysis_validation_failed",
                    `Analyst agent did not create any missions. The campaign-write-missions tool may not have been called. Retrying...`
                );
                throw new Error(
                    "Analysis validation failed: no missions created. The campaign-analyst agent did not call the campaign-write-missions tool."
                );
            }
            const taskCount = await prisma.missionTask.count({
                where: { mission: { campaignId } }
            });
            await logCampaignEvent(
                campaignId,
                "analysis_validated",
                `Analysis produced ${missionCount} missions with ${taskCount} tasks`
            );
            return { missionCount, taskCount };
        });

        // Step 4: Trigger planning
        await step.sendEvent("trigger-plan", {
            name: "campaign/plan",
            data: { campaignId }
        });

        return {
            campaignId,
            analystRunId: result.runId,
            missions: validation.missionCount,
            tasks: validation.taskCount
        };
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. campaign/plan — Execution plan via campaign-planner agent
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignPlanFunction = inngest.createFunction(
    {
        id: "campaign-plan",
        retries: 2,
        onFailure: async ({ event, error }) => {
            const { campaignId } = event.data.event.data;
            console.error(`[Campaign] Planning failed for ${campaignId}:`, error.message);
            await prisma.campaign.update({
                where: { id: campaignId },
                data: { status: CampaignStatus.FAILED }
            });
            await logCampaignEvent(
                campaignId,
                "failed",
                `Campaign planning failed after all retries: ${error.message}`
            );
            recordActivity({
                type: "CAMPAIGN_FAILED",
                summary: `Campaign planning failed: ${error.message}`,
                status: "failure",
                source: "campaign",
                campaignId
            });
        }
    },
    { event: "campaign/plan" },
    async ({ event, step }) => {
        const { campaignId } = event.data;

        console.log(`[Campaign] Planning campaign: ${campaignId}`);

        // Step 1: Invoke campaign-planner agent
        const result = await step.run("invoke-planner", async () => {
            // Load campaign data with missions/tasks directly (avoids HTTP auth issues in Inngest context)
            const campaignData = await prisma.campaign.findUniqueOrThrow({
                where: { id: campaignId },
                include: {
                    missions: {
                        include: { tasks: true }
                    }
                }
            });

            const contextPrompt = `Plan this campaign by assigning agents to tasks. Use agent-list to see available agents, then use campaign-write-plan to persist assignments. If no suitable agent exists for a task, include it in gapsDetected.

Campaign ID: ${campaignId}
Name: ${campaignData.name}
Intent: ${campaignData.intent}
End State: ${campaignData.endState}
${campaignData.description ? `Description: ${campaignData.description}` : ""}

Missions and Tasks:
${JSON.stringify(
    campaignData.missions.map((m) => ({
        name: m.name,
        missionStatement: m.missionStatement,
        priority: m.priority,
        tasks: m.tasks.map((t) => ({
            name: t.name,
            taskVerb: t.taskVerb,
            taskType: t.taskType,
            sequence: t.sequence
        }))
    })),
    null,
    2
)}

For each task, evaluate which active agent is best suited. Use campaign-write-plan to write your assignments.`;

            return invokeCampaignAgent({
                agentSlug: "campaign-planner",
                prompt: contextPrompt,
                campaignId,
                phase: "planning"
            });
        });

        // Step 2: Validate planning output and check for capability gaps
        const campaign = await step.run("validate-and-check-gaps", async () => {
            const c = await prisma.campaign.findUniqueOrThrow({
                where: { id: campaignId },
                select: {
                    executionPlan: true,
                    requireApproval: true,
                    status: true
                }
            });

            // Validate that the planner actually wrote a plan
            if (!c.executionPlan) {
                await logCampaignEvent(
                    campaignId,
                    "planning_validation_failed",
                    `Planner agent did not write an execution plan. The campaign-write-plan tool may not have been called. Retrying...`
                );
                throw new Error(
                    "Planning validation failed: no execution plan created. The campaign-planner agent did not call the campaign-write-plan tool."
                );
            }

            await logCampaignEvent(
                campaignId,
                "planning_validated",
                `Execution plan written successfully`
            );

            return c;
        });

        const plan = campaign.executionPlan as Record<string, unknown> | null;
        const gaps = (plan?.gapsDetected as unknown[]) || [];

        if (gaps.length > 0) {
            // Capability gaps found — invoke the architect
            await step.sendEvent("trigger-build-capabilities", {
                name: "campaign/build-capabilities",
                data: { campaignId }
            });
            return { campaignId, plannerRunId: result.runId, gapsFound: gaps.length };
        }

        // Step 3: No gaps — if no approval required, start execution
        if (!campaign.requireApproval) {
            await step.sendEvent("trigger-execute", {
                name: "campaign/execute",
                data: { campaignId }
            });
        }

        return { campaignId, plannerRunId: result.runId, gapsFound: 0 };
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 2b. campaign/build-capabilities — Build new agents/skills for capability gaps
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignBuildCapabilitiesFunction = inngest.createFunction(
    {
        id: "campaign-build-capabilities",
        retries: 1,
        onFailure: async ({ event, error }) => {
            const { campaignId } = event.data.event.data;
            console.error(`[Campaign] Capability build failed for ${campaignId}:`, error.message);
            // Don't fail the campaign — fall back to planning without new agents
            await logCampaignEvent(
                campaignId,
                "capability_build_failed",
                `Architect failed to build capabilities: ${error.message}. Proceeding with available agents.`
            );
            // Re-trigger plan — the planner will assign best-available agents
            await inngest.send({
                name: "campaign/plan",
                data: { campaignId }
            });
        }
    },
    { event: "campaign/build-capabilities" },
    async ({ event, step }) => {
        const { campaignId } = event.data;

        console.log(`[Campaign] Building capabilities for campaign: ${campaignId}`);

        // Step 1: Invoke campaign-architect agent
        const result = await step.run("invoke-architect", async () => {
            // Load campaign data with gap details directly (avoids HTTP auth issues in Inngest context)
            const campaignData = await prisma.campaign.findUniqueOrThrow({
                where: { id: campaignId },
                select: { name: true, intent: true, endState: true, executionPlan: true }
            });
            const plan = campaignData.executionPlan as Record<string, unknown> | null;
            const gaps = plan?.gapsDetected || [];

            const contextPrompt = `Build capabilities for this campaign. The campaign planner identified capability gaps that need new agents or skills.

Campaign ID: ${campaignId}
Name: ${campaignData.name}
Intent: ${campaignData.intent}
End State: ${campaignData.endState}

Capability Gaps Detected:
${JSON.stringify(gaps, null, 2)}

Use skill-list to check existing skills before creating anything new. Build the agents and skills needed to fill these gaps. Follow the reuse-first strategy: only create new resources when no existing agent or skill can handle the requirement.`;

            return invokeCampaignAgent({
                agentSlug: "campaign-architect",
                prompt: contextPrompt,
                campaignId,
                phase: "architecture",
                metadata: { gapCount: (gaps as unknown[]).length }
            });
        });

        // Step 2: Re-trigger planning — the planner now sees the new agents
        await step.sendEvent("re-plan", {
            name: "campaign/plan",
            data: { campaignId }
        });

        return { campaignId, architectRunId: result.runId };
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// 3. campaign/execute — Start campaign execution (fan out missions)
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignExecuteFunction = inngest.createFunction(
    {
        id: "campaign-execute",
        retries: 1,
        onFailure: async ({ event, error }) => {
            const { campaignId } = event.data.event.data;
            console.error(`[Campaign] Execution failed for ${campaignId}:`, error.message);
            await prisma.campaign.update({
                where: { id: campaignId },
                data: { status: CampaignStatus.FAILED }
            });
            await logCampaignEvent(
                campaignId,
                "failed",
                `Campaign execution failed after all retries: ${error.message}`
            );
            recordActivity({
                type: "CAMPAIGN_FAILED",
                summary: `Campaign execution failed: ${error.message}`,
                status: "failure",
                source: "campaign",
                campaignId
            });
        }
    },
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

            // Record to Activity Feed
            recordActivity({
                type: "CAMPAIGN_STARTED",
                summary: `Campaign "${c.name}" execution started (${c.missions.length} missions)`,
                status: "info",
                source: "campaign",
                campaignId,
                metadata: { missionCount: c.missions.length }
            });

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

        let allUpstreamFailed = false;
        // Collect prior mission outputs for inter-mission data transfer
        let priorMissionContext = "";

        for (const seq of sortedSequences) {
            const missions = missionsBySequence.get(seq)!;

            // Fix 2F: Skip doomed missions when all upstream missions failed
            if (allUpstreamFailed) {
                await step.run(`skip-doomed-seq-${seq}`, async () => {
                    for (const m of missions) {
                        await prisma.mission.update({
                            where: { id: m.id },
                            data: {
                                status: MissionStatus.FAILED,
                                completedAt: new Date()
                            }
                        });
                        // Skip all tasks in this mission
                        await prisma.missionTask.updateMany({
                            where: { missionId: m.id },
                            data: {
                                status: MissionTaskStatus.SKIPPED,
                                error: "Skipped: all upstream missions failed",
                                completedAt: new Date()
                            }
                        });
                    }
                    await logCampaignEvent(
                        campaignId,
                        "missions_skipped",
                        `Skipped ${missions.length} mission(s) at sequence ${seq}: all upstream missions failed`,
                        {
                            skippedMissionIds: missions.map((m) => m.id),
                            sequence: seq
                        }
                    );
                });
                continue;
            }

            // Fan out all missions at this sequence level in parallel
            const events = missions.map((m) => ({
                name: "mission/execute" as const,
                data: {
                    campaignId,
                    missionId: m.id,
                    priorMissionContext: priorMissionContext || undefined
                }
            }));

            await step.sendEvent(`execute-seq-${seq}`, events);

            // Wait for all missions at this sequence to be reviewed (supports rework loop)
            // Each mission may go through multiple iterations if the reviewer requests rework
            for (const mission of missions) {
                let missionDone = false;
                let iteration = 0;
                while (!missionDone) {
                    const reviewResult = await step.waitForEvent(
                        `wait-mission-${mission.id}-iter-${iteration}`,
                        {
                            event: "mission/reviewed",
                            if: `async.data.missionId == '${mission.id}'`,
                            timeout: campaign.timeoutMinutes ? `${campaign.timeoutMinutes}m` : "24h"
                        }
                    );
                    if (reviewResult?.data?.decision === "rework") {
                        iteration++;
                        // Re-trigger mission execution with rework flag
                        await step.sendEvent(`rework-mission-${mission.id}-iter-${iteration}`, {
                            name: "mission/execute",
                            data: {
                                campaignId,
                                missionId: mission.id,
                                isRework: true,
                                priorMissionContext: priorMissionContext || undefined
                            }
                        });
                    } else {
                        missionDone = true;
                    }
                }
            }

            // Check if ALL missions at this sequence failed (to decide whether downstream is doomed)
            const missionStatuses = await step.run(`check-seq-${seq}-status`, async () => {
                const statuses = await prisma.mission.findMany({
                    where: { id: { in: missions.map((m) => m.id) } },
                    select: { id: true, status: true }
                });
                return statuses;
            });

            const allFailed = missionStatuses.every((s) => s.status === MissionStatus.FAILED);

            // Mission-level approval gate: if any mission in this sequence requires
            // approval, pause and wait for human approval before proceeding
            const needsApproval = missions.some((m) => m.requiresApproval);
            if (needsApproval && !allFailed) {
                // Set missions to AWAITING_APPROVAL
                await step.run(`set-awaiting-approval-seq-${seq}`, async () => {
                    for (const m of missions) {
                        if (m.requiresApproval) {
                            await prisma.mission.update({
                                where: { id: m.id },
                                data: { status: MissionStatus.AWAITING_APPROVAL }
                            });
                        }
                    }
                    await logCampaignEvent(
                        campaignId,
                        "awaiting_approval",
                        `Mission sequence ${seq} completed — awaiting human approval before proceeding`,
                        {
                            sequence: seq,
                            missionIds: missions.filter((m) => m.requiresApproval).map((m) => m.id)
                        }
                    );
                });

                // Wait for approval event
                await step.waitForEvent(`wait-approval-seq-${seq}`, {
                    event: "mission/approved",
                    if: `async.data.campaignId == '${campaignId}' && async.data.sequence == '${seq}'`,
                    timeout: "24h"
                });

                // Update approved missions
                await step.run(`mark-approved-seq-${seq}`, async () => {
                    for (const m of missions) {
                        if (m.requiresApproval) {
                            await prisma.mission.update({
                                where: { id: m.id },
                                data: {
                                    status: MissionStatus.COMPLETE,
                                    approvedAt: new Date()
                                }
                            });
                        }
                    }
                    await logCampaignEvent(
                        campaignId,
                        "approved",
                        `Mission sequence ${seq} approved — proceeding to next sequence`,
                        { sequence: seq }
                    );
                });
            }

            if (allFailed && missions.length > 0) {
                allUpstreamFailed = true;
                await logCampaignEvent(
                    campaignId,
                    "upstream_failed",
                    `All ${missions.length} mission(s) at sequence ${seq} failed. Downstream missions may be skipped.`,
                    { sequence: seq }
                );
            }

            // Collect completed mission outputs for inter-mission data transfer
            const seqOutputs = await step.run(`collect-seq-${seq}-outputs`, async () => {
                const completedTasks = await prisma.missionTask.findMany({
                    where: {
                        mission: {
                            id: { in: missions.map((m) => m.id) }
                        },
                        status: MissionTaskStatus.COMPLETE
                    },
                    select: {
                        name: true,
                        result: true,
                        mission: { select: { name: true } }
                    }
                });
                return completedTasks.map((t) => {
                    const result =
                        typeof t.result === "object" && t.result !== null
                            ? ((t.result as Record<string, unknown>).output as string) || ""
                            : "";
                    return {
                        missionName: t.mission.name,
                        taskName: t.name,
                        // Truncate to 3000 chars per task to manage context
                        output: result.substring(0, 3000)
                    };
                });
            });

            if (seqOutputs.length > 0) {
                const newContext = seqOutputs
                    .map(
                        (o) =>
                            `=== Mission: ${o.missionName} / Task: "${o.taskName}" ===\n${o.output}`
                    )
                    .join("\n\n");
                priorMissionContext = priorMissionContext
                    ? priorMissionContext + "\n\n" + newContext
                    : newContext;
            }

            // Context size management: summarize when accumulated context exceeds 15K chars
            if (priorMissionContext.length > 15000) {
                const originalLength = priorMissionContext.length;
                try {
                    const summaryResult = await step.run(
                        `summarize-context-seq-${seq}`,
                        async () => {
                            return await invokeCampaignAgent({
                                agentSlug: "campaign-analyst",
                                prompt: `Summarize the following mission results into the key facts, data points, specific numbers, and conclusions that downstream missions will need. Preserve all specific data (prices, metrics, names, URLs). Keep under 5000 characters.\n\n${priorMissionContext}`,
                                campaignId,
                                phase: "context-summarization"
                            });
                        }
                    );
                    priorMissionContext = `[SUMMARIZED FROM ${originalLength} CHARS OF PRIOR MISSION RESULTS]\n${summaryResult.output.substring(0, 5000)}`;
                    console.log(
                        `[Campaign] Context summarized: ${originalLength} -> ${priorMissionContext.length} chars`
                    );
                } catch (summarizeErr) {
                    console.warn(
                        `[Campaign] Context summarization failed, truncating instead:`,
                        summarizeErr
                    );
                    priorMissionContext =
                        priorMissionContext.substring(0, 15000) +
                        "\n[... truncated from " +
                        originalLength +
                        " chars]";
                }
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
    {
        id: "mission-execute",
        retries: 1,
        onFailure: async ({ event, error }) => {
            const { campaignId, missionId } = event.data.event.data;
            console.error(
                `[Mission] Execution failed for mission ${missionId} in campaign ${campaignId}:`,
                error.message
            );
            await prisma.mission.update({
                where: { id: missionId },
                data: { status: MissionStatus.FAILED }
            });
            await logCampaignEvent(
                campaignId,
                "mission_failed",
                `Mission ${missionId} failed after all retries: ${error.message}`,
                { missionId }
            );
        }
    },
    { event: "mission/execute" },
    async ({ event, step }) => {
        const { campaignId, missionId, priorMissionContext, isRework } = event.data as {
            campaignId: string;
            missionId: string;
            priorMissionContext?: string;
            isRework?: boolean;
        };

        console.log(`[Mission] ${isRework ? "REWORKING" : "Executing"} mission: ${missionId}`);

        // If this is a rework iteration, reset all tasks to PENDING
        if (isRework) {
            await step.run("reset-tasks-for-rework", async () => {
                await prisma.missionTask.updateMany({
                    where: {
                        missionId,
                        status: { in: ["COMPLETE", "FAILED", "SKIPPED"] }
                    },
                    data: {
                        status: MissionTaskStatus.PENDING,
                        error: null,
                        result: Prisma.DbNull,
                        agentRunId: null,
                        costUsd: null,
                        tokens: null,
                        startedAt: null,
                        completedAt: null
                    }
                });
                await logCampaignEvent(
                    campaignId,
                    "mission_rework",
                    `Mission "${missionId}" tasks reset for rework iteration`,
                    { missionId, isRework: true }
                );
            });
        }

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
                `Mission "${m.name}" ${isRework ? `(rework iteration ${m.currentIteration})` : ""} started with ${m.tasks.length} tasks`,
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

        let failedCount = 0;
        let completedCount = 0;
        let essentialFailed = false;
        // Collect completed task results to pass as context to downstream tasks
        const completedTaskOutputs: Array<{ name: string; output: string }> = [];

        // Step 3: Execute tasks in sequence groups
        for (const seq of sortedSequences) {
            // Stop early only if: essential task failed OR campaign paused
            if (essentialFailed) break;

            const tasks = tasksBySequence.get(seq)!;

            // Build prior results context for downstream tasks (sequence > 0)
            const priorResultsSummary =
                completedTaskOutputs.length > 0
                    ? completedTaskOutputs
                          .map(
                              (r) =>
                                  `--- "${r.name}" ---\n${r.output.substring(0, 2000)}${r.output.length > 2000 ? "\n[... truncated]" : ""}`
                          )
                          .join("\n\n")
                    : undefined;

            // Filter out tasks that are already completed/failed (e.g. from Inngest retry)
            const pendingTasks = tasks.filter(
                (t) =>
                    t.status === MissionTaskStatus.PENDING || t.status === MissionTaskStatus.RUNNING
            );

            // If this is a rework iteration, prepend rework feedback to context
            let effectiveContext = priorMissionContext;
            if (isRework && mission.reworkReason) {
                const reworkPrefix = `\n\nREWORK FEEDBACK FROM REVIEWER (address these issues):\n${mission.reworkReason}\n`;
                effectiveContext = reworkPrefix + (effectiveContext || "");
            }

            // Execute all pending tasks at this sequence level
            const taskResults = await Promise.allSettled(
                pendingTasks.map((task) =>
                    step.run(`task-${task.id}`, async () => {
                        return await executeTask(
                            task,
                            mission,
                            campaignId,
                            priorResultsSummary,
                            effectiveContext
                        );
                    })
                )
            );

            // Check results — collect failures but continue executing
            for (let i = 0; i < taskResults.length; i++) {
                const result = taskResults[i];
                const task = pendingTasks[i];

                if (result.status === "fulfilled") {
                    completedCount++;
                    completedTaskOutputs.push({
                        name: task.name,
                        output: result.value.output
                    });
                } else if (result.status === "rejected") {
                    failedCount++;
                    const actionsOn = mission.actionsOn as Record<string, string> | null;

                    console.error(`[Mission] Task "${task.name}" failed:`, result.reason);

                    // Check if this was the ESSENTIAL task
                    if (task.taskType === "ESSENTIAL") {
                        essentialFailed = true;
                    }

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
                        essentialFailed = true; // Stop further execution
                    } else {
                        // Default: log the failure but continue executing other tasks
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

        // Mark any remaining PENDING tasks as SKIPPED if we stopped early
        if (essentialFailed) {
            await step.run("skip-remaining-tasks", async () => {
                await prisma.missionTask.updateMany({
                    where: {
                        missionId,
                        status: MissionTaskStatus.PENDING
                    },
                    data: {
                        status: MissionTaskStatus.SKIPPED,
                        error: "Skipped: essential task failed or campaign paused",
                        completedAt: new Date()
                    }
                });
            });
        }

        // Step 4: Determine mission outcome
        // Mission fails only if ALL tasks failed OR the essential task failed
        const missionFailed = essentialFailed || (failedCount > 0 && completedCount === 0);

        await step.run("finalize-mission", async () => {
            const finalStatus = missionFailed ? MissionStatus.FAILED : MissionStatus.REVIEWING;

            await prisma.mission.update({
                where: { id: missionId },
                data: {
                    status: finalStatus,
                    completedAt: new Date()
                }
            });

            if (failedCount > 0 && !missionFailed) {
                await logCampaignEvent(
                    campaignId,
                    "mission_partial",
                    `Mission "${mission.name}" completed with partial results: ${completedCount} completed, ${failedCount} failed`,
                    { missionId, completedCount, failedCount }
                );
            }
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
        taskType?: string;
        status?: string;
        assignedAgentId: string | null;
        coordinatingInstructions: unknown;
    },
    mission: {
        id: string;
        name: string;
        missionStatement: string;
        campaign: { id: string; intent: string; name: string };
    },
    campaignId: string,
    priorResults?: string,
    priorMissionContext?: string
): Promise<{ runId: string; output: string }> {
    // Pre-flight: check campaign budget before executing
    const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { totalCostUsd: true, maxCostUsd: true }
    });
    if (currentCampaign?.maxCostUsd && currentCampaign.totalCostUsd >= currentCampaign.maxCostUsd) {
        throw new Error(
            `Campaign budget exceeded: $${currentCampaign.totalCostUsd.toFixed(2)} / $${currentCampaign.maxCostUsd} limit`
        );
    }

    // Mark task as running
    await prisma.missionTask.update({
        where: { id: task.id },
        data: { status: MissionTaskStatus.RUNNING, startedAt: new Date() }
    });

    // Determine agent slug and context from coordinating instructions
    const instructions = task.coordinatingInstructions as Record<string, unknown> | null;
    const agentSlug = (instructions?.agentSlug as string) || "assistant";
    const taskContext = instructions?.instructions as string | undefined;
    const plannerInstructions = instructions?.plannerInstructions as string | undefined;
    const plannerReasoning = instructions?.reasoning as string | undefined;

    // Extract tool hints from coordinating instructions for filtering
    const toolHints = instructions?.toolHints as string[] | undefined;

    // Resolve the agent with all skills loaded for campaign execution
    const { agent, record, activeSkills } = await agentResolver.resolve({
        slug: agentSlug,
        loadAllSkills: true, // Campaign tasks need full capability
        // If the planner specified tool hints, use them to reduce token overhead
        ...(toolHints?.length ? { toolFilter: toolHints } : {})
    });

    if (!record) {
        throw new Error(`Agent "${agentSlug}" not found in database`);
    }

    // Pre-flight: log active skills for observability
    const skillSummary = activeSkills.map((s) => s.skillSlug).join(", ") || "none";
    console.log(
        `[Campaign] Agent "${agentSlug}" resolved with ${record.tools.length} direct tools, ` +
            `${activeSkills.length} active skills (${skillSummary})`
    );

    // Determine if this task involves Firecrawl web scraping
    const skillNames = activeSkills.map((s) => s.skillSlug).join(" ");
    const hasFirecrawlTools =
        skillNames.includes("firecrawl") ||
        (taskContext && taskContext.toLowerCase().includes("firecrawl")) ||
        task.taskVerb.toLowerCase().includes("scrape");

    const firecrawlHint = hasFirecrawlTools
        ? "\n\nIMPORTANT: When using firecrawl_scrape, ALWAYS set onlyMainContent: true to reduce token usage. Prefer firecrawl_extract with a targeted schema over full page scrapes when possible. Limit scraping to the most relevant 3-5 pages, not the entire site."
        : "";

    // Build the prompt for the agent with full context from analyst + planner
    const prompt = `You are executing a task as part of a campaign.

CAMPAIGN: ${mission.campaign.name}
CAMPAIGN INTENT: ${mission.campaign.intent}
MISSION: ${mission.name} — ${mission.missionStatement}
TASK: ${task.name}
ACTION: ${task.taskVerb}
${taskContext ? `\nCONTEXT: ${taskContext}` : ""}
${plannerInstructions ? `\nEXECUTION GUIDANCE: ${plannerInstructions}` : ""}
${plannerReasoning ? `\nAGENT SELECTION REASONING: ${plannerReasoning}` : ""}
${priorResults ? `\nCOMPLETED PRIOR TASKS IN THIS MISSION:\n${priorResults}` : ""}${priorMissionContext ? `\nRESULTS FROM PRIOR MISSIONS:\n${priorMissionContext}` : ""}${firecrawlHint}

Execute this task thoroughly. Use your available tools as needed.
Focus on completing the specific action described above.
Report your results clearly and completely.`;

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
        // Generate response with retry for transient errors
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let response: any;
        let lastRetryError: Error | null = null;

        for (let attempt = 0; attempt <= TASK_MAX_RETRIES; attempt++) {
            try {
                response = await agent.generate(prompt, {
                    maxSteps: record.maxSteps || 10,
                    ...(record.maxTokens ? { maxTokens: record.maxTokens } : { maxTokens: 16384 })
                });
                lastRetryError = null;
                break;
            } catch (retryErr) {
                lastRetryError = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
                if (attempt < TASK_MAX_RETRIES && isRetryableError(lastRetryError)) {
                    const delay = Math.pow(2, attempt) * 1000; // 1s, 2s

                    // If this is a tool-not-found error, clear MCP cache before retry
                    // so the next attempt gets a fresh connection to MCP servers
                    if (isToolNotFoundError(lastRetryError) && record.tenantId) {
                        console.warn(
                            `[Campaign] Tool not found — clearing MCP cache for org ${record.tenantId} before retry`
                        );
                        invalidateMcpCacheForOrg(record.tenantId);
                    }

                    console.warn(
                        `[Campaign] Task "${task.name}" attempt ${attempt + 1} failed (retryable): ${lastRetryError.message}. Retrying in ${delay}ms...`
                    );
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }
                throw lastRetryError;
            }
        }

        if (lastRetryError) throw lastRetryError;

        // Record tool calls for trace visibility
        await recordToolCallsFromResponse(response, runHandle);

        const output = response.text || "";

        // Use the robust token-extraction utility (handles totalUsage, step aggregation, etc.)
        const tokenUsage = extractTokenUsage(response) || {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0
        };
        const promptTokens = tokenUsage.promptTokens;
        const completionTokens = tokenUsage.completionTokens;
        const totalTokens = tokenUsage.totalTokens;
        const costUsd = calculateCost(
            record.modelName,
            record.modelProvider,
            promptTokens,
            completionTokens
        );

        // Complete the run — this emits run/completed which triggers evaluation pipeline
        await runHandle.complete({
            output,
            modelProvider: record.modelProvider,
            modelName: record.modelName,
            promptTokens,
            completionTokens,
            costUsd
        });

        // Check if the agent reported inability to complete the objective
        const outputLower = output.toLowerCase();
        const hasToolNotFound = outputLower.includes("tool") && outputLower.includes("not found");
        const hasExplicitFailure =
            (outputLower.includes("i don't have access") && outputLower.includes("tool")) ||
            (outputLower.includes("i cannot") && outputLower.includes("tool"));

        if (hasToolNotFound || hasExplicitFailure) {
            // Agent ran but could not achieve the objective
            await prisma.missionTask.update({
                where: { id: task.id },
                data: {
                    status: MissionTaskStatus.FAILED,
                    agentRunId: runHandle.runId,
                    error: `Agent completed but objective not met: ${output.substring(0, 200)}`,
                    result: {
                        output,
                        tokens: totalTokens
                    } as Prisma.InputJsonValue,
                    costUsd,
                    tokens: totalTokens,
                    completedAt: new Date()
                }
            });
            await logCampaignEvent(
                campaignId,
                "task_failed",
                `Task "${task.name}" failed: agent could not achieve objective`,
                {
                    missionId: mission.id,
                    taskId: task.id,
                    agentSlug: record.slug,
                    runId: runHandle.runId,
                    costUsd
                }
            );
            // Still count costs against mission and campaign
            await prisma.mission.update({
                where: { id: mission.id },
                data: {
                    totalCostUsd: { increment: costUsd },
                    totalTokens: { increment: totalTokens }
                }
            });
            await prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    totalCostUsd: { increment: costUsd },
                    totalTokens: { increment: totalTokens }
                }
            });
            throw new Error(`Agent completed but objective not met: ${output.substring(0, 200)}`);
        }

        // Update task with results — objective achieved
        await prisma.missionTask.update({
            where: { id: task.id },
            data: {
                status: MissionTaskStatus.COMPLETE,
                agentRunId: runHandle.runId,
                result: {
                    output,
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

        // Track generated resources (documents, Google Docs, agents, skills)
        try {
            const resourceToolKeys = [
                "document-create",
                "google-drive-create-doc",
                "agent-create",
                "skill-create"
            ];
            const resourceCalls = await prisma.agentToolCall.findMany({
                where: {
                    runId: runHandle.runId,
                    toolKey: { in: resourceToolKeys },
                    success: true
                },
                select: { toolKey: true, outputJson: true }
            });

            if (resourceCalls.length > 0) {
                const existingCampaign = await prisma.campaign.findUnique({
                    where: { id: campaignId },
                    select: { generatedResources: true }
                });
                const existing =
                    (existingCampaign?.generatedResources as Record<string, unknown[]>) || {};
                const resources = { ...existing };

                for (const tc of resourceCalls) {
                    const output = tc.outputJson as Record<string, unknown> | null;
                    if (!output) continue;

                    if (tc.toolKey === "document-create") {
                        if (!resources.documents) resources.documents = [];
                        (resources.documents as unknown[]).push({
                            type: "platform-document",
                            id: output.id || output.documentId,
                            name: output.name || output.title,
                            taskName: task.name
                        });
                    } else if (tc.toolKey === "google-drive-create-doc") {
                        if (!resources.documents) resources.documents = [];
                        (resources.documents as unknown[]).push({
                            type: "google-doc",
                            url: output.url || output.webViewLink,
                            name: output.name || output.title,
                            taskName: task.name
                        });
                    } else if (tc.toolKey === "agent-create") {
                        if (!resources.agents) resources.agents = [];
                        (resources.agents as unknown[]).push({
                            id: output.id,
                            slug: output.slug,
                            name: output.name,
                            taskName: task.name
                        });
                    } else if (tc.toolKey === "skill-create") {
                        if (!resources.skills) resources.skills = [];
                        (resources.skills as unknown[]).push({
                            id: output.id,
                            slug: output.slug,
                            name: output.name,
                            taskName: task.name
                        });
                    }
                }

                await prisma.campaign.update({
                    where: { id: campaignId },
                    data: {
                        generatedResources: resources as unknown as Prisma.InputJsonValue
                    }
                });
            }
        } catch (resourceErr) {
            console.warn(
                `[Campaign] Failed to track generated resources for task "${task.name}":`,
                resourceErr
            );
        }

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

        // Step 1: Invoke campaign-reviewer agent for mission AAR
        const result = await step.run("invoke-reviewer", async () => {
            // Load mission data with tasks and results directly (avoids HTTP auth issues in Inngest context)
            const missionData = await prisma.mission.findUniqueOrThrow({
                where: { id: missionId },
                include: {
                    tasks: {
                        include: {
                            agentRun: {
                                select: { id: true, status: true, outputText: true, agentId: true }
                            }
                        }
                    },
                    campaign: { select: { name: true, intent: true, endState: true } }
                }
            });

            const contextPrompt = `Generate an After Action Review for this mission. Use campaign-write-aar with targetType "mission" and targetId "${missionId}".

Campaign: ${missionData.campaign.name}
Campaign Intent: ${missionData.campaign.intent}
Campaign End State: ${missionData.campaign.endState}

Mission: ${missionData.name}
Mission Statement: ${missionData.missionStatement}
Status: ${missionData.status}

Tasks:
${JSON.stringify(
    missionData.tasks.map((t) => ({
        name: t.name,
        taskVerb: t.taskVerb,
        status: t.status,
        agentId: t.agentRun?.agentId || "unassigned",
        output: t.agentRun?.outputText ? String(t.agentRun.outputText).substring(0, 500) : null,
        error: t.error,
        costUsd: t.costUsd,
        tokens: t.tokens
    })),
    null,
    2
)}

Campaign ID: ${campaignId}

Evaluate the mission results against the intent. Write the AAR using campaign-write-aar.`;

            return invokeCampaignAgent({
                agentSlug: "campaign-reviewer",
                prompt: contextPrompt,
                campaignId,
                phase: "mission-aar",
                metadata: { missionId }
            });
        });

        // Step 2: Update campaign progress
        // Count missions that are past execution (REVIEWING, COMPLETE, FAILED) to avoid
        // timing issues where campaign-write-aar hasn't yet transitioned the status.
        await step.run("update-progress", async () => {
            const allMissions = await prisma.mission.findMany({
                where: { campaignId },
                select: { status: true }
            });
            const completedCount = allMissions.filter(
                (m) =>
                    m.status === MissionStatus.REVIEWING ||
                    m.status === MissionStatus.COMPLETE ||
                    m.status === MissionStatus.FAILED
            ).length;
            const progress =
                allMissions.length > 0 ? (completedCount / allMissions.length) * 100 : 0;

            await prisma.campaign.update({
                where: { id: campaignId },
                data: { progress }
            });
        });

        // Step 3: Read mission status to determine if rework was requested
        const missionAfterReview = await step.run("check-review-decision", async () => {
            const m = await prisma.mission.findUnique({
                where: { id: missionId },
                select: { status: true }
            });
            return m;
        });

        const decision =
            missionAfterReview?.status === MissionStatus.REWORK ? "rework" : "complete";

        // Step 4: Signal mission reviewed (for waitForEvent in campaign/execute)
        await step.sendEvent("signal-mission-reviewed", {
            name: "mission/reviewed",
            data: { campaignId, missionId, decision }
        });

        // Record to Activity Feed
        recordActivity({
            type: "MISSION_COMPLETED",
            summary: `Mission "${missionId}" reviewed (${decision})`,
            status: decision === "rework" ? "warning" : "success",
            source: "campaign",
            campaignId,
            metadata: { missionId, decision }
        });

        return { missionId, reviewerRunId: result.runId, decision };
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

        // Step 1: Invoke campaign-reviewer agent for campaign AAR
        const result = await step.run("invoke-reviewer", async () => {
            // Load full campaign data with missions, tasks, and AARs directly (avoids HTTP auth issues in Inngest context)
            const campaignData = await prisma.campaign.findUniqueOrThrow({
                where: { id: campaignId },
                include: {
                    missions: {
                        include: {
                            tasks: {
                                include: {
                                    agentRun: {
                                        select: {
                                            id: true,
                                            status: true,
                                            outputText: true,
                                            agentId: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const contextPrompt = `Generate a comprehensive After Action Review for this campaign. Use campaign-write-aar with targetType "campaign" and targetId "${campaignId}".

Campaign: ${campaignData.name}
Intent: ${campaignData.intent}
End State: ${campaignData.endState}
Status: ${campaignData.status}
Progress: ${campaignData.progress}%
Total Cost: $${campaignData.totalCostUsd.toFixed(4)}
Total Tokens: ${campaignData.totalTokens}

Missions:
${JSON.stringify(
    campaignData.missions.map((m) => ({
        name: m.name,
        missionStatement: m.missionStatement,
        status: m.status,
        costUsd: m.totalCostUsd,
        tokens: m.totalTokens,
        aarJson: m.aarJson,
        tasks: m.tasks.map((t) => ({
            name: t.name,
            taskVerb: t.taskVerb,
            status: t.status,
            agentId: t.agentRun?.agentId || "unassigned",
            output: t.agentRun?.outputText ? String(t.agentRun.outputText).substring(0, 300) : null,
            error: t.error
        }))
    })),
    null,
    2
)}

Evaluate the overall campaign results against the stated intent and end state. Provide a comprehensive AAR with scoring, lessons learned, and recommendations. Use campaign-write-aar to persist.`;

            return invokeCampaignAgent({
                agentSlug: "campaign-reviewer",
                prompt: contextPrompt,
                campaignId,
                phase: "campaign-aar"
            });
        });

        // Step 2: Log completion (campaign-write-aar tool already updates status)
        await step.run("log-completion", async () => {
            const campaign = await prisma.campaign.findUniqueOrThrow({
                where: { id: campaignId },
                select: { name: true, status: true, totalCostUsd: true }
            });

            await logCampaignEvent(
                campaignId,
                "complete",
                `Campaign "${campaign.name}" ${campaign.status}. Cost: $${campaign.totalCostUsd.toFixed(2)}.`
            );

            // Record to Activity Feed
            const isFailed = campaign.status === CampaignStatus.FAILED;
            recordActivity({
                type: isFailed ? "CAMPAIGN_FAILED" : "CAMPAIGN_COMPLETED",
                summary: `Campaign "${campaign.name}" ${campaign.status}. Cost: $${campaign.totalCostUsd.toFixed(2)}.`,
                status: isFailed ? "failure" : "success",
                source: "campaign",
                campaignId,
                costUsd: Number(campaign.totalCostUsd) || undefined
            });
        });

        // Step 4: Notify parent campaign if this is a sub-campaign
        await step.run("notify-parent-campaign", async () => {
            const campaign = await prisma.campaign.findUnique({
                where: { id: campaignId },
                select: { parentCampaignId: true }
            });
            if (campaign?.parentCampaignId) {
                await inngest.send({
                    name: "campaign/sub-complete",
                    data: {
                        parentCampaignId: campaign.parentCampaignId,
                        childCampaignId: campaignId
                    }
                });
                console.log(
                    `[Campaign] Sub-campaign ${campaignId} notified parent ${campaign.parentCampaignId} of completion`
                );
            }
        });

        // Step 5: Ingest campaign results into RAG for cross-campaign memory
        await step.run("ingest-campaign-memory", async () => {
            try {
                const { ingestDocument } = await import("@repo/agentc2");

                const campaignForMemory = await prisma.campaign.findUniqueOrThrow({
                    where: { id: campaignId },
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        templateId: true,
                        runNumber: true,
                        intent: true,
                        endState: true,
                        aarJson: true,
                        totalCostUsd: true,
                        totalTokens: true,
                        status: true,
                        completedAt: true
                    }
                });

                const aar = campaignForMemory.aarJson as Record<string, unknown> | null;
                if (!aar) return;

                const memoryContent = [
                    `# Campaign: ${campaignForMemory.name}`,
                    `**Status**: ${campaignForMemory.status}`,
                    `**Cost**: $${campaignForMemory.totalCostUsd.toFixed(2)}`,
                    `**Tokens**: ${campaignForMemory.totalTokens}`,
                    `**Intent**: ${campaignForMemory.intent}`,
                    "",
                    `## Summary`,
                    String(aar.summary || ""),
                    "",
                    `## Intent Achieved: ${aar.intentAchieved ? "Yes" : "No"}`,
                    "",
                    ...(Array.isArray(aar.lessonsLearned)
                        ? ["## Lessons Learned", ...aar.lessonsLearned.map((l: string) => `- ${l}`)]
                        : []),
                    "",
                    ...(Array.isArray(aar.recommendations)
                        ? [
                              "## Recommendations",
                              ...aar.recommendations.map((r: string) => `- ${r}`)
                          ]
                        : [])
                ].join("\n");

                await ingestDocument(memoryContent, {
                    type: "markdown",
                    sourceId: `campaign-${campaignId}`,
                    sourceName: `Campaign Results: ${campaignForMemory.name}`
                });

                console.log(
                    `[Campaign] Ingested campaign ${campaignId} results into RAG for cross-campaign memory`
                );
            } catch (ragErr) {
                console.warn(`[Campaign] Failed to ingest campaign results into RAG:`, ragErr);
            }
        });

        // Step 6: Bridge mission AARs to per-agent recommendations
        await step.run("bridge-aar-to-agents", async () => {
            try {
                const campaignForBridge = await prisma.campaign.findUnique({
                    where: { id: campaignId },
                    select: {
                        id: true,
                        name: true,
                        missions: {
                            select: {
                                id: true,
                                name: true,
                                aarJson: true,
                                tasks: {
                                    select: {
                                        agentRun: { select: { agentId: true } }
                                    }
                                }
                            }
                        }
                    }
                });
                if (!campaignForBridge) return;

                for (const mission of campaignForBridge.missions) {
                    const missionAar = mission.aarJson as Record<string, unknown> | null;
                    if (!missionAar) continue;

                    // improvePatterns is string[] in campaign AAR tool output
                    const improvePatterns = (missionAar.improvePatterns ?? []) as string[];
                    if (improvePatterns.length === 0) continue;

                    // Collect agents that participated in THIS mission
                    const missionAgentIds = new Set<string>();
                    for (const task of mission.tasks) {
                        if (task.agentRun?.agentId) missionAgentIds.add(task.agentRun.agentId);
                    }

                    for (const agentId of missionAgentIds) {
                        for (const patternText of improvePatterns) {
                            // Dedup: check for existing active recommendation with similar title
                            const existingRec = await prisma.agentRecommendation.findFirst({
                                where: {
                                    agentId,
                                    status: "active",
                                    type: "improve",
                                    title: {
                                        contains: patternText.substring(0, 50)
                                    }
                                }
                            });

                            if (existingRec) {
                                await prisma.agentRecommendation.update({
                                    where: { id: existingRec.id },
                                    data: {
                                        frequency: { increment: 1 },
                                        updatedAt: new Date(),
                                        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                    }
                                });
                            } else {
                                await prisma.agentRecommendation.create({
                                    data: {
                                        agentId,
                                        type: "improve",
                                        category: "quality",
                                        title: `[Campaign: ${campaignForBridge.name}] ${patternText.substring(0, 100)}`,
                                        description: patternText,
                                        evidence: {
                                            source: "campaign_aar",
                                            campaignId: campaignForBridge.id,
                                            missionId: mission.id
                                        } as unknown as Prisma.InputJsonValue,
                                        priority: "medium",
                                        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                    }
                                });
                            }
                        }

                        // Emit learning signal for the agent
                        await inngest.send({
                            name: "learning/signal.detected",
                            data: {
                                agentId,
                                signalType: "CAMPAIGN_AAR",
                                pattern: `Campaign "${campaignForBridge.name}" mission "${mission.name}" identified ${improvePatterns.length} improvement(s)`
                            }
                        });
                    }
                }

                console.log(
                    `[Campaign] Bridged AAR patterns to agent recommendations for campaign ${campaignId}`
                );
            } catch (bridgeErr) {
                console.warn(
                    `[Campaign] Failed to bridge AAR to agent recommendations:`,
                    bridgeErr
                );
            }
        });

        return { campaignId, reviewerRunId: result.runId };
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Export all campaign functions
// ═══════════════════════════════════════════════════════════════════════════════

export const campaignFunctions = [
    campaignAnalyzeFunction,
    campaignPlanFunction,
    campaignBuildCapabilitiesFunction,
    campaignExecuteFunction,
    missionExecuteFunction,
    missionAarFunction,
    campaignAarFunction
];
