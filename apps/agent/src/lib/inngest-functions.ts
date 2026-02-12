import { inngest } from "./inngest";
import { goalStore, goalExecutor } from "@repo/mastra/orchestrator";
import { prisma, Prisma, RunStatus, RunTriggerType, TriggerEventStatus } from "@repo/database";
import { refreshNetworkMetrics, refreshWorkflowMetrics } from "./metrics";
import {
    evaluateHelpfulness,
    getBimObjectBuffer,
    ingestBimElementsForVersion,
    mastra,
    parseIfcBuffer
} from "@repo/mastra";
import crypto from "crypto";
import {
    SIGNAL_THRESHOLDS,
    SCHEDULE_CONFIG,
    TRAFFIC_SPLIT,
    classifyRiskTier,
    getEffectiveConfig,
    shouldEvaluateExperiment,
    canAutoPromote,
    type ProposalChangeAnalysis
} from "./learning-config";
import { alertAutoPromotion, alertExperimentTimeout } from "./alerts";
import { getNextRunAt } from "./schedule-utils";
import { matchesTriggerFilter, resolveTriggerInput } from "./trigger-utils";
import {
    extractTriggerConfig,
    extractTriggerInputMapping,
    resolveRunSource,
    resolveRunTriggerType
} from "./unified-triggers";
import { getGmailClient, watchMailbox, listHistory, getMessagesWithConcurrency } from "./gmail";
import { createApprovalRequest, extractGmailDraftAction } from "./approvals";
import { updateTriggerEventRecord } from "./trigger-events";

/**
 * Execute Goal Function
 *
 * Uses Inngest step functions to break execution into resumable steps.
 * This breaks execution into resumable, fault-tolerant steps.
 *
 * Flow:
 * 1. get-goal: Fetch goal and mark as running
 * 2. plan: Create execution plan
 * 3. execute: Execute the plan
 * 4. score: Evaluate the result
 * 5. complete: Mark goal as complete
 */
export const executeGoalFunction = inngest.createFunction(
    {
        id: "execute-goal",
        retries: 3,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onFailure: async ({ error, event }: { error: Error; event: any }) => {
            // Mark goal as failed on final retry failure
            const goalId = event.data?.goalId;
            console.error(`[Inngest] Goal ${goalId} failed after retries:`, error.message);
            try {
                if (goalId) {
                    const goal = await goalStore.getById(goalId);
                    if (goal) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await goalExecutor.fail(goal as any, error.message);
                    }
                }
            } catch (updateError) {
                console.error(`[Inngest] Failed to update goal status:`, updateError);
            }
        }
    },
    { event: "goal/submitted" },
    async ({ event, step, runId }) => {
        const { goalId } = event.data;

        console.log(`[Inngest] Starting goal execution: ${goalId}`);

        // Step 1: Get the goal and mark as running
        const goal = await step.run("get-goal", async () => {
            const g = await goalStore.getById(goalId);
            if (!g) {
                throw new Error(`Goal not found: ${goalId}`);
            }

            // Update with Inngest run ID for tracking
            await goalStore.updateStatus(goalId, "running", {
                inngestRunId: runId
            });

            return g;
        });

        // Step 2: Plan
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const goalWithDates = goal as any;
        const plan = await step.run("plan", async () => {
            return await goalExecutor.plan(goalWithDates);
        });

        // Step 3: Execute
        const result = await step.run("execute", async () => {
            return await goalExecutor.execute(goalWithDates, plan);
        });

        // Step 4: Score
        const score = await step.run("score", async () => {
            return await goalExecutor.score(goalWithDates, result);
        });

        // Step 5: Complete
        await step.run("complete", async () => {
            await goalExecutor.complete(goalWithDates, result, score);
        });

        console.log(`[Inngest] Goal execution complete: ${goalId}`, { score });

        return {
            goalId,
            status: "completed",
            score
        };
    }
);

/**
 * Retry Goal Function
 *
 * Manually triggered to retry a failed goal.
 */
export const retryGoalFunction = inngest.createFunction(
    {
        id: "retry-goal",
        retries: 2
    },
    { event: "goal/retry" },
    async ({ event, step, runId }) => {
        const { goalId } = event.data;

        console.log(`[Inngest] Retrying goal: ${goalId}, attempt: ${event.data.attempt}`);

        // Reset goal status and re-execute
        const goal = await step.run("reset-goal", async () => {
            const g = await goalStore.getById(goalId);
            if (!g) {
                throw new Error(`Goal not found: ${goalId}`);
            }

            await goalStore.updateStatus(goalId, "queued", {
                progress: 0,
                currentStep: "Queued for retry",
                inngestRunId: runId
            });

            return g;
        });

        // Trigger the main execution function
        await step.sendEvent("trigger-execute", {
            name: "goal/submitted",
            data: {
                goalId: goal.id,
                userId: goal.userId
            }
        });

        return { goalId, status: "retry-triggered" };
    }
);

/**
 * Run Completed Handler
 *
 * Triggered when an agent run completes. Handles:
 * - Cost event creation
 * - Evaluation triggering
 * - Stats rollup
 */
export const runCompletedFunction = inngest.createFunction(
    {
        id: "run-completed",
        retries: 2
    },
    { event: "run/completed" },
    async ({ event, step }) => {
        const { runId, agentId, costUsd } = event.data;

        console.log(`[Inngest] Processing run completion: ${runId}`);

        // Step 1: Create cost event if there's cost data
        if (costUsd && costUsd > 0) {
            await step.run("create-cost-event", async () => {
                const run = await prisma.agentRun.findUnique({
                    where: { id: runId },
                    select: {
                        modelProvider: true,
                        modelName: true,
                        promptTokens: true,
                        completionTokens: true,
                        totalTokens: true,
                        costUsd: true
                    }
                });

                if (run) {
                    // Check if cost event already exists for this run
                    // (CostEvent.runId is no longer @unique -- conversation runs have per-turn cost events)
                    const existingCount = await prisma.costEvent.count({
                        where: { runId }
                    });

                    // For legacy runs (turnCount=0) or runs without any cost events, create one
                    if (existingCount === 0) {
                        await prisma.costEvent.create({
                            data: {
                                runId,
                                agentId,
                                provider: run.modelProvider || "unknown",
                                modelName: run.modelName || "unknown",
                                promptTokens: run.promptTokens,
                                completionTokens: run.completionTokens,
                                totalTokens: run.totalTokens,
                                costUsd: run.costUsd
                            }
                        });
                    }
                }
            });
        }

        // Step 2: Trigger evaluation (sampling: 100% for now, configurable later)
        await step.sendEvent("trigger-evaluation", {
            name: "run/evaluate",
            data: { runId, agentId }
        });

        // Step 3: Check budget thresholds
        await step.run("check-budget", async () => {
            const budgetPolicy = await prisma.budgetPolicy.findUnique({
                where: { agentId }
            });

            if (budgetPolicy?.enabled && budgetPolicy.monthlyLimitUsd) {
                // Get current month's cost
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const monthlyTotal = await prisma.costEvent.aggregate({
                    where: {
                        agentId,
                        createdAt: { gte: startOfMonth }
                    },
                    _sum: { costUsd: true }
                });

                const currentUsage = monthlyTotal._sum.costUsd || 0;
                const percentUsed = (currentUsage / budgetPolicy.monthlyLimitUsd) * 100;

                if (percentUsed >= (budgetPolicy.alertAtPct || 80)) {
                    // Create alert
                    await prisma.agentAlert.create({
                        data: {
                            agentId,
                            severity: percentUsed >= 100 ? "CRITICAL" : "WARNING",
                            message: `Budget usage at ${Math.round(percentUsed)}% ($${currentUsage.toFixed(4)} of $${budgetPolicy.monthlyLimitUsd})`,
                            source: "COST"
                        }
                    });
                }
            }
        });

        // Step 4: Create approval requests for Tier 1 triggers
        await step.run("create-approval-request", async () => {
            const run = await prisma.agentRun.findUnique({
                where: { id: runId },
                include: {
                    agent: {
                        select: {
                            requiresApproval: true,
                            workspaceId: true,
                            workspace: { select: { organizationId: true } }
                        }
                    },
                    TriggerEvent: true
                }
            });

            if (!run?.agent?.requiresApproval || !run.TriggerEvent) {
                return null;
            }

            const integrationKey = run.TriggerEvent.integrationKey;
            if (
                !integrationKey ||
                !["gmail", "hubspot", "slack", "fathom"].includes(integrationKey)
            ) {
                return null;
            }

            const existing = await prisma.approvalRequest.findFirst({
                where: { triggerEventId: run.TriggerEvent.id }
            });
            if (existing) {
                return existing;
            }

            const payload =
                run.TriggerEvent.payloadJson && typeof run.TriggerEvent.payloadJson === "object"
                    ? (run.TriggerEvent.payloadJson as Record<string, unknown>)
                    : null;

            const slackUserId =
                typeof payload?._slackUserId === "string"
                    ? (payload._slackUserId as string)
                    : typeof payload?.slackUserId === "string"
                      ? (payload.slackUserId as string)
                      : null;
            const gmailAddress =
                integrationKey === "gmail" && typeof payload?.gmailAddress === "string"
                    ? (payload.gmailAddress as string)
                    : null;
            const threadId =
                integrationKey === "gmail" ? (payload?.threadId as string | null) : null;

            const organizationId = run.agent.workspace?.organizationId;
            if (!organizationId) {
                return null;
            }

            const action =
                integrationKey === "gmail" && gmailAddress
                    ? extractGmailDraftAction({
                          outputText: run.outputText,
                          gmailAddress,
                          threadId
                      })
                    : null;

            const summary =
                integrationKey === "gmail" && action
                    ? "Gmail draft ready for approval"
                    : "Run output requires approval";

            return createApprovalRequest({
                organizationId,
                workspaceId: run.agent.workspaceId,
                agentId: run.agentId,
                triggerEventId: run.TriggerEvent.id,
                sourceType: "integration",
                sourceId: run.TriggerEvent.integrationId,
                integrationConnectionId:
                    typeof payload?.integrationConnectionId === "string"
                        ? (payload.integrationConnectionId as string)
                        : null,
                slackUserId,
                title: `${integrationKey.toUpperCase()} approval`,
                summary,
                payload: {
                    integrationKey,
                    inputText: run.inputText,
                    outputText: run.outputText,
                    triggerEventId: run.TriggerEvent.id,
                    triggerPayload: payload
                },
                action: action ?? { type: "none" }
            });
        });

        return { runId, processed: true };
    }
);

/**
 * Evaluation Completed Handler
 *
 * Triggered when an evaluation job completes. Updates theme extraction and aggregates.
 */
export const evaluationCompletedFunction = inngest.createFunction(
    {
        id: "evaluation-completed",
        retries: 2
    },
    { event: "evaluation/completed" },
    async ({ event, step }) => {
        const { evaluationId, agentId } = event.data;

        console.log(`[Inngest] Processing evaluation completion: ${evaluationId}`);

        // Step 1: Update quality metrics if needed
        await step.run("update-metrics", async () => {
            // This would typically trigger a cache invalidation
            // For now, metrics are computed on-demand
            console.log(`[Inngest] Metrics updated for agent: ${agentId}`);
        });

        return { evaluationId, processed: true };
    }
);

/**
 * Guardrail Event Handler
 *
 * Triggered when a guardrail blocks/modifies content. Creates alerts and events.
 */
export const guardrailEventFunction = inngest.createFunction(
    {
        id: "guardrail-event",
        retries: 2
    },
    { event: "guardrail/event" },
    async ({ event, step }) => {
        const { agentId, runId, type, guardrailKey, reason } = event.data;

        console.log(`[Inngest] Processing guardrail event: ${type} for agent ${agentId}`);

        // Step 1: Create guardrail event record
        await step.run("create-event", async () => {
            await prisma.guardrailEvent.create({
                data: {
                    agentId,
                    runId,
                    type,
                    guardrailKey,
                    reason
                }
            });
        });

        // Step 2: Create alert for blocked content
        if (type === "BLOCKED") {
            await step.run("create-alert", async () => {
                await prisma.agentAlert.create({
                    data: {
                        agentId,
                        severity: "WARNING",
                        message: `Content blocked by guardrail: ${guardrailKey}`,
                        source: "GUARDRAIL"
                    }
                });
            });
        }

        return { agentId, type, processed: true };
    }
);

/**
 * Budget Check Handler
 *
 * Scheduled job to check budget thresholds for all agents.
 */
export const budgetCheckFunction = inngest.createFunction(
    {
        id: "budget-check",
        retries: 1
    },
    { event: "budget/check" },
    async ({ event, step }) => {
        const { agentId } = event.data;

        console.log(`[Inngest] Checking budget for agent: ${agentId}`);

        await step.run("check-agent-budget", async () => {
            const budgetPolicy = await prisma.budgetPolicy.findUnique({
                where: { agentId }
            });

            if (!budgetPolicy?.enabled || !budgetPolicy.monthlyLimitUsd) {
                return { skipped: true };
            }

            // Get current month's cost
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const monthlyTotal = await prisma.costEvent.aggregate({
                where: {
                    agentId,
                    createdAt: { gte: startOfMonth }
                },
                _sum: { costUsd: true }
            });

            const currentUsage = monthlyTotal._sum.costUsd || 0;
            const percentUsed = (currentUsage / budgetPolicy.monthlyLimitUsd) * 100;

            if (percentUsed >= (budgetPolicy.alertAtPct || 80)) {
                await prisma.agentAlert.create({
                    data: {
                        agentId,
                        severity: percentUsed >= 100 ? "CRITICAL" : "WARNING",
                        message: `Budget threshold reached: ${Math.round(percentUsed)}%`,
                        source: "COST"
                    }
                });

                return { alerted: true, percentUsed };
            }

            return { checked: true, percentUsed };
        });

        return { agentId, processed: true };
    }
);

// ==============================
// Closed-Loop Learning Functions
// ==============================

/**
 * Run Evaluation Function
 *
 * Auto-runs evaluations on completed runs based on agent's scorer configuration.
 * Triggered by run/completed event with sampling.
 */
export const runEvaluationFunction = inngest.createFunction(
    {
        id: "run-evaluation",
        retries: 2
    },
    { event: "run/evaluate" },
    async ({ event, step }) => {
        const { runId, agentId } = event.data;

        console.log(`[Inngest] Running evaluation for run: ${runId}`);

        // Step 1: Get the run and agent configuration
        const runData = await step.run("get-run-data", async () => {
            const run = await prisma.agentRun.findUnique({
                where: { id: runId },
                include: {
                    agent: {
                        select: {
                            scorers: true,
                            id: true,
                            slug: true
                        }
                    }
                }
            });

            if (!run || !run.inputText || !run.outputText) {
                return null;
            }

            return run;
        });

        if (!runData) {
            console.log(`[Inngest] Run ${runId} not found or incomplete, skipping evaluation`);
            return { runId, skipped: true };
        }

        // Step 2: Check if evaluation already exists
        const existing = await step.run("check-existing", async () => {
            return prisma.agentEvaluation.findUnique({
                where: { runId }
            });
        });

        if (existing) {
            console.log(`[Inngest] Evaluation already exists for run: ${runId}`);
            return { runId, skipped: true, existing: true };
        }

        // Step 3: Run evaluations
        // For conversation runs (turnCount > 0), build full conversation context
        const scores = await step.run("run-scorers", async () => {
            const scoreResults: Record<string, number> = {};
            let input = runData.inputText;
            let output = runData.outputText || "";

            // Conversation runs: use full conversation context for better evaluation
            if (runData.turnCount > 0) {
                const turns = await prisma.agentRunTurn.findMany({
                    where: { runId },
                    orderBy: { turnIndex: "asc" },
                    select: { inputText: true, outputText: true, turnIndex: true }
                });
                if (turns.length > 0) {
                    // Build conversation context string
                    const conversationParts = turns.map(
                        (t) => `User: ${t.inputText}\nAssistant: ${t.outputText || "(no response)"}`
                    );
                    input = conversationParts.join("\n\n");
                    output = turns[turns.length - 1]?.outputText || output;
                }
            }

            // Always run helpfulness (fast, heuristic-based)
            const helpfulness = evaluateHelpfulness(input, output);
            scoreResults.helpfulness = helpfulness.score;

            // Calculate simple relevancy heuristic
            const inputWords = input.toLowerCase().split(/\s+/);
            const outputWords = output.toLowerCase().split(/\s+/);
            const overlap = inputWords.filter((w) => outputWords.includes(w) && w.length > 3);
            scoreResults.relevancy = Math.min(overlap.length / Math.max(inputWords.length, 1), 1);

            // Completeness heuristic
            scoreResults.completeness = Math.min(output.length / 500, 1);

            // Toxicity heuristic (simple check for known bad patterns)
            const toxicPatterns = ["stupid", "idiot", "hate", "kill", "die"];
            const hasToxic = toxicPatterns.some((p) => output.toLowerCase().includes(p));
            scoreResults.toxicity = hasToxic ? 0.5 : 0;

            return scoreResults;
        });

        // Step 4: Store evaluation
        const evaluation = await step.run("store-evaluation", async () => {
            return prisma.agentEvaluation.create({
                data: {
                    runId,
                    agentId,
                    scoresJson: scores,
                    scorerVersion: "1.0.0"
                }
            });
        });

        // Step 5: Emit evaluation/completed event for downstream processing (insights, metrics)
        await step.sendEvent("emit-evaluation-completed", {
            name: "evaluation/completed",
            data: {
                evaluationId: evaluation.id,
                agentId,
                runId,
                scores
            }
        });

        // Step 6: Check for low scores and emit signal event
        await step.run("check-signals", async () => {
            const avgScore =
                Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;

            if (avgScore < 0.5) {
                // Emit signal for learning pipeline
                await inngest.send({
                    name: "learning/signal.detected",
                    data: {
                        agentId,
                        runId,
                        signalType: "LOW_SCORE",
                        severity: avgScore < 0.3 ? "high" : "medium",
                        scores
                    }
                });
            }
        });

        console.log(`[Inngest] Evaluation complete for run: ${runId}`, scores);

        return { runId, evaluationId: evaluation.id, scores };
    }
);

/**
 * Learning Signal Detector
 *
 * Aggregates signals and triggers learning sessions when thresholds are met.
 * Uses centralized config for threshold values that can be overridden per-agent.
 */
export const learningSignalDetectorFunction = inngest.createFunction(
    {
        id: "learning-signal-detector",
        retries: 2
    },
    { event: "learning/signal.detected" },
    async ({ event, step }) => {
        const { agentId, signalType } = event.data;

        console.log(`[Inngest] Signal detected for agent ${agentId}: ${signalType}`);

        // Step 1: Get agent's learning policy for config overrides
        const policy = await step.run("get-policy", async () => {
            const learningPolicy = await prisma.learningPolicy.findUnique({
                where: { agentId }
            });
            return learningPolicy;
        });

        // Check if threshold triggers are enabled for this agent
        const config = getEffectiveConfig(policy || {});
        if (!config.thresholdEnabled) {
            console.log(`[Inngest] Threshold triggers disabled for agent ${agentId}`);
            return { agentId, signalType, skipped: true, reason: "Threshold triggers disabled" };
        }

        // Check if learning is paused
        if (policy?.paused) {
            const pausedUntil = policy.pausedUntil ? new Date(policy.pausedUntil) : null;
            if (!pausedUntil || new Date() < pausedUntil) {
                console.log(`[Inngest] Learning paused for agent ${agentId}`);
                return { agentId, signalType, skipped: true, reason: "Learning paused" };
            }
        }

        // Step 2: Count recent signals within configured time window
        const signalCount = await step.run("count-signals", async () => {
            const windowMs = config.signalWindowMinutes * 60 * 1000;
            const windowStart = new Date(Date.now() - windowMs);

            // Count signals from ALL sessions (not just current) for this agent
            const count = await prisma.learningSignal.count({
                where: {
                    session: {
                        agentId
                    },
                    createdAt: { gte: windowStart }
                }
            });

            return count;
        });

        // Step 3: Check if we should trigger a learning session
        if (signalCount >= config.signalThreshold) {
            // Check if there's already an active learning session
            const activeSession = await step.run("check-active-session", async () => {
                return prisma.learningSession.findFirst({
                    where: {
                        agentId,
                        status: {
                            in: [
                                "COLLECTING",
                                "ANALYZING",
                                "PROPOSING",
                                "TESTING",
                                "AWAITING_APPROVAL"
                            ]
                        }
                    }
                });
            });

            if (!activeSession) {
                // Trigger new learning session
                await step.sendEvent("trigger-learning", {
                    name: "learning/session.start",
                    data: {
                        agentId,
                        triggerReason: `${signalCount} signals detected in the last ${config.signalWindowMinutes} minutes (threshold: ${config.signalThreshold})`,
                        triggerType: "threshold"
                    }
                });

                console.log(`[Inngest] Triggered learning session for ${agentId} via threshold`);
            } else {
                console.log(`[Inngest] Active session exists for ${agentId}, skipping trigger`);
            }
        }

        return { agentId, signalType, signalCount, threshold: config.signalThreshold };
    }
);

/**
 * Scheduled Learning Trigger
 *
 * Cron-triggered function that checks all agents and starts learning sessions
 * as a backstop to ensure continuous learning even without signal thresholds.
 *
 * Schedule: Every 6 hours (configurable via SCHEDULE_CONFIG)
 */
export const scheduledLearningTriggerFunction = inngest.createFunction(
    {
        id: "scheduled-learning-trigger",
        retries: 1
    },
    { cron: SCHEDULE_CONFIG.cronExpression },
    async ({ step }) => {
        console.log(`[Inngest] Running scheduled learning trigger`);

        // Step 1: Get all agents with learning enabled
        const agents = await step.run("get-eligible-agents", async () => {
            // Get all agents with their policies
            const allAgents = await prisma.agent.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    slug: true,
                    tenantId: true,
                    learningPolicy: true
                }
            });

            // Filter to agents with scheduled triggers enabled
            const eligibleAgents = allAgents.filter((agent) => {
                const policy = agent.learningPolicy;

                // Default to enabled if no policy exists
                if (!policy) return true;

                // Skip if learning is disabled
                if (policy.enabled === false) return false;

                // Skip if scheduled triggers are disabled
                if (policy.scheduledEnabled === false) return false;

                // Skip if learning is paused
                if (policy.paused) {
                    const pausedUntil = policy.pausedUntil;
                    if (!pausedUntil || new Date() < pausedUntil) return false;
                }

                return true;
            });

            return eligibleAgents;
        });

        console.log(`[Inngest] Found ${agents.length} agents eligible for scheduled learning`);

        // Step 2: Check each agent for active sessions and recent activity
        const triggeredAgents: string[] = [];

        for (const agent of agents) {
            const shouldTrigger = await step.run(`check-agent-${agent.slug}`, async () => {
                // Check for active session
                const activeSession = await prisma.learningSession.findFirst({
                    where: {
                        agentId: agent.id,
                        status: {
                            in: [
                                "COLLECTING",
                                "ANALYZING",
                                "PROPOSING",
                                "TESTING",
                                "AWAITING_APPROVAL"
                            ]
                        }
                    }
                });

                if (activeSession) {
                    console.log(`[Inngest] Agent ${agent.slug} has active session, skipping`);
                    return false;
                }

                // Check for recent session (within minHoursBetweenSessions)
                const recentCutoff = new Date(
                    Date.now() - SCHEDULE_CONFIG.minHoursBetweenSessions * 60 * 60 * 1000
                );

                const recentSession = await prisma.learningSession.findFirst({
                    where: {
                        agentId: agent.id,
                        createdAt: { gte: recentCutoff }
                    }
                });

                if (recentSession) {
                    console.log(`[Inngest] Agent ${agent.slug} had recent session, skipping`);
                    return false;
                }

                // Check if there are enough runs to analyze
                const sevenDaysAgo = new Date(
                    Date.now() - SIGNAL_THRESHOLDS.datasetLookbackDays * 24 * 60 * 60 * 1000
                );

                const runCount = await prisma.agentRun.count({
                    where: {
                        agentId: agent.id,
                        status: "COMPLETED",
                        createdAt: { gte: sevenDaysAgo }
                    }
                });

                if (runCount < SIGNAL_THRESHOLDS.minRunsForSession) {
                    console.log(
                        `[Inngest] Agent ${agent.slug} has only ${runCount} runs, need ${SIGNAL_THRESHOLDS.minRunsForSession}`
                    );
                    return false;
                }

                return true;
            });

            if (shouldTrigger) {
                // Check concurrent session limit
                if (triggeredAgents.length >= SCHEDULE_CONFIG.maxConcurrentSessions) {
                    console.log(
                        `[Inngest] Max concurrent sessions reached, skipping ${agent.slug}`
                    );
                    continue;
                }

                await step.sendEvent(`trigger-${agent.slug}`, {
                    name: "learning/session.start",
                    data: {
                        agentId: agent.id,
                        triggerReason: "Scheduled backstop trigger",
                        triggerType: "scheduled"
                    }
                });

                triggeredAgents.push(agent.slug);
                console.log(`[Inngest] Triggered scheduled learning for ${agent.slug}`);
            }
        }

        console.log(
            `[Inngest] Scheduled learning trigger complete: ${triggeredAgents.length} sessions started`
        );

        return {
            agentsChecked: agents.length,
            sessionsTriggered: triggeredAgents.length,
            triggeredAgents
        };
    }
);

/**
 * Learning Session Start
 *
 * Initiates a new learning session for an agent.
 * Tracks trigger type (threshold, scheduled, manual) for analytics.
 */
export const learningSessionStartFunction = inngest.createFunction(
    {
        id: "learning-session-start",
        retries: 2
    },
    { event: "learning/session.start" },
    async ({ event, step }) => {
        const { agentId, triggerReason, triggerType = "manual", sessionId } = event.data;

        console.log(
            `[Inngest] Starting learning session for agent: ${agentId} (trigger: ${triggerType})${sessionId ? ` [existing session: ${sessionId}]` : ""}`
        );

        // Step 1: Get agent and baseline version
        const agent = await step.run("get-agent", async () => {
            return prisma.agent.findUnique({
                where: { id: agentId },
                select: {
                    id: true,
                    slug: true,
                    version: true,
                    scorers: true,
                    tenantId: true
                }
            });
        });

        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }

        // Step 2: Get existing session or create new one
        const session = await step.run("get-or-create-session", async () => {
            // If sessionId is provided, use the existing session (created by API)
            if (sessionId) {
                const existingSession = await prisma.learningSession.findUnique({
                    where: { id: sessionId }
                });
                if (existingSession) {
                    return existingSession;
                }
                // Fall through to create if not found (shouldn't happen)
            }

            // Create new session
            return prisma.learningSession.create({
                data: {
                    agentId,
                    tenantId: agent.tenantId,
                    status: "COLLECTING",
                    baselineVersion: agent.version,
                    scorerConfig: { scorers: agent.scorers },
                    metadata: { triggerReason, triggerType }
                }
            });
        });

        // Step 3: Collect recent runs for analysis
        const dataset = await step.run("collect-runs", async () => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const runs = await prisma.agentRun.findMany({
                where: {
                    agentId,
                    status: "COMPLETED",
                    createdAt: { gte: sevenDaysAgo }
                },
                select: { id: true },
                orderBy: { createdAt: "desc" },
                take: 100 // Limit to last 100 runs
            });

            const runIds = runs.map((r) => r.id);
            const datasetHash = crypto
                .createHash("sha256")
                .update(runIds.sort().join(","))
                .digest("hex");

            // Get average score
            const evals = await prisma.agentEvaluation.findMany({
                where: { runId: { in: runIds } },
                select: { scoresJson: true }
            });

            let avgScore = 0;
            if (evals.length > 0) {
                const allScores = evals.map((e) => {
                    const scores = e.scoresJson as Record<string, number>;
                    return (
                        Object.values(scores).reduce((a, b) => a + b, 0) /
                        Object.keys(scores).length
                    );
                });
                avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
            }

            const dataset = await prisma.learningDataset.create({
                data: {
                    sessionId: session.id,
                    tenantId: agent.tenantId,
                    runIds,
                    selectionCriteria: {
                        from: sevenDaysAgo.toISOString(),
                        to: new Date().toISOString(),
                        limit: 100
                    },
                    datasetHash,
                    fromDate: sevenDaysAgo,
                    toDate: new Date(),
                    runCount: runIds.length,
                    avgScore
                }
            });

            // Update session with dataset hash
            await prisma.learningSession.update({
                where: { id: session.id },
                data: {
                    datasetHash,
                    runCount: runIds.length,
                    status: "ANALYZING"
                }
            });

            return dataset;
        });

        // Step 4: Trigger signal extraction
        await step.sendEvent("extract-signals", {
            name: "learning/signals.extract",
            data: {
                sessionId: session.id,
                agentId,
                datasetId: dataset.id
            }
        });

        // Log audit event
        await step.run("audit-log", async () => {
            await prisma.auditLog.create({
                data: {
                    tenantId: agent.tenantId,
                    actorId: "system",
                    action: "LEARNING_SESSION_CREATED",
                    entityType: "LearningSession",
                    entityId: session.id,
                    metadata: { triggerReason, runCount: dataset.runCount }
                }
            });
        });

        console.log(`[Inngest] Learning session created: ${session.id}`);

        return { sessionId: session.id, datasetId: dataset.id };
    }
);

/**
 * Learning Signal Extraction
 *
 * Analyzes runs to extract learning signals (patterns, failures, etc.)
 */
export const learningSignalExtractionFunction = inngest.createFunction(
    {
        id: "learning-signal-extraction",
        retries: 2
    },
    { event: "learning/signals.extract" },
    async ({ event, step }) => {
        const { sessionId, agentId, datasetId } = event.data;

        console.log(`[Inngest] Extracting signals for session: ${sessionId}`);

        // Step 1: Get dataset and runs
        const dataset = await step.run("get-dataset", async () => {
            return prisma.learningDataset.findUnique({
                where: { id: datasetId }
            });
        });

        if (!dataset) {
            throw new Error(`Dataset not found: ${datasetId}`);
        }

        // Step 2: Analyze evaluations for low scores
        const lowScoreSignals = await step.run("analyze-low-scores", async () => {
            const evals = await prisma.agentEvaluation.findMany({
                where: {
                    runId: { in: dataset.runIds },
                    agentId
                },
                include: {
                    run: {
                        select: { id: true, inputText: true, outputText: true }
                    }
                }
            });

            const signals: Array<{
                type: "LOW_SCORE";
                severity: string;
                pattern: string;
                evidence: { runId: string; scores: Record<string, number> }[];
            }> = [];

            const lowScoreRuns = evals.filter((e) => {
                const scores = e.scoresJson as Record<string, number>;
                const avg =
                    Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
                return avg < 0.5;
            });

            if (lowScoreRuns.length > 0) {
                signals.push({
                    type: "LOW_SCORE",
                    severity: lowScoreRuns.length > 10 ? "high" : "medium",
                    pattern: `${lowScoreRuns.length} runs scored below 0.5 average`,
                    evidence: lowScoreRuns.map((e) => ({
                        runId: e.runId,
                        scores: e.scoresJson as Record<string, number>
                    }))
                });
            }

            return signals;
        });

        // Step 3: Analyze tool failures
        const toolFailureSignals = await step.run("analyze-tool-failures", async () => {
            const toolCalls = await prisma.agentToolCall.findMany({
                where: {
                    runId: { in: dataset.runIds },
                    success: false
                },
                select: {
                    runId: true,
                    toolKey: true,
                    error: true
                }
            });

            const signals: Array<{
                type: "TOOL_FAILURE";
                severity: string;
                pattern: string;
                evidence: { toolKey: string; count: number; errors: string[] }[];
            }> = [];

            if (toolCalls.length > 0) {
                // Group by tool
                const byTool: Record<string, { count: number; errors: string[] }> = {};
                for (const call of toolCalls) {
                    if (!byTool[call.toolKey]) {
                        byTool[call.toolKey] = { count: 0, errors: [] };
                    }
                    byTool[call.toolKey].count++;
                    if (call.error) {
                        byTool[call.toolKey].errors.push(call.error);
                    }
                }

                signals.push({
                    type: "TOOL_FAILURE",
                    severity: toolCalls.length > 5 ? "high" : "medium",
                    pattern: `${toolCalls.length} tool failures across ${Object.keys(byTool).length} tools`,
                    evidence: Object.entries(byTool).map(([toolKey, data]) => ({
                        toolKey,
                        count: data.count,
                        errors: data.errors.slice(0, 3) // Limit errors
                    }))
                });
            }

            return signals;
        });

        // Step 4: Analyze negative feedback
        const feedbackSignals = await step.run("analyze-feedback", async () => {
            const negativeFeedback = await prisma.agentFeedback.findMany({
                where: {
                    runId: { in: dataset.runIds },
                    OR: [{ thumbs: false }, { rating: { lt: 3 } }]
                },
                select: {
                    runId: true,
                    comment: true,
                    rating: true
                }
            });

            const signals: Array<{
                type: "NEGATIVE_FEEDBACK";
                severity: string;
                pattern: string;
                evidence: { count: number; comments: string[] }[];
            }> = [];

            if (negativeFeedback.length > 0) {
                signals.push({
                    type: "NEGATIVE_FEEDBACK",
                    severity: negativeFeedback.length > 10 ? "high" : "medium",
                    pattern: `${negativeFeedback.length} negative feedback entries`,
                    evidence: [
                        {
                            count: negativeFeedback.length,
                            comments: negativeFeedback
                                .filter((f) => f.comment)
                                .map((f) => f.comment!)
                                .slice(0, 5)
                        }
                    ]
                });
            }

            return signals;
        });

        // Step 5: Analyze skill correlation with poor performance
        const skillCorrelationSignals = await step.run("analyze-skill-correlation", async () => {
            // Get runs with their skills and evaluations
            const runs = await prisma.agentRun.findMany({
                where: {
                    id: { in: dataset.runIds },
                    NOT: { skillsJson: { equals: Prisma.JsonNull } }
                },
                include: {
                    evaluation: {
                        select: { scoresJson: true }
                    }
                }
            });

            // Also get runs without skills for comparison baseline
            const runsWithoutSkills = await prisma.agentRun.findMany({
                where: {
                    id: { in: dataset.runIds },
                    skillsJson: { equals: Prisma.JsonNull }
                },
                include: {
                    evaluation: {
                        select: { scoresJson: true }
                    }
                }
            });

            const signals: Array<{
                type: "SKILL_CORRELATION";
                severity: string;
                pattern: string;
                evidence: {
                    skillSlug: string;
                    avgScoreWithSkill: number;
                    avgScoreWithout: number;
                    runCount: number;
                }[];
            }> = [];

            // Calculate baseline average (runs without skills)
            let baselineAvg = 0;
            let baselineCount = 0;
            for (const r of runsWithoutSkills) {
                if (r.evaluation?.scoresJson) {
                    const scores = r.evaluation.scoresJson as Record<string, number>;
                    const avg =
                        Object.values(scores).reduce((a, b) => a + b, 0) /
                        Math.max(Object.keys(scores).length, 1);
                    baselineAvg += avg;
                    baselineCount++;
                }
            }
            baselineAvg = baselineCount > 0 ? baselineAvg / baselineCount : 0.5;

            // Group runs by skill slug and calculate avg score per skill
            const skillScores: Record<
                string,
                { totalScore: number; count: number; runCount: number }
            > = {};

            for (const r of runs) {
                const skills = r.skillsJson as Array<{
                    skillSlug: string;
                }>;
                if (!Array.isArray(skills) || !r.evaluation?.scoresJson) continue;

                const scores = r.evaluation.scoresJson as Record<string, number>;
                const avg =
                    Object.values(scores).reduce((a, b) => a + b, 0) /
                    Math.max(Object.keys(scores).length, 1);

                for (const s of skills) {
                    if (!skillScores[s.skillSlug]) {
                        skillScores[s.skillSlug] = { totalScore: 0, count: 0, runCount: 0 };
                    }
                    skillScores[s.skillSlug].totalScore += avg;
                    skillScores[s.skillSlug].count++;
                    skillScores[s.skillSlug].runCount++;
                }
            }

            // Detect skills that correlate with >20% score decrease
            const evidence: {
                skillSlug: string;
                avgScoreWithSkill: number;
                avgScoreWithout: number;
                runCount: number;
            }[] = [];

            for (const [slug, data] of Object.entries(skillScores)) {
                if (data.count < 3) continue; // Need minimum sample size
                const avgWithSkill = data.totalScore / data.count;
                if (baselineAvg > 0 && avgWithSkill < baselineAvg * 0.8) {
                    evidence.push({
                        skillSlug: slug,
                        avgScoreWithSkill: Math.round(avgWithSkill * 100) / 100,
                        avgScoreWithout: Math.round(baselineAvg * 100) / 100,
                        runCount: data.runCount
                    });
                }
            }

            if (evidence.length > 0) {
                signals.push({
                    type: "SKILL_CORRELATION",
                    severity: evidence.length > 1 ? "high" : "medium",
                    pattern: `${evidence.length} skill(s) correlated with decreased scores: ${evidence.map((e) => e.skillSlug).join(", ")}`,
                    evidence
                });
            }

            return signals;
        });

        // Step 6: Store all signals
        const allSignals = [
            ...lowScoreSignals,
            ...toolFailureSignals,
            ...feedbackSignals,
            ...skillCorrelationSignals
        ];

        await step.run("store-signals", async () => {
            for (const signal of allSignals) {
                await prisma.learningSignal.create({
                    data: {
                        sessionId,
                        tenantId: dataset.tenantId,
                        type: signal.type as
                            | "LOW_SCORE"
                            | "TOOL_FAILURE"
                            | "NEGATIVE_FEEDBACK"
                            | "SKILL_CORRELATION",
                        severity: signal.severity,
                        pattern: signal.pattern,
                        evidenceJson: signal.evidence,
                        frequency: signal.evidence.length,
                        impact: signal.severity === "high" ? 0.8 : 0.5
                    }
                });
            }

            // Update session status
            await prisma.learningSession.update({
                where: { id: sessionId },
                data: { status: "PROPOSING" }
            });
        });

        // Step 7: Trigger proposal generation
        await step.sendEvent("generate-proposals", {
            name: "learning/proposals.generate",
            data: {
                sessionId,
                agentId,
                signalCount: allSignals.length
            }
        });

        console.log(`[Inngest] Extracted ${allSignals.length} signals for session: ${sessionId}`);

        return { sessionId, signalCount: allSignals.length };
    }
);

/**
 * Learning Proposal Generation
 *
 * Generates improvement proposals based on extracted signals.
 * Uses heuristics and patterns to suggest instruction/tool/memory changes.
 */
export const learningProposalGenerationFunction = inngest.createFunction(
    {
        id: "learning-proposal-generation",
        retries: 2
    },
    { event: "learning/proposals.generate" },
    async ({ event, step }) => {
        const { sessionId, agentId, signalCount } = event.data;

        console.log(`[Inngest] Generating proposals for session: ${sessionId}`);

        if (signalCount === 0) {
            // No signals, skip proposal generation
            await step.run("no-signals", async () => {
                await prisma.learningSession.update({
                    where: { id: sessionId },
                    data: { status: "FAILED", metadata: { error: "No signals found" } }
                });
            });
            return { sessionId, proposals: 0, skipped: true };
        }

        // Step 1: Get session and signals
        const sessionData = await step.run("get-session-data", async () => {
            const session = await prisma.learningSession.findUnique({
                where: { id: sessionId },
                include: {
                    signals: true,
                    agent: {
                        select: {
                            id: true,
                            slug: true,
                            instructions: true,
                            tools: true,
                            memoryConfig: true,
                            scorers: true,
                            version: true
                        }
                    }
                }
            });

            return session;
        });

        if (!sessionData) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Step 2: Generate proposals based on signals
        const proposals = await step.run("generate-proposals", async () => {
            const proposalsToCreate: Array<{
                proposalType: string;
                title: string;
                description: string;
                instructionsDiff?: string;
                expectedImpact: string;
                confidenceScore: number;
            }> = [];

            const signals = sessionData.signals;

            // Analyze low score patterns
            const lowScoreSignals = signals.filter((s) => s.type === "LOW_SCORE");
            if (lowScoreSignals.length > 0) {
                proposalsToCreate.push({
                    proposalType: "instructions",
                    title: "Improve response quality",
                    description: `Based on ${lowScoreSignals.length} low-scoring runs, suggest enhancing the agent's instructions to provide more complete, helpful responses.`,
                    instructionsDiff: `--- Current Instructions
+++ Proposed Instructions
@@ Add quality guidance @@
+ When responding to user queries:
+ 1. Ensure responses are complete and address all parts of the question
+ 2. Include relevant examples when helpful
+ 3. Structure responses with clear formatting
+ 4. Verify information accuracy before responding`,
                    expectedImpact: `Expected to improve average quality score by 15-25%`,
                    confidenceScore: 0.7
                });
            }

            // Analyze tool failures
            const toolFailureSignals = signals.filter((s) => s.type === "TOOL_FAILURE");
            if (toolFailureSignals.length > 0) {
                const evidence = toolFailureSignals[0].evidenceJson as Array<{
                    toolKey: string;
                    count: number;
                }>;
                const failingTools = evidence.map((e) => e.toolKey).join(", ");

                proposalsToCreate.push({
                    proposalType: "instructions",
                    title: "Improve tool usage patterns",
                    description: `${toolFailureSignals.length} tool failure patterns detected for: ${failingTools}. Suggest adding explicit tool usage guidelines.`,
                    instructionsDiff: `--- Current Instructions
+++ Proposed Instructions
@@ Add tool guidance @@
+ Tool Usage Guidelines:
+ - Validate inputs before calling tools
+ - Handle tool failures gracefully with alternative approaches
+ - Explain to users when tools are unavailable`,
                    expectedImpact: `Expected to reduce tool failure rate by 30-50%`,
                    confidenceScore: 0.65
                });
            }

            // Analyze negative feedback
            const feedbackSignals = signals.filter((s) => s.type === "NEGATIVE_FEEDBACK");
            if (feedbackSignals.length > 0) {
                proposalsToCreate.push({
                    proposalType: "instructions",
                    title: "Address user feedback patterns",
                    description: `${feedbackSignals.length} negative feedback patterns identified. Suggest improving response tone and clarity.`,
                    instructionsDiff: `--- Current Instructions
+++ Proposed Instructions
@@ Add user experience focus @@
+ User Experience Guidelines:
+ - Be conversational and approachable
+ - Acknowledge user's situation before providing solutions
+ - Offer follow-up assistance proactively
+ - Keep responses concise but complete`,
                    expectedImpact: `Expected to improve user satisfaction by 20-30%`,
                    confidenceScore: 0.6
                });
            }

            // Analyze skill correlation signals
            const skillCorrelationSignals = signals.filter((s) => s.type === "SKILL_CORRELATION");
            if (skillCorrelationSignals.length > 0) {
                const evidence = skillCorrelationSignals[0].evidenceJson as Array<{
                    skillSlug: string;
                    avgScoreWithSkill: number;
                    avgScoreWithout: number;
                    runCount: number;
                }>;
                const skillNames = evidence.map((e) => e.skillSlug).join(", ");
                const worstSkill = evidence.sort(
                    (a, b) => a.avgScoreWithSkill - b.avgScoreWithSkill
                )[0];

                proposalsToCreate.push({
                    proposalType: "skills",
                    title: "Detach underperforming skill",
                    description: `Skill "${worstSkill.skillSlug}" correlates with a ${Math.round((1 - worstSkill.avgScoreWithSkill / worstSkill.avgScoreWithout) * 100)}% decrease in quality scores (${worstSkill.avgScoreWithSkill} avg vs ${worstSkill.avgScoreWithout} baseline, across ${worstSkill.runCount} runs). Consider detaching this skill or revising its instructions. Affected skills: ${skillNames}.`,
                    expectedImpact: `Expected to restore quality scores to baseline (~${worstSkill.avgScoreWithout} avg) for affected runs`,
                    confidenceScore: 0.65
                });
            }

            // Always generate at least one proposal if there are signals
            if (proposalsToCreate.length === 0 && signals.length > 0) {
                proposalsToCreate.push({
                    proposalType: "instructions",
                    title: "General quality improvements",
                    description: `Based on ${signals.length} signals, suggest general improvements to response quality and consistency.`,
                    instructionsDiff: `--- Current Instructions
+++ Proposed Instructions
@@ General improvements @@
+ Quality Standards:
+ - Provide thorough, well-structured responses
+ - Use clear and professional language
+ - Verify accuracy of information`,
                    expectedImpact: `Expected to improve overall quality metrics`,
                    confidenceScore: 0.5
                });
            }

            return proposalsToCreate;
        });

        // Step 3: Store proposals with risk classification
        const createdProposals = await step.run("store-proposals", async () => {
            const created: Array<{
                id: string;
                sessionId: string;
                title: string;
                instructionsDiff: string | null;
                candidateVersionId: string | null;
                confidenceScore: number | null;
                riskTier: "LOW" | "MEDIUM" | "HIGH" | null;
                autoEligible: boolean;
            }> = [];

            for (const proposal of proposals) {
                // Analyze changes for risk classification
                const changeAnalysis: ProposalChangeAnalysis = {
                    hasInstructionChanges: proposal.proposalType === "instructions",
                    hasToolChanges: proposal.proposalType === "tools",
                    hasModelChanges: proposal.proposalType === "model",
                    hasMemoryChanges: proposal.proposalType === "memory",
                    hasGuardrailChanges: false,
                    estimatedCostIncreasePct: 0 // Instruction changes don't typically affect cost
                };

                // Get risk classification
                const riskResult = classifyRiskTier(changeAnalysis);

                const p = await prisma.learningProposal.create({
                    data: {
                        sessionId,
                        tenantId: sessionData.tenantId,
                        proposalType: proposal.proposalType,
                        title: proposal.title,
                        description: proposal.description,
                        instructionsDiff: proposal.instructionsDiff,
                        expectedImpact: proposal.expectedImpact,
                        confidenceScore: proposal.confidenceScore,
                        generatedBy: "heuristic",
                        isSelected: created.length === 0, // Select first proposal
                        // Risk classification
                        riskTier: riskResult.tier,
                        autoEligible: riskResult.autoEligible,
                        riskReasons: riskResult.reasons
                    }
                });

                created.push({
                    ...p,
                    riskTier: p.riskTier,
                    autoEligible: p.autoEligible
                });
            }
            return created;
        });

        // Step 4: Create candidate version for selected proposal
        const candidateVersion = await step.run("create-candidate-version", async () => {
            const selectedProposal = createdProposals[0];
            if (!selectedProposal) return null;

            // Get the latest version number to avoid unique constraint violations
            const latestVersion = await prisma.agentVersion.findFirst({
                where: { agentId },
                orderBy: { version: "desc" },
                select: { version: true }
            });

            // Also get the current agent version
            const currentAgent = await prisma.agent.findUnique({
                where: { id: agentId },
                select: { version: true, instructions: true }
            });

            // Use the max of existing versions + 1
            const maxExistingVersion = Math.max(
                latestVersion?.version || 0,
                currentAgent?.version || 0
            );
            const newVersion = maxExistingVersion + 1;
            const currentInstructions =
                currentAgent?.instructions || sessionData.agent.instructions;

            // Simple instruction enhancement (in production, would parse and apply diff)
            const enhancedInstructions =
                currentInstructions +
                "\n\n" +
                (selectedProposal.instructionsDiff || "")
                    .replace(/[+-]+ /g, "")
                    .split("\n")
                    .slice(3)
                    .join("\n");

            const agentVersion = await prisma.agentVersion.create({
                data: {
                    agentId,
                    tenantId: sessionData.tenantId,
                    version: newVersion,
                    description: selectedProposal.title,
                    instructions: enhancedInstructions,
                    modelProvider: "openai",
                    modelName: "gpt-4o",
                    changesJson: {
                        proposalId: selectedProposal.id,
                        proposalTitle: selectedProposal.title
                    },
                    snapshot: {
                        instructions: enhancedInstructions,
                        tools: sessionData.agent.tools,
                        scorers: sessionData.agent.scorers
                    },
                    createdBy: "learning-system"
                }
            });

            // Update proposal with candidate version
            await prisma.learningProposal.update({
                where: { id: selectedProposal.id },
                data: { candidateVersionId: agentVersion.id }
            });

            return agentVersion;
        });

        // Step 5: Update session status and trigger experiment
        await step.run("update-session", async () => {
            await prisma.learningSession.update({
                where: { id: sessionId },
                data: { status: "TESTING" }
            });
        });

        if (candidateVersion) {
            // Create experiment
            const experiment = await step.run("create-experiment", async () => {
                const testCases = await prisma.agentTestCase.findMany({
                    where: { agentId },
                    take: 20
                });

                return prisma.learningExperiment.create({
                    data: {
                        sessionId,
                        proposalId: createdProposals[0].id,
                        tenantId: sessionData.tenantId,
                        status: "PENDING",
                        baselineVersionId: sessionData.agent.version.toString(),
                        candidateVersionId: candidateVersion.id,
                        testCaseIds: testCases.map((t) => t.id),
                        gatingThreshold: 0.5
                    }
                });
            });

            // Trigger experiment
            await step.sendEvent("run-experiment", {
                name: "learning/experiment.run",
                data: {
                    sessionId,
                    experimentId: experiment.id,
                    agentId
                }
            });
        }

        console.log(`[Inngest] Generated ${proposals.length} proposals for session: ${sessionId}`);

        return {
            sessionId,
            proposalCount: proposals.length,
            candidateVersionId: candidateVersion?.id
        };
    }
);

/**
 * Learning Experiment Runner
 *
 * Runs A/B test comparing baseline vs candidate version.
 * Supports both simulated metrics (immediate) and real-traffic shadow testing.
 */
export const learningExperimentRunFunction = inngest.createFunction(
    {
        id: "learning-experiment-run",
        retries: 2
    },
    { event: "learning/experiment.run" },
    async ({ event, step }) => {
        const { sessionId, experimentId, agentId } = event.data;

        console.log(`[Inngest] Running experiment: ${experimentId}`);

        // Step 1: Get experiment details
        const experiment = await step.run("get-experiment", async () => {
            return prisma.learningExperiment.findUnique({
                where: { id: experimentId },
                include: {
                    proposal: true,
                    session: true
                }
            });
        });

        if (!experiment) {
            throw new Error(`Experiment not found: ${experimentId}`);
        }

        // Step 2: Update experiment status and initialize traffic split
        await step.run("start-experiment", async () => {
            const policy = await prisma.learningPolicy.findUnique({
                where: { agentId }
            });

            const config = getEffectiveConfig(policy || {});

            await prisma.learningExperiment.update({
                where: { id: experimentId },
                data: {
                    status: "RUNNING",
                    startedAt: new Date(),
                    trafficSplit: {
                        baseline: 1 - config.trafficSplitCandidate,
                        candidate: config.trafficSplitCandidate
                    }
                }
            });
        });

        // Step 3: Get baseline metrics from recent evaluations
        const baselineMetrics = await step.run("compute-baseline-metrics", async () => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            // First try to get metrics from experiment-tagged runs
            const experimentRuns = await prisma.agentRun.findMany({
                where: {
                    experimentId,
                    experimentGroup: "baseline",
                    status: "COMPLETED"
                },
                include: {
                    evaluation: { select: { scoresJson: true } }
                }
            });

            // If we have enough experiment runs, use them
            if (experimentRuns.length >= TRAFFIC_SPLIT.minRunsPerGroup) {
                const runsWithEvals = experimentRuns.filter((r) => r.evaluation);
                if (runsWithEvals.length > 0) {
                    const scores = runsWithEvals.map((r) => {
                        const s = r.evaluation!.scoresJson as Record<string, number>;
                        return Object.values(s).reduce((a, b) => a + b, 0) / Object.keys(s).length;
                    });

                    return {
                        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
                        successRate: scores.filter((s) => s >= 0.5).length / scores.length,
                        sampleCount: runsWithEvals.length,
                        source: "experiment" as const
                    };
                }
            }

            // Fall back to historical baseline data
            const evals = await prisma.agentEvaluation.findMany({
                where: {
                    agentId,
                    createdAt: { gte: sevenDaysAgo }
                },
                take: 50
            });

            if (evals.length === 0) {
                return {
                    avgScore: 0.5,
                    successRate: 0.8,
                    sampleCount: 0,
                    source: "default" as const
                };
            }

            const scores = evals.map((e) => {
                const s = e.scoresJson as Record<string, number>;
                return Object.values(s).reduce((a, b) => a + b, 0) / Object.keys(s).length;
            });

            return {
                avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
                successRate: scores.filter((s) => s >= 0.5).length / scores.length,
                sampleCount: evals.length,
                source: "historical" as const
            };
        });

        // Step 4: Get candidate metrics from experiment-tagged runs or simulate
        const candidateMetrics = await step.run("compute-candidate-metrics", async () => {
            // Try to get metrics from experiment-tagged candidate runs
            const candidateRuns = await prisma.agentRun.findMany({
                where: {
                    experimentId,
                    experimentGroup: "candidate",
                    status: "COMPLETED"
                },
                include: {
                    evaluation: { select: { scoresJson: true } }
                }
            });

            // If we have enough real candidate runs, use them
            if (candidateRuns.length >= TRAFFIC_SPLIT.minRunsPerGroup) {
                const runsWithEvals = candidateRuns.filter((r) => r.evaluation);
                if (runsWithEvals.length > 0) {
                    const scores = runsWithEvals.map((r) => {
                        const s = r.evaluation!.scoresJson as Record<string, number>;
                        return Object.values(s).reduce((a, b) => a + b, 0) / Object.keys(s).length;
                    });

                    return {
                        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
                        successRate: scores.filter((s) => s >= 0.5).length / scores.length,
                        sampleCount: runsWithEvals.length,
                        source: "experiment" as const
                    };
                }
            }

            // Fall back to simulated improvement based on proposal confidence
            const improvement = experiment.proposal.confidenceScore || 0.1;
            const simulatedImprovement = 1 + improvement * 0.2;

            return {
                avgScore: Math.min(baselineMetrics.avgScore * simulatedImprovement, 1.0),
                successRate: Math.min(baselineMetrics.successRate * simulatedImprovement, 1.0),
                sampleCount: baselineMetrics.sampleCount,
                source: "simulated" as const
            };
        });

        // Step 5: Compute win rate and gating decision
        const gatingResult = await step.run("compute-gating", async () => {
            const scoreDiff = candidateMetrics.avgScore - baselineMetrics.avgScore;
            const winRate =
                candidateMetrics.avgScore > baselineMetrics.avgScore
                    ? 0.6 + scoreDiff
                    : 0.4 - scoreDiff;

            const gatingPassed = winRate >= experiment.gatingThreshold;

            await prisma.learningExperiment.update({
                where: { id: experimentId },
                data: {
                    status: "COMPLETED",
                    baselineMetrics,
                    candidateMetrics,
                    winRate,
                    confidenceInterval: { lower: winRate - 0.1, upper: winRate + 0.1 },
                    gatingResult: gatingPassed ? "passed" : "failed",
                    completedAt: new Date()
                }
            });

            return { winRate, gatingPassed };
        });

        // Step 6: Check for auto-promotion eligibility
        if (gatingResult.gatingPassed) {
            // Get policy for this agent
            const policy = await step.run("get-policy-for-auto", async () => {
                return prisma.learningPolicy.findUnique({
                    where: { agentId }
                });
            });

            // Check if auto-promotion is possible
            const autoPromotionCheck = await step.run("check-auto-promotion", async () => {
                // Check for guardrail regressions (simplified - would need real guardrail data)
                const hasRegressions = false;

                // Estimate cost increase (0 for instruction-only changes)
                const costIncreasePct = 0;

                return canAutoPromote({
                    riskTier: experiment.proposal.riskTier || "HIGH",
                    winRate: gatingResult.winRate,
                    confidenceScore: experiment.proposal.confidenceScore || 0,
                    runCount: experiment.baselineRunCount + experiment.candidateRunCount,
                    costIncreasePct,
                    hasRegressions,
                    policyOverrides: policy || {}
                });
            });

            if (autoPromotionCheck.canAutoPromote) {
                // Auto-promote the version
                console.log(`[Inngest] Auto-promoting experiment ${experimentId}`);

                await step.run("auto-promote", async () => {
                    // Get selected proposal and candidate version
                    const selectedProposal = await prisma.learningProposal.findFirst({
                        where: { sessionId, isSelected: true }
                    });

                    if (!selectedProposal?.candidateVersionId) {
                        throw new Error("No candidate version found for auto-promotion");
                    }

                    const candidateVersion = await prisma.agentVersion.findUnique({
                        where: { id: selectedProposal.candidateVersionId }
                    });

                    if (!candidateVersion) {
                        throw new Error(
                            `Candidate version not found: ${selectedProposal.candidateVersionId}`
                        );
                    }

                    // Promote the version
                    await prisma.agent.update({
                        where: { id: agentId },
                        data: {
                            instructions: candidateVersion.instructions,
                            version: candidateVersion.version,
                            updatedAt: new Date()
                        }
                    });

                    // Create auto-approval record
                    await prisma.learningApproval.create({
                        data: {
                            sessionId,
                            tenantId: experiment.tenantId,
                            decision: "auto_approved",
                            autoApproved: true,
                            rationale: `Auto-approved: ${autoPromotionCheck.reasons.length === 0 ? "All criteria met" : autoPromotionCheck.reasons.join("; ")}`,
                            approvedBy: "system",
                            promotedVersionId: candidateVersion.id,
                            reviewedAt: new Date()
                        }
                    });

                    // Update session status
                    await prisma.learningSession.update({
                        where: { id: sessionId },
                        data: {
                            status: "PROMOTED",
                            completedAt: new Date()
                        }
                    });

                    // Audit log for auto-promotion
                    await prisma.auditLog.create({
                        data: {
                            tenantId: experiment.tenantId,
                            actorId: "system",
                            action: "LEARNING_AUTO_PROMOTED",
                            entityType: "Agent",
                            entityId: agentId,
                            metadata: {
                                sessionId,
                                experimentId,
                                proposalId: selectedProposal.id,
                                previousVersion: experiment.baselineVersionId,
                                newVersion: candidateVersion.version,
                                winRate: gatingResult.winRate,
                                riskTier: experiment.proposal.riskTier,
                                metricsSource: candidateMetrics.source
                            }
                        }
                    });

                    // Send auto-promotion alert
                    await alertAutoPromotion({
                        agentId,
                        proposalId: selectedProposal.id,
                        proposalTitle: selectedProposal.title || "Untitled Proposal",
                        winRate: gatingResult.winRate,
                        confidenceScore: experiment.proposal.confidenceScore || 0
                    });
                });

                console.log(`[Inngest] Experiment ${experimentId} auto-promoted successfully`);

                return {
                    experimentId,
                    winRate: gatingResult.winRate,
                    gatingPassed: true,
                    autoPromoted: true
                };
            } else {
                // Require human approval
                console.log(
                    `[Inngest] Experiment ${experimentId} requires human approval: ${autoPromotionCheck.reasons.join(", ")}`
                );

                await step.run("request-approval", async () => {
                    await prisma.learningSession.update({
                        where: { id: sessionId },
                        data: { status: "AWAITING_APPROVAL" }
                    });

                    // Create approval record
                    await prisma.learningApproval.create({
                        data: {
                            sessionId,
                            tenantId: experiment.tenantId,
                            decision: "pending",
                            autoApproved: false
                        }
                    });
                });

                // Send approval request event
                await step.sendEvent("approval-request", {
                    name: "learning/approval.request",
                    data: {
                        sessionId,
                        agentId,
                        proposalId: experiment.proposalId
                    }
                });
            }
        } else {
            // Mark session as failed (experiment did not pass)
            await step.run("mark-failed", async () => {
                await prisma.learningSession.update({
                    where: { id: sessionId },
                    data: {
                        status: "FAILED",
                        completedAt: new Date(),
                        metadata: {
                            failureReason: `Experiment failed: win rate ${(gatingResult.winRate * 100).toFixed(1)}% below threshold ${(experiment.gatingThreshold * 100).toFixed(1)}%`
                        }
                    }
                });
            });
        }

        console.log(
            `[Inngest] Experiment ${experimentId} completed: ${gatingResult.gatingPassed ? "PASSED" : "FAILED"}`
        );

        return {
            experimentId,
            winRate: gatingResult.winRate,
            gatingPassed: gatingResult.gatingPassed,
            autoPromoted: false
        };
    }
);

/**
 * Experiment Evaluation Checker
 *
 * Periodically checks running experiments and evaluates them when
 * they have enough data or reach their time limit.
 */
export const experimentEvaluationCheckerFunction = inngest.createFunction(
    {
        id: "experiment-evaluation-checker",
        retries: 1
    },
    { cron: "*/15 * * * *" }, // Run every 15 minutes
    async ({ step }) => {
        console.log(`[Inngest] Checking running experiments for evaluation`);

        // Step 1: Find all running experiments
        const runningExperiments = await step.run("get-running-experiments", async () => {
            return prisma.learningExperiment.findMany({
                where: { status: "RUNNING" },
                include: {
                    session: { select: { agentId: true } },
                    proposal: {
                        select: { riskTier: true, autoEligible: true, confidenceScore: true }
                    }
                }
            });
        });

        console.log(`[Inngest] Found ${runningExperiments.length} running experiments`);

        const evaluatedExperiments: string[] = [];

        for (const experiment of runningExperiments) {
            const shouldEval = await step.run(`check-${experiment.id}`, async () => {
                if (!experiment.startedAt)
                    return { shouldEvaluate: false, reason: "No start time" };

                // Ensure startedAt is a Date object
                const startedAt = new Date(experiment.startedAt);

                return shouldEvaluateExperiment(
                    experiment.baselineRunCount,
                    experiment.candidateRunCount,
                    startedAt
                );
            });

            if (shouldEval.shouldEvaluate) {
                // Check if this is a timeout with potentially inconclusive results
                const isTimeout = shouldEval.reason === "Maximum experiment duration reached";
                const totalRuns = experiment.baselineRunCount + experiment.candidateRunCount;
                const hasInconclusiveData = totalRuns < TRAFFIC_SPLIT.minRunsPerGroup * 2;

                // Send timeout alert if inconclusive
                if (isTimeout && hasInconclusiveData) {
                    const elapsedHours = experiment.startedAt
                        ? Math.round(
                              (Date.now() - new Date(experiment.startedAt).getTime()) /
                                  (1000 * 60 * 60)
                          )
                        : TRAFFIC_SPLIT.maxExperimentDurationHours;

                    await step.run(`alert-timeout-${experiment.id}`, async () => {
                        await alertExperimentTimeout({
                            agentId: experiment.session.agentId,
                            experimentId: experiment.id,
                            durationHours: elapsedHours,
                            runCount: totalRuns
                        });
                    });
                }

                // Trigger experiment evaluation
                await step.sendEvent(`evaluate-${experiment.id}`, {
                    name: "learning/experiment.run",
                    data: {
                        sessionId: experiment.sessionId,
                        experimentId: experiment.id,
                        agentId: experiment.session.agentId
                    }
                });

                evaluatedExperiments.push(experiment.id);
                console.log(
                    `[Inngest] Triggered evaluation for experiment ${experiment.id}: ${shouldEval.reason}`
                );
            }
        }

        return {
            checked: runningExperiments.length,
            evaluated: evaluatedExperiments.length,
            evaluatedExperiments
        };
    }
);

/**
 * Learning Approval Handler
 *
 * Handles human approval decisions and promotes versions when approved.
 */
export const learningApprovalHandlerFunction = inngest.createFunction(
    {
        id: "learning-approval-handler",
        retries: 2
    },
    { event: "learning/approval.request" },
    async ({ event, step }) => {
        const { sessionId, proposalId } = event.data;

        console.log(`[Inngest] Processing approval request for session: ${sessionId}`);

        // Step 1: Get session and proposal data
        const data = await step.run("get-data", async () => {
            const session = await prisma.learningSession.findUnique({
                where: { id: sessionId },
                include: {
                    proposals: {
                        where: { id: proposalId }
                    },
                    experiments: {
                        orderBy: { createdAt: "desc" },
                        take: 1
                    },
                    agent: {
                        select: { id: true, slug: true, name: true }
                    }
                }
            });

            return session;
        });

        if (!data) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Step 2: Create audit log for pending approval
        await step.run("audit-pending", async () => {
            await prisma.auditLog.create({
                data: {
                    tenantId: data.tenantId,
                    actorId: "system",
                    action: "LEARNING_APPROVAL_PENDING",
                    entityType: "LearningSession",
                    entityId: sessionId,
                    metadata: {
                        agentName: data.agent.name,
                        agentSlug: data.agent.slug,
                        proposalTitle: data.proposals[0]?.title,
                        experimentResult: data.experiments[0]?.gatingResult
                    }
                }
            });
        });

        // Note: In a production system, this would wait for human approval
        // via the UI and a webhook/API call. For now, we just log the request.

        console.log(`[Inngest] Approval request created for session: ${sessionId}`);
        console.log(`[Inngest] Agent: ${data.agent.slug}, Proposal: ${data.proposals[0]?.title}`);

        return {
            sessionId,
            agentSlug: data.agent.slug,
            proposalTitle: data.proposals[0]?.title,
            awaitingApproval: true
        };
    }
);

/**
 * Learning Version Promotion
 *
 * Promotes approved versions to production.
 * Triggered via API when human approves.
 */
export const learningVersionPromotionFunction = inngest.createFunction(
    {
        id: "learning-version-promotion",
        retries: 2
    },
    { event: "learning/version.promote" },
    async ({ event, step }) => {
        const { sessionId, approvedBy, rationale } = event.data;

        console.log(`[Inngest] Promoting version for session: ${sessionId}`);

        // Step 1: Get session and proposal
        const session = await step.run("get-session", async () => {
            return prisma.learningSession.findUnique({
                where: { id: sessionId },
                include: {
                    proposals: {
                        where: { isSelected: true }
                    },
                    agent: true,
                    approval: true
                }
            });
        });

        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        if (session.status !== "AWAITING_APPROVAL") {
            throw new Error(
                `Session ${sessionId} is not awaiting approval (status: ${session.status})`
            );
        }

        const selectedProposal = session.proposals[0];
        if (!selectedProposal?.candidateVersionId) {
            throw new Error(`No candidate version found for session: ${sessionId}`);
        }

        // Step 2: Get candidate version
        const candidateVersion = await step.run("get-candidate", async () => {
            return prisma.agentVersion.findUnique({
                where: { id: selectedProposal.candidateVersionId! }
            });
        });

        if (!candidateVersion) {
            throw new Error(`Candidate version not found: ${selectedProposal.candidateVersionId}`);
        }

        // Step 3: Update agent with new version
        await step.run("promote-version", async () => {
            await prisma.agent.update({
                where: { id: session.agentId },
                data: {
                    instructions: candidateVersion.instructions,
                    version: candidateVersion.version,
                    updatedAt: new Date()
                }
            });
        });

        // Step 4: Update approval record
        await step.run("update-approval", async () => {
            await prisma.learningApproval.update({
                where: { sessionId },
                data: {
                    decision: "approved",
                    approvedBy,
                    rationale,
                    promotedVersionId: candidateVersion.id,
                    reviewedAt: new Date()
                }
            });
        });

        // Step 5: Update session status
        await step.run("complete-session", async () => {
            await prisma.learningSession.update({
                where: { id: sessionId },
                data: {
                    status: "PROMOTED",
                    completedAt: new Date()
                }
            });
        });

        // Step 6: Create audit log
        await step.run("audit-promotion", async () => {
            await prisma.auditLog.create({
                data: {
                    tenantId: session.tenantId,
                    actorId: approvedBy,
                    action: "LEARNING_VERSION_PROMOTED",
                    entityType: "Agent",
                    entityId: session.agentId,
                    metadata: {
                        sessionId,
                        previousVersion: session.agent.version,
                        newVersion: candidateVersion.version,
                        proposalTitle: selectedProposal.title,
                        rationale
                    }
                }
            });
        });

        console.log(
            `[Inngest] Version promoted: ${candidateVersion.version} for agent ${session.agent.slug}`
        );

        return {
            sessionId,
            agentId: session.agentId,
            newVersion: candidateVersion.version,
            promoted: true
        };
    }
);

/**
 * Daily Metrics Rollup
 *
 * Computes and stores daily learning metrics for all agents.
 * Triggered daily via cron or manually.
 */
export const dailyMetricsRollupFunction = inngest.createFunction(
    {
        id: "daily-metrics-rollup",
        retries: 2
    },
    { event: "metrics/daily.rollup" },
    async ({ event, step }) => {
        // Default to yesterday if no date provided
        const targetDateStr = event.data.date;
        const targetDate = targetDateStr
            ? new Date(targetDateStr)
            : new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Set to start of day
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        console.log(
            `[Inngest] Running daily metrics rollup for ${targetDate.toISOString().split("T")[0]}`
        );

        // Step 1: Get all agents
        const agents = await step.run("get-agents", async () => {
            return prisma.agent.findMany({
                select: { id: true, slug: true, tenantId: true }
            });
        });

        // Step 2: Compute metrics for each agent
        for (const agent of agents) {
            await step.run(`rollup-${agent.slug}`, async () => {
                // Get learning sessions for the day with approvals
                const sessions = await prisma.learningSession.findMany({
                    where: {
                        agentId: agent.id,
                        createdAt: {
                            gte: targetDate,
                            lt: nextDay
                        }
                    },
                    include: {
                        proposals: true,
                        experiments: true,
                        approval: true
                    }
                });

                // Compute basic metrics
                const sessionsStarted = sessions.length;
                const sessionsCompleted = sessions.filter((s) =>
                    ["APPROVED", "PROMOTED", "REJECTED", "FAILED"].includes(s.status)
                ).length;
                const proposalsGenerated = sessions.reduce((sum, s) => sum + s.proposals.length, 0);
                const proposalsApproved = sessions.filter((s) => s.status === "PROMOTED").length;
                const proposalsRejected = sessions.filter((s) => s.status === "REJECTED").length;
                const experimentsRun = sessions.reduce((sum, s) => sum + s.experiments.length, 0);
                const experimentsPassed = sessions.reduce(
                    (sum, s) =>
                        sum + s.experiments.filter((e) => e.gatingResult === "passed").length,
                    0
                );
                const versionsPromoted = sessions.filter((s) => s.status === "PROMOTED").length;

                // Calculate auto vs manual promotions
                const autoPromotions = sessions.filter(
                    (s) => s.status === "PROMOTED" && s.approval?.autoApproved === true
                ).length;
                const manualPromotions = sessions.filter(
                    (s) => s.status === "PROMOTED" && s.approval?.autoApproved !== true
                ).length;

                // Calculate shadow run metrics from experiments
                const shadowRunCount = sessions.reduce(
                    (sum, s) => sum + s.experiments.reduce((eSum, e) => eSum + e.shadowRunCount, 0),
                    0
                );
                const baselineRunCount = sessions.reduce(
                    (sum, s) =>
                        sum + s.experiments.reduce((eSum, e) => eSum + e.baselineRunCount, 0),
                    0
                );
                const candidateRunCount = sessions.reduce(
                    (sum, s) =>
                        sum + s.experiments.reduce((eSum, e) => eSum + e.candidateRunCount, 0),
                    0
                );

                // Count guardrail regressions (from guardrail events on experiment runs)
                const experimentIds = sessions.flatMap((s) => s.experiments.map((e) => e.id));
                const regressionCount =
                    experimentIds.length > 0
                        ? await prisma.guardrailEvent.count({
                              where: {
                                  run: {
                                      experimentId: { in: experimentIds }
                                  },
                                  createdAt: {
                                      gte: targetDate,
                                      lt: nextDay
                                  }
                              }
                          })
                        : 0;

                // Count trigger types from session metadata
                const scheduledTriggers = sessions.filter((s) => {
                    const metadata = s.metadata as { triggerType?: string } | null;
                    return metadata?.triggerType === "scheduled";
                }).length;
                const thresholdTriggers = sessions.filter((s) => {
                    const metadata = s.metadata as { triggerType?: string } | null;
                    return metadata?.triggerType === "threshold";
                }).length;

                // Calculate average improvement
                let avgImprovementPct = 0;
                const promotedWithMetrics = sessions.filter(
                    (s) =>
                        s.status === "PROMOTED" &&
                        s.experiments.some((e) => e.baselineMetrics && e.candidateMetrics)
                );
                if (promotedWithMetrics.length > 0) {
                    const improvements = promotedWithMetrics.map((s) => {
                        const exp = s.experiments[0];
                        const baseline =
                            (exp.baselineMetrics as { avgScore?: number })?.avgScore || 0;
                        const candidate =
                            (exp.candidateMetrics as { avgScore?: number })?.avgScore || 0;
                        return baseline > 0 ? ((candidate - baseline) / baseline) * 100 : 0;
                    });
                    avgImprovementPct =
                        improvements.reduce((a, b) => a + b, 0) / improvements.length;
                }

                // Calculate eval coverage
                const totalRuns = await prisma.agentRun.count({
                    where: {
                        agentId: agent.id,
                        status: "COMPLETED",
                        createdAt: {
                            gte: targetDate,
                            lt: nextDay
                        }
                    }
                });
                const evaluatedRuns = await prisma.agentEvaluation.count({
                    where: {
                        agentId: agent.id,
                        createdAt: {
                            gte: targetDate,
                            lt: nextDay
                        }
                    }
                });
                const evalCoverage = totalRuns > 0 ? (evaluatedRuns / totalRuns) * 100 : null;

                // Upsert daily metrics with all new fields
                await prisma.learningMetricDaily.upsert({
                    where: {
                        agentId_date: {
                            agentId: agent.id,
                            date: targetDate
                        }
                    },
                    create: {
                        agentId: agent.id,
                        tenantId: agent.tenantId,
                        date: targetDate,
                        sessionsStarted,
                        sessionsCompleted,
                        proposalsGenerated,
                        proposalsApproved,
                        proposalsRejected,
                        experimentsRun,
                        experimentsPassed,
                        versionsPromoted,
                        avgImprovementPct,
                        evalCoverage,
                        // New continuous learning metrics
                        autoPromotions,
                        manualPromotions,
                        shadowRunCount,
                        baselineRunCount,
                        candidateRunCount,
                        regressionCount,
                        scheduledTriggers,
                        thresholdTriggers
                    },
                    update: {
                        sessionsStarted,
                        sessionsCompleted,
                        proposalsGenerated,
                        proposalsApproved,
                        proposalsRejected,
                        experimentsRun,
                        experimentsPassed,
                        versionsPromoted,
                        avgImprovementPct,
                        evalCoverage,
                        // New continuous learning metrics
                        autoPromotions,
                        manualPromotions,
                        shadowRunCount,
                        baselineRunCount,
                        candidateRunCount,
                        regressionCount,
                        scheduledTriggers,
                        thresholdTriggers
                    }
                });

                console.log(
                    `[Inngest] Metrics rolled up for ${agent.slug}: ${sessionsStarted} sessions, ${proposalsGenerated} proposals`
                );
            });
        }

        // Step 3: Workflow metrics
        const workflows = await step.run("get-workflows", async () => {
            return prisma.workflow.findMany({ select: { id: true, slug: true } });
        });

        for (const workflow of workflows) {
            await step.run(`workflow-metrics-${workflow.slug}`, async () => {
                await refreshWorkflowMetrics(workflow.id, targetDate);
            });
        }

        // Step 4: Network metrics
        const networks = await step.run("get-networks", async () => {
            return prisma.network.findMany({ select: { id: true, slug: true } });
        });

        for (const network of networks) {
            await step.run(`network-metrics-${network.slug}`, async () => {
                await refreshNetworkMetrics(network.id, targetDate);
            });
        }

        console.log(
            `[Inngest] Daily metrics rollup complete for ${targetDate.toISOString().split("T")[0]}`
        );

        return {
            date: targetDate.toISOString().split("T")[0],
            agentsProcessed: agents.length
        };
    }
);

// ==============================
// AI Insights Generation
// ==============================

/**
 * Insight types for categorization
 */
type InsightType = "performance" | "quality" | "cost" | "warning" | "info";

/**
 * Generated insight structure
 */
interface GeneratedInsight {
    type: InsightType;
    title: string;
    description: string;
}

/**
 * Signal data collected from evaluations
 */
interface InsightSignals {
    avgScoreByScorer: Record<string, number>;
    scoreTrends: Record<string, { current: number; previous: number; change: number }>;
    lowScoreCount: number;
    totalEvaluations: number;
    feedbackSummary: { positive: number; negative: number };
    costTotal: number;
    guardrailHits: number;
}

/**
 * Generate AI Insights Function
 *
 * Triggered after evaluations complete. Collects signals, uses LLM to synthesize
 * actionable insights, and persists them to the database.
 */
export const generateInsightsFunction = inngest.createFunction(
    {
        id: "generate-ai-insights",
        retries: 2,
        // Rate limit to avoid generating too many insights in quick succession
        rateLimit: {
            key: "event.data.agentId",
            limit: 1,
            period: "5m" // Max 1 insight generation per agent per 5 minutes
        }
    },
    { event: "evaluation/completed" },
    async ({ event, step }) => {
        const { agentId } = event.data;

        console.log(`[Inngest] Generating AI insights for agent: ${agentId}`);

        // Step 1: Collect recent evaluation data (last 14 days)
        const signals = await step.run("collect-signals", async () => {
            const windowStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
            const windowMid = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            // Get recent evaluations
            const evaluations = await prisma.agentEvaluation.findMany({
                where: {
                    agentId,
                    createdAt: { gte: windowStart }
                },
                orderBy: { createdAt: "desc" },
                take: 100
            });

            if (evaluations.length < 5) {
                // Not enough data to generate meaningful insights
                return null;
            }

            // Calculate average scores by scorer
            const scoresByScorer: Record<string, number[]> = {};
            for (const eval_ of evaluations) {
                const scores = eval_.scoresJson as Record<string, number>;
                if (scores) {
                    for (const [key, value] of Object.entries(scores)) {
                        if (typeof value === "number") {
                            if (!scoresByScorer[key]) scoresByScorer[key] = [];
                            scoresByScorer[key].push(value);
                        }
                    }
                }
            }

            const avgScoreByScorer: Record<string, number> = {};
            for (const [key, scores] of Object.entries(scoresByScorer)) {
                avgScoreByScorer[key] =
                    Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
            }

            // Calculate trends (compare last 7 days to previous 7 days)
            const recentEvals = evaluations.filter((e) => e.createdAt >= windowMid);
            const olderEvals = evaluations.filter((e) => e.createdAt < windowMid);

            const scoreTrends: Record<
                string,
                { current: number; previous: number; change: number }
            > = {};

            if (recentEvals.length > 0 && olderEvals.length > 0) {
                for (const scorer of Object.keys(avgScoreByScorer)) {
                    const recentScores = recentEvals
                        .map((e) => (e.scoresJson as Record<string, number>)?.[scorer])
                        .filter((s): s is number => typeof s === "number");
                    const olderScores = olderEvals
                        .map((e) => (e.scoresJson as Record<string, number>)?.[scorer])
                        .filter((s): s is number => typeof s === "number");

                    if (recentScores.length > 0 && olderScores.length > 0) {
                        const current =
                            recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
                        const previous =
                            olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
                        scoreTrends[scorer] = {
                            current: Math.round(current * 100) / 100,
                            previous: Math.round(previous * 100) / 100,
                            change: Math.round((current - previous) * 100) / 100
                        };
                    }
                }
            }

            // Count low scores (below 0.5)
            let lowScoreCount = 0;
            for (const eval_ of evaluations) {
                const scores = eval_.scoresJson as Record<string, number>;
                if (scores) {
                    const avg =
                        Object.values(scores).reduce((a, b) => a + b, 0) /
                        Object.values(scores).length;
                    if (avg < 0.5) lowScoreCount++;
                }
            }

            // Get feedback summary
            const feedbackAgg = await prisma.agentFeedbackAggregateDaily.aggregate({
                where: {
                    agentId,
                    date: { gte: windowStart }
                },
                _sum: {
                    positiveCount: true,
                    negativeCount: true
                }
            });

            // Get cost total
            const costAgg = await prisma.costEvent.aggregate({
                where: {
                    agentId,
                    createdAt: { gte: windowStart }
                },
                _sum: { costUsd: true }
            });

            // Get guardrail hits
            const guardrailHits = await prisma.guardrailEvent.count({
                where: {
                    agentId,
                    createdAt: { gte: windowStart },
                    type: "BLOCKED"
                }
            });

            const signals: InsightSignals = {
                avgScoreByScorer,
                scoreTrends,
                lowScoreCount,
                totalEvaluations: evaluations.length,
                feedbackSummary: {
                    positive: feedbackAgg._sum.positiveCount || 0,
                    negative: feedbackAgg._sum.negativeCount || 0
                },
                costTotal: costAgg._sum.costUsd || 0,
                guardrailHits
            };

            return signals;
        });

        if (!signals) {
            console.log(`[Inngest] Not enough data for insights, skipping agent: ${agentId}`);
            return { agentId, skipped: true, reason: "insufficient data" };
        }

        // Step 2: Generate insights using LLM
        const generatedInsights = await step.run("generate-insights-llm", async () => {
            // Build a summary prompt for the LLM
            const signalsSummary = buildSignalsSummary(signals);

            // Get the structured agent for JSON output
            const structuredAgent = mastra.getAgent("structured");
            if (!structuredAgent) {
                console.error("[Inngest] Structured agent not available for insight generation");
                return [];
            }

            const prompt = `You are an AI agent quality analyst. Analyze the following evaluation metrics and generate 1-3 actionable insights.

EVALUATION DATA (last 14 days):
${signalsSummary}

Generate insights as a JSON array. Each insight should have:
- "type": one of "performance", "quality", "cost", "warning", "info"
- "title": short title (max 60 chars)
- "description": one paragraph explanation with specific recommendations (max 300 chars)

Focus on:
1. Significant score changes (>10% improvement or decline)
2. Consistently low scores (<0.5) in any category
3. High guardrail hit rates (>5%)
4. Negative feedback trends
5. Cost anomalies

If metrics look healthy, generate a single "info" type insight acknowledging good performance.

Return ONLY a valid JSON array of insights, no other text.`;

            try {
                const response = await structuredAgent.generate(prompt, { maxSteps: 1 });
                const text = response.text || "";

                // Parse the JSON response
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (!jsonMatch) {
                    console.error("[Inngest] No JSON array found in LLM response");
                    return [];
                }

                const parsed = JSON.parse(jsonMatch[0]) as GeneratedInsight[];

                // Validate and sanitize
                const validInsights: GeneratedInsight[] = [];
                const validTypes: InsightType[] = [
                    "performance",
                    "quality",
                    "cost",
                    "warning",
                    "info"
                ];

                for (const insight of parsed) {
                    if (
                        insight.type &&
                        validTypes.includes(insight.type) &&
                        insight.title &&
                        insight.description
                    ) {
                        validInsights.push({
                            type: insight.type,
                            title: insight.title.slice(0, 100),
                            description: insight.description.slice(0, 500)
                        });
                    }
                }

                return validInsights.slice(0, 3); // Max 3 insights per generation
            } catch (err) {
                console.error("[Inngest] Error generating insights:", err);
                return [];
            }
        });

        if (generatedInsights.length === 0) {
            console.log(`[Inngest] No insights generated for agent: ${agentId}`);
            return { agentId, insightsCreated: 0 };
        }

        // Step 3: Deduplicate and persist insights
        const persistedCount = await step.run("persist-insights", async () => {
            const dedupeWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            // Get recent insights for deduplication
            const recentInsights = await prisma.insight.findMany({
                where: {
                    agentId,
                    createdAt: { gte: dedupeWindow }
                },
                select: { type: true, title: true }
            });

            // Create a set of existing insight keys for fast lookup
            const existingKeys = new Set(
                recentInsights.map((i) => `${i.type}:${i.title.toLowerCase().trim()}`)
            );

            let created = 0;
            for (const insight of generatedInsights) {
                const key = `${insight.type}:${insight.title.toLowerCase().trim()}`;
                if (!existingKeys.has(key)) {
                    await prisma.insight.create({
                        data: {
                            agentId,
                            type: insight.type,
                            title: insight.title,
                            description: insight.description
                        }
                    });
                    existingKeys.add(key); // Prevent duplicates within this batch
                    created++;
                }
            }

            return created;
        });

        console.log(`[Inngest] Generated ${persistedCount} insights for agent: ${agentId}`);

        return { agentId, insightsCreated: persistedCount };
    }
);

// ==============================
// BIM Processing Functions
// ==============================

/**
 * BIM IFC Parse Function
 *
 * Parses IFC files with web-ifc and persists normalized elements.
 */
export const bimIfcParseFunction = inngest.createFunction(
    {
        id: "bim-ifc-parse",
        retries: 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onFailure: async ({ error, event }: { error: Error; event: any }) => {
            const versionId = event?.data?.versionId as string | undefined;
            if (!versionId) {
                return;
            }

            const version = await prisma.bimModelVersion.findUnique({
                where: { id: versionId }
            });
            if (!version) {
                return;
            }

            const existingMetadata =
                version.metadata && typeof version.metadata === "object"
                    ? (version.metadata as Record<string, unknown>)
                    : {};

            await prisma.bimModelVersion.update({
                where: { id: versionId },
                data: {
                    status: "FAILED",
                    metadata: {
                        ...existingMetadata,
                        ifcParseError: error.message,
                        failedAt: new Date().toISOString()
                    }
                }
            });
        }
    },
    { event: "bim/ifc.parse" },
    async ({ event, step }) => {
        const { versionId, sourceKey } = event.data;
        if (!versionId || !sourceKey) {
            throw new Error("Missing versionId or sourceKey for IFC parsing.");
        }

        await step.run("mark-processing", async () => {
            await prisma.bimModelVersion.update({
                where: { id: versionId },
                data: { status: "PROCESSING" }
            });
        });

        const bufferBase64 = await step.run("download-ifc", async () => {
            const buffer = await getBimObjectBuffer({ key: sourceKey });
            return buffer.toString("base64");
        });

        const parsed = await step.run("parse-ifc", async () => {
            return parseIfcBuffer(Buffer.from(bufferBase64, "base64"));
        });

        const ingestResult = await step.run("persist-elements", async () => {
            return ingestBimElementsForVersion({
                versionId,
                elements: parsed.elements,
                metadata: parsed.metadata
            });
        });

        return {
            versionId,
            elementsIngested: ingestResult.elementsIngested
        };
    }
);

// ==============================
// Simulation System Functions
// ==============================

/**
 * Simulation Session Start Function
 *
 * Triggered when a new simulation session is created.
 * Fans out to batch.run events for parallel processing.
 */
export const simulationSessionStartFunction = inngest.createFunction(
    {
        id: "simulation-session-start",
        retries: 2
    },
    { event: "simulation/session.start" },
    async ({ event, step }) => {
        const { sessionId, agentId, theme, targetCount, concurrency } = event.data;

        console.log(`[Simulation] Starting session ${sessionId} for agent ${agentId}`);

        // Step 1: Mark session as RUNNING
        await step.run("mark-running", async () => {
            await prisma.simulationSession.update({
                where: { id: sessionId },
                data: {
                    status: "RUNNING",
                    startedAt: new Date()
                }
            });
        });

        // Step 2: Fan out to batch runs
        const batchSize = 10; // Process 10 conversations per batch
        const numBatches = Math.ceil(targetCount / batchSize);

        await step.run("fan-out-batches", async () => {
            const events = [];
            for (let i = 0; i < numBatches; i++) {
                events.push({
                    name: "simulation/batch.run" as const,
                    data: {
                        sessionId,
                        agentId,
                        theme,
                        batchIndex: i,
                        batchSize: Math.min(batchSize, targetCount - i * batchSize)
                    }
                });
            }

            // Send events in chunks to avoid overwhelming Inngest
            const chunkSize = concurrency;
            for (let i = 0; i < events.length; i += chunkSize) {
                const chunk = events.slice(i, i + chunkSize);
                await inngest.send(chunk);
            }
        });

        return { sessionId, batchesCreated: numBatches };
    }
);

/**
 * Simulation Batch Run Function
 *
 * Processes a batch of simulated conversations.
 * Each conversation updates progress immediately for real-time feedback.
 */
export const simulationBatchRunFunction = inngest.createFunction(
    {
        id: "simulation-batch-run",
        retries: 1,
        concurrency: {
            limit: 5 // Limit concurrent batches per session
        }
    },
    { event: "simulation/batch.run" },
    async ({ event, step }) => {
        const { sessionId, agentId, theme, batchIndex, batchSize } = event.data;

        console.log(
            `[Simulation] Starting batch ${batchIndex} (${batchSize} convos) for session ${sessionId}`
        );

        // Step 1: Resolve agents (validate they exist before starting batch)
        await step.run("resolve-agents", async () => {
            const { agentResolver } = await import("@repo/mastra");

            const [simulatorResult, targetResult] = await Promise.all([
                agentResolver.resolve({ slug: "simulator" }),
                agentResolver.resolve({ id: agentId })
            ]);

            if (!targetResult.record) {
                throw new Error(`Target agent not found: ${agentId}`);
            }

            return {
                simulatorRecord: simulatorResult.record,
                targetRecord: targetResult.record
            };
        });

        // Run each conversation as a separate step for real-time progress
        let successCount = 0;
        let failedCount = 0;
        let totalDuration = 0;

        for (let i = 0; i < batchSize; i++) {
            const conversationIndex = batchIndex * 10 + i + 1;

            const result = await step.run(`conversation-${i}`, async () => {
                const { agentResolver } = await import("@repo/mastra");
                const { startRun } = await import("./run-recorder");

                // Re-resolve agents in each step (Inngest steps are isolated)
                const [simulatorResult, targetResult] = await Promise.all([
                    agentResolver.resolve({ slug: "simulator" }),
                    agentResolver.resolve({ id: agentId })
                ]);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const simulatorAgent = simulatorResult.agent as any;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const targetAgent = targetResult.agent as any;
                const targetRecord = targetResult.record;

                if (!targetRecord) {
                    throw new Error(`Target agent record not found: ${agentId}`);
                }

                try {
                    // Generate DIVERSE prompt using simulator agent with randomized persona/scenario
                    console.log(
                        `[Simulation] Conversation ${conversationIndex}: Generating diverse prompt...`
                    );
                    const diversePrompt = generateDiverseSimulatorPrompt(theme, conversationIndex);
                    const promptResult = await simulatorAgent.generate(diversePrompt, {
                        maxSteps: 1
                    });
                    const userPrompt = promptResult.text.trim();

                    if (!userPrompt) {
                        console.log(
                            `[Simulation] Conversation ${conversationIndex}: Empty prompt, skipping`
                        );
                        // Update failed count
                        await prisma.simulationSession.update({
                            where: { id: sessionId },
                            data: { failedCount: { increment: 1 } }
                        });
                        return { success: false, error: "Empty prompt" };
                    }

                    console.log(
                        `[Simulation] Conversation ${conversationIndex}: Prompt: "${userPrompt.substring(0, 50)}..."`
                    );

                    // Use run-recorder for FULL PIPELINE integration
                    // This creates AgentRun + AgentTrace and emits run/completed event
                    const runHandle = await startRun({
                        agentId,
                        agentSlug: targetRecord.slug,
                        input: userPrompt,
                        source: "simulation",
                        sessionId
                    });

                    try {
                        // Run through target agent
                        console.log(
                            `[Simulation] Conversation ${conversationIndex}: Running target agent...`
                        );
                        const response = await targetAgent.generate(userPrompt, {
                            maxSteps: targetRecord.maxSteps ?? 5
                        });

                        // Debug: Log the full response structure to find usage data
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const resp = response as any;
                        console.log(`[Simulation] Response keys: ${Object.keys(resp).join(", ")}`);
                        console.log(`[Simulation] response.usage: ${JSON.stringify(resp.usage)}`);
                        console.log(
                            `[Simulation] response.totalUsage: ${JSON.stringify(resp.totalUsage)}`
                        );
                        console.log(
                            `[Simulation] response.steps: ${resp.steps?.length || 0} steps`
                        );

                        // Use centralized utility to extract token usage
                        const { extractTokenUsage } = await import("./run-recorder");
                        const tokenUsage = extractTokenUsage(resp);

                        const promptTokens = tokenUsage?.promptTokens || 0;
                        const completionTokens = tokenUsage?.completionTokens || 0;
                        const totalTokens = tokenUsage?.totalTokens || 0;

                        console.log(
                            `[Simulation] Extracted tokens - prompt: ${promptTokens}, completion: ${completionTokens}, total: ${totalTokens}`
                        );

                        // Calculate cost using cost calculator
                        const { calculateCost } = await import("@/lib/cost-calculator");
                        const costUsd = calculateCost(
                            targetRecord.modelName,
                            targetRecord.modelProvider,
                            promptTokens,
                            completionTokens
                        );

                        console.log(
                            `[Simulation] Conversation ${conversationIndex}: Tokens: ${totalTokens} (${promptTokens} prompt + ${completionTokens} completion), Cost: $${costUsd.toFixed(6)}`
                        );

                        // Complete the run - this emits run/completed event for evaluations/learning
                        await runHandle.complete({
                            output: response.text,
                            modelProvider: targetRecord.modelProvider,
                            modelName: targetRecord.modelName,
                            promptTokens,
                            completionTokens,
                            costUsd
                        });

                        // Update session progress
                        await prisma.simulationSession.update({
                            where: { id: sessionId },
                            data: { completedCount: { increment: 1 } }
                        });

                        const qualityScore = calculateSimpleQualityScore(userPrompt, response.text);
                        console.log(
                            `[Simulation] Conversation ${conversationIndex}: Completed! Run: ${runHandle.runId}, Quality: ${(qualityScore * 100).toFixed(0)}%`
                        );

                        return {
                            success: true,
                            durationMs: Date.now() - Date.now(), // Will be calculated by run-recorder
                            qualityScore,
                            runId: runHandle.runId
                        };
                    } catch (agentError) {
                        // Agent execution failed - mark run as failed
                        await runHandle.fail(
                            agentError instanceof Error ? agentError : String(agentError)
                        );

                        await prisma.simulationSession.update({
                            where: { id: sessionId },
                            data: { failedCount: { increment: 1 } }
                        });

                        console.error(
                            `[Simulation] Conversation ${conversationIndex}: Agent failed:`,
                            agentError
                        );

                        return {
                            success: false,
                            error: agentError instanceof Error ? agentError.message : "Agent error"
                        };
                    }
                } catch (error) {
                    console.error(`[Simulation] Conversation ${conversationIndex} failed:`, error);

                    await prisma.simulationSession.update({
                        where: { id: sessionId },
                        data: { failedCount: { increment: 1 } }
                    });

                    return {
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error"
                    };
                }
            });

            if (result.success && "durationMs" in result) {
                successCount++;
                totalDuration += result.durationMs || 0;
            } else {
                failedCount++;
            }
        }

        // Check if session is complete
        await step.run("check-completion", async () => {
            const session = await prisma.simulationSession.findUnique({
                where: { id: sessionId }
            });

            if (!session) return;

            const totalProcessed = session.completedCount + session.failedCount;
            console.log(
                `[Simulation] Batch ${batchIndex} done. Session progress: ${totalProcessed}/${session.targetCount}`
            );

            if (totalProcessed >= session.targetCount) {
                // Calculate final aggregates
                const runs = await prisma.agentRun.findMany({
                    where: {
                        source: "simulation",
                        sessionId
                    },
                    select: {
                        durationMs: true,
                        status: true
                    }
                });

                const completedRuns = runs.filter((r) => r.status === "COMPLETED");
                const avgDuration =
                    completedRuns.reduce((sum, r) => sum + (r.durationMs || 0), 0) /
                        completedRuns.length || 0;
                const successRate = completedRuns.length / runs.length;

                await prisma.simulationSession.update({
                    where: { id: sessionId },
                    data: {
                        status: "COMPLETED",
                        completedAt: new Date(),
                        avgDurationMs: avgDuration,
                        successRate
                    }
                });

                console.log(
                    `[Simulation] Session ${sessionId} COMPLETED! Success rate: ${(successRate * 100).toFixed(0)}%, Avg duration: ${avgDuration.toFixed(0)}ms`
                );
            }
        });

        return {
            sessionId,
            batchIndex,
            successCount,
            failedCount,
            avgDuration: successCount > 0 ? totalDuration / successCount : 0
        };
    }
);

/**
 * Generate a diverse simulation prompt with randomized persona/scenario/mood
 * This forces the simulator to generate varied questions instead of repetitive ones
 */
function generateDiverseSimulatorPrompt(theme: string, conversationIndex: number): string {
    // Personas - who is asking
    const personas = [
        "a brand new user who just signed up",
        "a frustrated long-time customer",
        "a power user who knows the system well",
        "a confused user who doesn't understand the basics",
        "an executive who needs a quick answer",
        "a tech-savvy developer",
        "someone who's in a hurry",
        "a detail-oriented person who wants specifics",
        "an angry customer who had a bad experience",
        "a curious user exploring features",
        "someone who speaks English as a second language",
        "a manager asking on behalf of their team"
    ];

    // Scenario types - what kind of interaction
    const scenarios = [
        "asking a simple question",
        "reporting a problem or bug",
        "requesting help with a task",
        "expressing confusion about something",
        "complaining about an issue",
        "asking for step-by-step instructions",
        "comparing options or asking for recommendations",
        "following up on a previous issue",
        "asking about best practices",
        "requesting a feature or workaround",
        "clarifying something they read in docs",
        "asking about edge cases or limitations"
    ];

    // Communication styles
    const styles = [
        "very brief and to the point",
        "detailed with lots of context",
        "casual and friendly",
        "formal and professional",
        "slightly frustrated but polite",
        "enthusiastic and positive",
        "uncertain and asking for confirmation",
        "direct and demanding"
    ];

    // Pick random elements using the conversation index as a seed
    const persona = personas[conversationIndex % personas.length];
    const scenario = scenarios[Math.floor(conversationIndex / personas.length) % scenarios.length];
    const style = styles[Math.floor(conversationIndex * 7) % styles.length];

    return `Generate a UNIQUE user message for testing. Be creative and avoid repetition.

THEME: ${theme}

For this specific message (#${conversationIndex}), generate as:
- PERSONA: ${persona}
- SCENARIO: ${scenario}  
- STYLE: ${style}

IMPORTANT: Make this message COMPLETELY DIFFERENT from typical questions. Don't start with "Hi there!" or common greetings. Be creative with the phrasing, problem, and details.

Return ONLY the user message text, nothing else.`;
}

/**
 * Calculate a simple quality score based on response characteristics
 */
function calculateSimpleQualityScore(input: string, output: string): number {
    let score = 0.5; // Start at baseline

    // Length check - response should be substantial but not too long
    const outputLength = output.length;
    if (outputLength > 50 && outputLength < 2000) {
        score += 0.15;
    } else if (outputLength > 20) {
        score += 0.05;
    }

    // Relevancy - check for word overlap
    const inputWords = new Set(
        input
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3)
    );
    const outputWords = output
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
    const overlap = outputWords.filter((w) => inputWords.has(w)).length;
    if (overlap > 0) {
        score += Math.min(0.2, overlap * 0.05);
    }

    // Completeness - check for sentence structure
    if (output.includes(".") || output.includes("!") || output.includes("?")) {
        score += 0.1;
    }

    // Cap at 1.0
    return Math.min(1.0, score);
}

/**
 * Build a human-readable summary of signals for LLM consumption
 */
function buildSignalsSummary(signals: InsightSignals): string {
    const lines: string[] = [];

    lines.push(`Total evaluations: ${signals.totalEvaluations}`);
    lines.push(
        `Low score runs (avg < 0.5): ${signals.lowScoreCount} (${Math.round((signals.lowScoreCount / signals.totalEvaluations) * 100)}%)`
    );
    lines.push("");

    lines.push("Average scores by category:");
    for (const [scorer, avg] of Object.entries(signals.avgScoreByScorer)) {
        lines.push(`  - ${scorer}: ${(avg * 100).toFixed(1)}%`);
    }
    lines.push("");

    if (Object.keys(signals.scoreTrends).length > 0) {
        lines.push("Score trends (last 7 days vs previous 7 days):");
        for (const [scorer, trend] of Object.entries(signals.scoreTrends)) {
            const direction = trend.change > 0 ? "↑" : trend.change < 0 ? "↓" : "→";
            const changePercent = (trend.change * 100).toFixed(1);
            lines.push(
                `  - ${scorer}: ${(trend.current * 100).toFixed(1)}% ${direction} (${trend.change > 0 ? "+" : ""}${changePercent}% change)`
            );
        }
        lines.push("");
    }

    lines.push(
        `Feedback: ${signals.feedbackSummary.positive} positive, ${signals.feedbackSummary.negative} negative`
    );
    lines.push(`Total cost: $${signals.costTotal.toFixed(4)}`);
    lines.push(`Guardrail blocks: ${signals.guardrailHits}`);

    return lines.join("\n");
}

/**
 * Async Agent Invoke Handler
 *
 * Executes agent invocations that were queued for background processing.
 * Full observability via run recorder and event pipeline.
 */
export const asyncInvokeFunction = inngest.createFunction(
    {
        id: "agent-invoke-async",
        retries: 2,
        concurrency: {
            limit: 5
        }
    },
    { event: "agent/invoke.async" },
    async ({ event, step }) => {
        const { runId, agentId, agentSlug, input, context, maxSteps } = event.data;

        console.log(`[Inngest] Executing async invoke for run: ${runId}`);

        // Step 1: Update run status to RUNNING
        await step.run("update-status-running", async () => {
            await prisma.agentRun.update({
                where: { id: runId },
                data: { status: "RUNNING" }
            });
            await prisma.agentTrace.updateMany({
                where: { runId },
                data: { status: "RUNNING" }
            });
        });

        // Step 2: Resolve and execute agent
        const result = await step.run(
            "execute-agent",
            async (): Promise<{
                success: boolean;
                output?: string;
                error?: string;
                durationMs: number;
                promptTokens?: number;
                completionTokens?: number;
                totalTokens?: number;
                costUsd?: number;
                modelProvider?: string;
                modelName?: string;
                toolCalls?: Array<{
                    toolKey: string;
                    input: Record<string, unknown>;
                    output?: unknown;
                    success: boolean;
                    error?: string;
                    durationMs?: number;
                }>;
                executionSteps?: Array<{
                    step: number;
                    type: string;
                    content: string;
                    timestamp: string;
                }>;
            }> => {
                const { agentResolver } = await import("@repo/mastra");
                const { calculateCost } = await import("./cost-calculator");
                const { extractToolCalls } = await import("./run-recorder");

                const { agent, record } = await agentResolver.resolve({
                    slug: agentSlug,
                    requestContext: context
                });

                if (!record) {
                    throw new Error(`Agent '${agentSlug}' not found`);
                }

                const startTime = Date.now();

                try {
                    const response = await agent.generate(input, {
                        maxSteps: maxSteps ?? record.maxSteps ?? 5
                    });

                    const durationMs = Date.now() - startTime;

                    // Extract usage
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const usage = (response as any).usage || (response as any).totalUsage;
                    const promptTokens = usage?.inputTokens || usage?.promptTokens || 0;
                    const completionTokens = usage?.outputTokens || usage?.completionTokens || 0;
                    const totalTokens = promptTokens + completionTokens;

                    const costUsd = calculateCost(
                        record.modelName,
                        record.modelProvider,
                        promptTokens,
                        completionTokens
                    );

                    // Extract tool calls from the response
                    const rawToolCalls = extractToolCalls(response);

                    // Serialize tool calls for Inngest step data (must be JSON-safe)
                    const serializedToolCalls = rawToolCalls.map((tc) => {
                        let safeOutput: unknown;
                        if (tc.output !== undefined) {
                            try {
                                const outputStr = JSON.stringify(tc.output);
                                // Truncate large outputs to avoid Inngest step data limits
                                safeOutput =
                                    outputStr.length > 10000
                                        ? JSON.parse(outputStr.slice(0, 10000) + "...")
                                        : tc.output;
                            } catch {
                                safeOutput = String(tc.output).slice(0, 10000);
                            }
                        }
                        return {
                            toolKey: tc.toolKey || "unknown",
                            input: tc.input || {},
                            output: safeOutput,
                            success: tc.success ?? true,
                            error: tc.error,
                            durationMs: tc.durationMs
                        };
                    });

                    // Build execution steps for trace stepsJson
                    const executionSteps: Array<{
                        step: number;
                        type: string;
                        content: string;
                        timestamp: string;
                    }> = [];
                    let stepCounter = 0;

                    for (const tc of serializedToolCalls) {
                        stepCounter++;
                        executionSteps.push({
                            step: stepCounter,
                            type: "tool_call",
                            content: `Calling tool: ${tc.toolKey}\nArgs: ${JSON.stringify(tc.input, null, 2).slice(0, 500)}`,
                            timestamp: new Date().toISOString()
                        });

                        if (tc.output !== undefined || tc.error) {
                            stepCounter++;
                            const preview =
                                typeof tc.output === "string"
                                    ? tc.output.slice(0, 500)
                                    : JSON.stringify(tc.output ?? "").slice(0, 500);
                            executionSteps.push({
                                step: stepCounter,
                                type: "tool_result",
                                content: tc.error
                                    ? `Tool ${tc.toolKey} failed: ${tc.error}`
                                    : `Tool ${tc.toolKey} result:\n${preview}`,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }

                    // Add final response step
                    stepCounter++;
                    executionSteps.push({
                        step: stepCounter,
                        type: "response",
                        content:
                            (response.text || "").slice(0, 2000) +
                            (response.text && response.text.length > 2000 ? "..." : ""),
                        timestamp: new Date().toISOString()
                    });

                    return {
                        success: true,
                        output: response.text,
                        durationMs,
                        promptTokens,
                        completionTokens,
                        totalTokens,
                        costUsd,
                        modelProvider: record.modelProvider,
                        modelName: record.modelName,
                        toolCalls: serializedToolCalls,
                        executionSteps
                    };
                } catch (error) {
                    const durationMs = Date.now() - startTime;
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        durationMs
                    };
                }
            }
        );

        // Step 3: Update run with results
        await step.run("update-run-results", async () => {
            if (result.success && result.output) {
                await prisma.agentRun.update({
                    where: { id: runId },
                    data: {
                        status: "COMPLETED",
                        outputText: result.output,
                        durationMs: result.durationMs,
                        completedAt: new Date(),
                        modelProvider: result.modelProvider,
                        modelName: result.modelName,
                        promptTokens: result.promptTokens,
                        completionTokens: result.completionTokens,
                        totalTokens: result.totalTokens,
                        costUsd: result.costUsd
                    }
                });

                await prisma.agentTrace.updateMany({
                    where: { runId },
                    data: {
                        status: "COMPLETED",
                        outputText: result.output,
                        durationMs: result.durationMs,
                        tokensJson: {
                            prompt: result.promptTokens || 0,
                            completion: result.completionTokens || 0,
                            total: result.totalTokens || 0
                        }
                    }
                });
            } else {
                await prisma.agentRun.update({
                    where: { id: runId },
                    data: {
                        status: "FAILED",
                        outputText: `Error: ${result.error || "Unknown error"}`,
                        durationMs: result.durationMs,
                        completedAt: new Date()
                    }
                });

                await prisma.agentTrace.updateMany({
                    where: { runId },
                    data: {
                        status: "FAILED",
                        outputText: `Error: ${result.error || "Unknown error"}`,
                        durationMs: result.durationMs
                    }
                });
            }
        });

        // Step 3b: Record tool calls and execution steps in trace
        if (result.toolCalls && result.toolCalls.length > 0) {
            await step.run("record-tool-calls", async () => {
                const trace = await prisma.agentTrace.findFirst({
                    where: { runId },
                    select: { id: true }
                });

                if (!trace) {
                    console.warn(
                        `[Inngest] No trace found for run ${runId}, skipping tool call recording`
                    );
                    return;
                }

                // Record each tool call as an AgentToolCall record
                for (const tc of result.toolCalls!) {
                    await prisma.agentToolCall.create({
                        data: {
                            runId,
                            traceId: trace.id,
                            toolKey: tc.toolKey,
                            inputJson: (tc.input || {}) as Prisma.InputJsonValue,
                            outputJson:
                                tc.output !== undefined
                                    ? (tc.output as Prisma.InputJsonValue)
                                    : undefined,
                            success: tc.success,
                            error: tc.error,
                            durationMs: tc.durationMs
                        }
                    });
                }

                // Update trace with execution steps
                if (result.executionSteps && result.executionSteps.length > 0) {
                    await prisma.agentTrace.update({
                        where: { id: trace.id },
                        data: {
                            stepsJson:
                                result.executionSteps as unknown as Prisma.JsonArray
                        }
                    });
                }

                console.log(
                    `[Inngest] Recorded ${result.toolCalls!.length} tool calls for run ${runId}`
                );
            });
        }

        if (result.success && result.output && context?.slackUserId) {
            await step.run("send-slack-dm", async () => {
                try {
                    const { sendSlackDM } = await import("./slack");
                    const outputText =
                        typeof result.output === "string" ? result.output : String(result.output);
                    await sendSlackDM(String(context.slackUserId), outputText);
                } catch (error) {
                    console.error("[Inngest] Failed to send Slack DM:", error);
                }
            });
        }

        // Step 4: Trigger run/completed pipeline for cost tracking, evaluations, etc.
        if (result.success) {
            await step.sendEvent("trigger-run-completed", {
                name: "run/completed",
                data: {
                    runId,
                    agentId,
                    status: "COMPLETED",
                    durationMs: result.durationMs,
                    totalTokens: result.totalTokens || 0,
                    costUsd: result.costUsd || 0
                }
            });
        }

        return {
            runId,
            success: result.success,
            durationMs: result.durationMs
        };
    }
);

/**
 * Schedule Trigger Handler
 *
 * Cron job that checks for due schedules and triggers agent invocations.
 * Runs every minute to check for schedules that need to run.
 */
export const scheduleTriggerFunction = inngest.createFunction(
    {
        id: "schedule-trigger",
        retries: 2
    },
    { cron: "* * * * *" }, // Every minute
    async ({ step }) => {
        console.log("[Inngest] Checking for due schedules");

        // Step 1: Find schedules that are due
        const dueSchedules = await step.run("find-due-schedules", async () => {
            const now = new Date();
            return prisma.agentSchedule.findMany({
                where: {
                    isActive: true,
                    nextRunAt: { lte: now }
                },
                include: {
                    agent: {
                        select: {
                            id: true,
                            slug: true,
                            isActive: true
                        }
                    }
                },
                take: 50 // Process up to 50 schedules per minute
            });
        });

        if (dueSchedules.length === 0) {
            return { processed: 0 };
        }

        console.log(`[Inngest] Found ${dueSchedules.length} due schedules`);

        // Step 2: Process each schedule
        let processed = 0;
        for (const schedule of dueSchedules) {
            if (!schedule.agent.isActive) {
                continue;
            }

            await step.run(`process-schedule-${schedule.id}`, async () => {
                const now = new Date();
                let nextRunAt: Date;

                try {
                    nextRunAt = getNextRunAt(schedule.cronExpr, schedule.timezone || "UTC", now);
                } catch (error) {
                    console.error(
                        `[Inngest] Failed to calculate next run for schedule ${schedule.id}:`,
                        error
                    );
                    return;
                }

                const updateResult = await prisma.agentSchedule.updateMany({
                    where: {
                        id: schedule.id,
                        nextRunAt: schedule.nextRunAt ?? null
                    },
                    data: {
                        lastRunAt: now,
                        nextRunAt,
                        runCount: { increment: 1 }
                    }
                });

                if (updateResult.count === 0) {
                    return;
                }

                await inngest.send({
                    name: "agent/schedule.trigger",
                    data: {
                        scheduleId: schedule.id,
                        agentId: schedule.agent.id
                    }
                });

                processed++;
            });
        }

        return { processed, total: dueSchedules.length };
    }
);

/**
 * Schedule Trigger Event Handler
 *
 * Creates a run and queues async invocation for scheduled executions.
 */
export const agentScheduleTriggerFunction = inngest.createFunction(
    {
        id: "agent-schedule-trigger",
        retries: 2
    },
    { event: "agent/schedule.trigger" },
    async ({ event, step }) => {
        const { scheduleId } = event.data;

        const schedule = await step.run("load-schedule", async () => {
            return prisma.agentSchedule.findUnique({
                where: { id: scheduleId },
                include: {
                    agent: {
                        select: {
                            id: true,
                            slug: true,
                            isActive: true
                        }
                    }
                }
            });
        });

        if (!schedule || !schedule.isActive || !schedule.agent.isActive) {
            return { skipped: true };
        }

        const inputJson = schedule.inputJson as Record<string, unknown> | null;
        const inputValue = inputJson?.input ?? `Scheduled run: ${schedule.name}`;
        const input =
            typeof inputValue === "string" ? inputValue : JSON.stringify(inputValue ?? {});
        const environment =
            typeof inputJson?.environment === "string" ? inputJson.environment : undefined;
        const context =
            inputJson?.context && typeof inputJson.context === "object"
                ? {
                      ...(inputJson.context as Record<string, unknown>),
                      scheduleId: schedule.id,
                      scheduleName: schedule.name,
                      ...(environment ? { environment } : {})
                  }
                : {
                      scheduleId: schedule.id,
                      scheduleName: schedule.name,
                      ...(environment ? { environment } : {})
                  };
        const maxSteps = typeof inputJson?.maxSteps === "number" ? inputJson.maxSteps : undefined;

        // Gmail watch refresh is a special short-circuit path that doesn't need async invoke
        if (inputJson?.task === "gmail_watch_refresh" && inputJson?.integrationId) {
            const gmailResult = await step.run("gmail-watch-refresh", async () => {
                const { startRun } = await import("./run-recorder");
                const { createTriggerEventRecord } = await import("./trigger-events");

                const handle = await startRun({
                    agentId: schedule.agent.id,
                    agentSlug: schedule.agent.slug,
                    input,
                    source: "api",
                    triggerType: RunTriggerType.SCHEDULED,
                    triggerId: schedule.id,
                    metadata: {
                        scheduleId: schedule.id,
                        scheduleName: schedule.name
                    },
                    initialStatus: RunStatus.QUEUED
                });

                try {
                    await createTriggerEventRecord({
                        agentId: schedule.agent.id,
                        workspaceId: schedule.workspaceId || null,
                        runId: handle.runId,
                        sourceType: "schedule",
                        triggerType: "schedule",
                        entityType: "agent",
                        eventName: `schedule.${schedule.name}`,
                        payload: { input, cronExpr: schedule.cronExpr },
                        metadata: {
                            scheduleId: schedule.id,
                            scheduleName: schedule.name,
                            cronExpr: schedule.cronExpr
                        }
                    });
                } catch (e) {
                    console.warn("[Schedule Trigger] Failed to record trigger event:", e);
                }

                const integration = await prisma.gmailIntegration.findUnique({
                    where: { id: String(inputJson.integrationId) },
                    include: {
                        workspace: { select: { organizationId: true } }
                    }
                });

                if (!integration?.workspace?.organizationId) {
                    await handle.complete({
                        output: "Gmail watch refresh skipped: integration not found"
                    });
                    return { runId: handle.runId, refreshed: false };
                }

                const topicName = process.env.GMAIL_PUBSUB_TOPIC;
                if (!topicName) {
                    await handle.complete({
                        output: "Gmail watch refresh failed: missing GMAIL_PUBSUB_TOPIC"
                    });
                    return { runId: handle.runId, refreshed: false };
                }

                const gmail = await getGmailClient(
                    integration.workspace.organizationId,
                    integration.gmailAddress
                );
                const watchResult = await watchMailbox(gmail, topicName);

                await prisma.gmailIntegration.update({
                    where: { id: integration.id },
                    data: {
                        historyId: watchResult.historyId || integration.historyId,
                        watchExpiration: watchResult.expiration || integration.watchExpiration
                    }
                });

                await handle.complete({
                    output: `Refreshed Gmail watch for ${integration.gmailAddress}`
                });

                return { runId: handle.runId, refreshed: true };
            });

            return { runId: gmailResult.runId, refreshed: gmailResult.refreshed };
        }

        // Standard schedule path: create run + trigger event, then queue async invoke
        const runResult = await step.run("create-run", async () => {
            const { startRun } = await import("./run-recorder");
            const { createTriggerEventRecord } = await import("./trigger-events");

            const handle = await startRun({
                agentId: schedule.agent.id,
                agentSlug: schedule.agent.slug,
                input,
                source: "api",
                triggerType: RunTriggerType.SCHEDULED,
                triggerId: schedule.id,
                metadata: {
                    scheduleId: schedule.id,
                    scheduleName: schedule.name
                },
                initialStatus: RunStatus.QUEUED
            });

            // Record trigger event for unified triggers dashboard
            try {
                await createTriggerEventRecord({
                    agentId: schedule.agent.id,
                    workspaceId: schedule.workspaceId || null,
                    runId: handle.runId,
                    sourceType: "schedule",
                    triggerType: "schedule",
                    entityType: "agent",
                    eventName: `schedule.${schedule.name}`,
                    payload: { input, cronExpr: schedule.cronExpr },
                    metadata: {
                        scheduleId: schedule.id,
                        scheduleName: schedule.name,
                        cronExpr: schedule.cronExpr
                    }
                });
            } catch (e) {
                console.warn("[Schedule Trigger] Failed to record trigger event:", e);
            }

            return { runId: handle.runId };
        });

        await step.sendEvent("invoke-scheduled", {
            name: "agent/invoke.async",
            data: {
                runId: runResult.runId,
                agentId: schedule.agent.id,
                agentSlug: schedule.agent.slug,
                input,
                context,
                maxSteps
            }
        });

        return { runId: runResult.runId };
    }
);

/**
 * Gmail Message Processor
 *
 * Async worker that handles the heavy Gmail API work dispatched by the
 * thin webhook receiver at /api/gmail/webhook.
 *
 * Flow:
 *   1. Authenticate with Gmail API
 *   2. Fetch new message IDs via history.list (capped at 25)
 *   3. Fetch full messages with controlled concurrency (3 at a time)
 *   4. Enrich messages (sender domain, business hours, etc.)
 *   5. Write EmailThread / EmailMessage / CrmAuditLog records
 *   6. Create TriggerEvent records
 *   7. Fire agent/trigger.fire events to invoke the agent
 *
 * If history.list returns 404 (expired historyId), we skip gracefully —
 * the webhook already advanced the historyId so the next notification
 * will work from a fresh baseline.
 *
 * Inngest provides automatic retries with exponential backoff if any
 * transient errors occur (network, 5xx, quota).
 */
export const gmailMessageProcessFunction = inngest.createFunction(
    {
        id: "gmail-message-process",
        retries: 3,
        concurrency: {
            limit: 2, // At most 2 concurrent Gmail processing jobs
            key: "event.data.gmailAddress"
        }
    },
    { event: "gmail/message.process" },
    async ({ event, step }) => {
        const {
            integrationId,
            gmailAddress,
            organizationId,
            triggerId,
            agentId,
            workspaceId,
            slackUserId,
            previousHistoryId,
            newHistoryId
        } = event.data;

        // ── Step 1: Fetch message IDs from history ─────────────────────
        const messageIds = await step.run("list-history", async () => {
            const gmail = await getGmailClient(organizationId, gmailAddress);
            try {
                return await listHistory(gmail, previousHistoryId, 25);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                // historyId expired — skip gracefully. The webhook already
                // advanced the stored historyId, so next notification works.
                if (message.includes("Requested entity was not found") || message.includes("404")) {
                    console.warn(
                        `[Gmail Process] historyId ${previousHistoryId} expired for ${gmailAddress} — skipping`
                    );
                    return [] as string[];
                }
                throw err;
            }
        });

        if (messageIds.length === 0) {
            return { processed: 0, gmailAddress };
        }

        // ── Step 2: Fetch full messages with concurrency control ───────
        const messages = await step.run("fetch-messages", async () => {
            const gmail = await getGmailClient(organizationId, gmailAddress);
            return getMessagesWithConcurrency(gmail, messageIds, 3);
        });

        // ── Step 3: Find integration connection for email records ──────
        const connectionId = await step.run("resolve-connection", async () => {
            const gmailProvider = await prisma.integrationProvider.findUnique({
                where: { key: "gmail" }
            });
            if (!gmailProvider) return null;

            const connection = await prisma.integrationConnection.findFirst({
                where: {
                    providerId: gmailProvider.id,
                    organizationId,
                    credentials: {
                        path: ["gmailAddress"],
                        equals: gmailAddress
                    }
                }
            });

            // Link integration to connection if not already linked
            if (connection) {
                const integration = await prisma.gmailIntegration.findUnique({
                    where: { id: integrationId },
                    select: { integrationConnectionId: true }
                });
                if (!integration?.integrationConnectionId) {
                    await prisma.gmailIntegration.update({
                        where: { id: integrationId },
                        data: { integrationConnectionId: connection.id }
                    });
                }
            }

            return connection?.id || null;
        });

        // ── Step 4: Enrich messages and create trigger events ──────────
        const result = await step.run("enrich-and-trigger", async () => {
            const DEFAULT_BUSINESS_HOURS = { start: 9, end: 17, timezone: "UTC" };

            const getSenderDomain = (email?: string) => {
                if (!email) return null;
                const parts = email.split("@");
                if (parts.length !== 2) return null;
                return parts[1]?.toLowerCase() || null;
            };

            const isWithinBusinessHours = (
                date: Date,
                timezone: string,
                start: number,
                end: number
            ) => {
                const formatter = new Intl.DateTimeFormat("en-US", {
                    timeZone: timezone,
                    hour: "2-digit",
                    hour12: false
                });
                const hour = Number(formatter.format(date));
                return hour >= start && hour < end;
            };

            const organizationDomains = await prisma.organizationDomain.findMany({
                where: { organizationId },
                select: { domain: true }
            });
            const domainSet = new Set(
                organizationDomains.map((entry) => entry.domain.toLowerCase())
            );

            const { buildTriggerPayloadSnapshot } = await import("../lib/trigger-events");
            const { createTriggerEventRecord } = await import("../lib/trigger-events");
            const { resolveIdentity } = await import("../lib/identity");

            const triggerEventIds: string[] = [];

            for (const message of messages) {
                const senderEmail = message.parsedFrom[0];
                const senderDomain = getSenderDomain(senderEmail);
                const senderType = senderDomain
                    ? domainSet.has(senderDomain)
                        ? "internal"
                        : "external"
                    : "unknown";
                const receivedAt = message.internalDate
                    ? new Date(Number(message.internalDate))
                    : message.date
                      ? new Date(message.date)
                      : new Date();
                const inBusinessHours = isWithinBusinessHours(
                    receivedAt,
                    DEFAULT_BUSINESS_HOURS.timezone,
                    DEFAULT_BUSINESS_HOURS.start,
                    DEFAULT_BUSINESS_HOURS.end
                );
                const isForwarded = message.subject?.toLowerCase().startsWith("fwd:") || false;
                const isImportant = (message.labels || []).some((label: string) =>
                    ["IMPORTANT", "STARRED"].includes(label)
                );

                const payload = {
                    gmailAddress,
                    integrationConnectionId: connectionId,
                    threadId: message.threadId,
                    messageId: message.messageId,
                    from: message.from,
                    to: message.to,
                    cc: message.cc,
                    bcc: message.bcc,
                    parsedTo: message.parsedTo,
                    parsedCc: message.parsedCc,
                    parsedBcc: message.parsedBcc,
                    subject: message.subject,
                    snippet: message.snippet,
                    date: message.date,
                    labels: message.labels,
                    hasAttachments: message.hasAttachments,
                    attachments: message.attachments,
                    bodyText: message.bodyText,
                    bodyHtml: message.bodyHtml,
                    senderEmail,
                    senderDomain,
                    senderType,
                    isForwarded,
                    isImportant,
                    inBusinessHours,
                    receivedAt: receivedAt.toISOString(),
                    _slackUserId: slackUserId
                };

                // Create trigger event record
                const { normalizedPayload } = buildTriggerPayloadSnapshot(payload);
                const triggerEvent = await createTriggerEventRecord({
                    triggerId,
                    agentId,
                    workspaceId,
                    status: TriggerEventStatus.RECEIVED,
                    sourceType: "integration",
                    triggerType: "event",
                    entityType: "agent",
                    integrationKey: "gmail",
                    integrationId: connectionId || integrationId,
                    eventName: "gmail.message.received",
                    payload: normalizedPayload
                });

                triggerEventIds.push(triggerEvent?.id || "");

                // Write email records if we have a connection
                if (connectionId) {
                    const direction =
                        senderEmail && senderEmail.toLowerCase() === gmailAddress.toLowerCase()
                            ? "outbound"
                            : "inbound";

                    const thread = await prisma.emailThread.upsert({
                        where: {
                            integrationConnectionId_threadId: {
                                integrationConnectionId: connectionId,
                                threadId: message.threadId
                            }
                        },
                        create: {
                            organizationId,
                            workspaceId,
                            integrationConnectionId: connectionId,
                            threadId: message.threadId,
                            subject: message.subject || null,
                            participantsJson: {
                                from: message.parsedFrom,
                                to: message.parsedTo,
                                cc: message.parsedCc
                            },
                            lastMessageAt: receivedAt,
                            lastInboundAt: direction === "inbound" ? receivedAt : null,
                            lastOutboundAt: direction === "outbound" ? receivedAt : null
                        },
                        update: {
                            subject: message.subject || null,
                            lastMessageAt: receivedAt,
                            lastInboundAt: direction === "inbound" ? receivedAt : undefined,
                            lastOutboundAt: direction === "outbound" ? receivedAt : undefined
                        }
                    });

                    await prisma.emailMessage.upsert({
                        where: {
                            integrationConnectionId_messageId: {
                                integrationConnectionId: connectionId,
                                messageId: message.messageId
                            }
                        },
                        create: {
                            threadId: thread.id,
                            integrationConnectionId: connectionId,
                            messageId: message.messageId,
                            direction,
                            fromAddress: message.from || null,
                            toAddressesJson: message.parsedTo,
                            ccAddressesJson: message.parsedCc,
                            bccAddressesJson: message.parsedBcc,
                            subject: message.subject || null,
                            snippet: message.snippet || null,
                            bodyText: message.bodyText || null,
                            bodyHtml: message.bodyHtml || null,
                            receivedAt,
                            labelsJson: message.labels,
                            hasAttachments: message.hasAttachments,
                            attachmentsJson: message.attachments,
                            metadata: {
                                gmailThreadId: message.threadId,
                                gmailInternalDate: message.internalDate,
                                messageIdHeader: message.messageIdHeader
                            }
                        },
                        update: {}
                    });

                    await prisma.crmAuditLog.create({
                        data: {
                            organizationId,
                            workspaceId,
                            integrationConnectionId: connectionId,
                            eventType: "gmail.message.ingested",
                            recordType: "email_message",
                            recordId: message.messageId,
                            sourceType: "gmail",
                            sourceId: message.messageId,
                            payloadJson: {
                                threadId: thread.threadId,
                                subject: message.subject,
                                from: message.from,
                                to: message.to,
                                direction
                            }
                        }
                    });

                    if (senderEmail) {
                        await resolveIdentity({
                            organizationId,
                            email: senderEmail
                        });
                    }
                }

                // Fire agent trigger
                await inngest.send({
                    name: "agent/trigger.fire",
                    data: {
                        triggerId,
                        agentId,
                        triggerEventId: triggerEvent?.id,
                        payload
                    }
                });
            }

            return {
                processed: messages.length,
                triggerEventIds
            };
        });

        console.log(
            `[Gmail Process] Processed ${result.processed} messages for ${gmailAddress} ` +
                `(history ${previousHistoryId} → ${newHistoryId})`
        );

        return {
            processed: result.processed,
            gmailAddress,
            previousHistoryId,
            newHistoryId
        };
    }
);

/**
 * Gmail Follow-up Monitor
 *
 * Creates action items for email threads awaiting responses.
 */
export const gmailFollowUpFunction = inngest.createFunction(
    {
        id: "gmail-follow-up",
        retries: 1
    },
    { cron: "0 * * * *" }, // hourly
    async ({ step }) => {
        const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);

        const threads = await step.run("find-stale-threads", async () => {
            return prisma.emailThread.findMany({
                where: {
                    lastInboundAt: { lt: cutoff },
                    integrationConnectionId: { not: null }
                },
                orderBy: { lastInboundAt: "asc" },
                take: 50
            });
        });

        let created = 0;
        for (const thread of threads) {
            if (!thread.lastInboundAt) {
                continue;
            }
            if (thread.lastOutboundAt && thread.lastOutboundAt >= thread.lastInboundAt) {
                continue;
            }

            const existing = await prisma.actionItem.findFirst({
                where: {
                    sourceType: "email",
                    sourceId: thread.id,
                    status: "open"
                }
            });

            if (existing) {
                continue;
            }

            const action = await prisma.actionItem.create({
                data: {
                    organizationId: thread.organizationId,
                    workspaceId: thread.workspaceId,
                    sourceType: "email",
                    sourceId: thread.id,
                    title: "Follow up on email thread",
                    description: thread.subject || undefined,
                    metadata: {
                        threadId: thread.threadId,
                        lastInboundAt: thread.lastInboundAt
                    }
                }
            });

            await prisma.crmAuditLog.create({
                data: {
                    organizationId: thread.organizationId,
                    workspaceId: thread.workspaceId,
                    integrationConnectionId: thread.integrationConnectionId,
                    eventType: "gmail.follow_up",
                    recordType: "action_item",
                    recordId: action.id,
                    sourceType: "gmail",
                    sourceId: thread.threadId,
                    payloadJson: {
                        threadId: thread.threadId,
                        lastInboundAt: thread.lastInboundAt,
                        subject: thread.subject
                    }
                }
            });

            created += 1;
        }

        return { created, scanned: threads.length };
    }
);

/**
 * Agent Trigger Event Handler
 *
 * Handles webhook and event triggers.
 */
export const agentTriggerFireFunction = inngest.createFunction(
    {
        id: "agent-trigger-fire",
        retries: 2
    },
    { event: "agent/trigger.fire" },
    async ({ event, step }) => {
        const { triggerId, payload, triggerEventId } = event.data as {
            triggerId: string;
            payload: unknown;
            triggerEventId?: string;
        };

        const trigger = await step.run("load-trigger", async () => {
            return prisma.agentTrigger.findUnique({
                where: { id: triggerId },
                include: {
                    agent: {
                        select: {
                            id: true,
                            slug: true,
                            isActive: true
                        }
                    }
                }
            });
        });

        if (!trigger || !trigger.isActive || !trigger.agent.isActive) {
            if (triggerEventId) {
                await step.run("mark-trigger-skipped", async () => {
                    await updateTriggerEventRecord(triggerEventId, {
                        status: TriggerEventStatus.SKIPPED,
                        errorMessage: "Trigger or agent is disabled"
                    });
                });
            }
            return { skipped: true };
        }

        const payloadObj =
            payload && typeof payload === "object" && !Array.isArray(payload)
                ? payload
                : { value: payload };
        const slackUserId =
            typeof (payloadObj as { _slackUserId?: string })._slackUserId === "string"
                ? (payloadObj as { _slackUserId: string })._slackUserId
                : typeof (payloadObj as { slackUserId?: string }).slackUserId === "string"
                  ? (payloadObj as { slackUserId: string }).slackUserId
                  : undefined;

        if (
            !matchesTriggerFilter(
                payloadObj as Record<string, unknown>,
                trigger.filterJson as Record<string, unknown> | null
            )
        ) {
            if (triggerEventId) {
                await step.run("mark-trigger-filtered", async () => {
                    await updateTriggerEventRecord(triggerEventId, {
                        status: TriggerEventStatus.FILTERED,
                        errorMessage: "Trigger filter did not match payload"
                    });
                });
            }
            return { matched: false };
        }

        const triggerInputMapping = extractTriggerInputMapping(trigger.inputMapping);
        const triggerConfig = extractTriggerConfig(triggerInputMapping);
        const inputDefaults = triggerConfig?.defaults;
        const input = resolveTriggerInput(
            payloadObj as Record<string, unknown>,
            triggerInputMapping as Record<string, string> | null,
            trigger.name
        );

        const environment = triggerConfig?.environment ?? inputDefaults?.environment ?? undefined;
        const maxSteps =
            typeof inputDefaults?.maxSteps === "number" ? inputDefaults.maxSteps : undefined;
        const contextDefaults =
            inputDefaults?.context && typeof inputDefaults.context === "object"
                ? (inputDefaults.context as Record<string, unknown>)
                : {};

        const runResult = await step.run("create-run", async () => {
            const { startRun } = await import("./run-recorder");
            const triggerType = resolveRunTriggerType(trigger.triggerType);
            const source = resolveRunSource(trigger.triggerType);

            const handle = await startRun({
                agentId: trigger.agent.id,
                agentSlug: trigger.agent.slug,
                input,
                source,
                triggerType,
                triggerId: trigger.id,
                metadata: {
                    triggerId: trigger.id,
                    triggerName: trigger.name,
                    triggerType: trigger.triggerType,
                    eventName: trigger.eventName
                },
                initialStatus: RunStatus.QUEUED
            });

            await prisma.agentTrigger.update({
                where: { id: trigger.id },
                data: {
                    lastTriggeredAt: new Date(),
                    triggerCount: { increment: 1 }
                }
            });

            return { runId: handle.runId };
        });

        if (triggerEventId) {
            await step.run("mark-trigger-queued", async () => {
                await updateTriggerEventRecord(triggerEventId, {
                    status: TriggerEventStatus.QUEUED,
                    run: {
                        connect: {
                            id: runResult.runId
                        }
                    }
                });
            });
        }

        await step.sendEvent("invoke-triggered", {
            name: "agent/invoke.async",
            data: {
                runId: runResult.runId,
                agentId: trigger.agent.id,
                agentSlug: trigger.agent.slug,
                input,
                context: {
                    ...contextDefaults,
                    triggerId: trigger.id,
                    triggerName: trigger.name,
                    triggerType: trigger.triggerType,
                    eventName: trigger.eventName,
                    payload: payloadObj,
                    slackUserId,
                    ...(environment ? { environment } : {})
                },
                maxSteps
            }
        });

        return { runId: runResult.runId };
    }
);

/**
 * Idle Conversation Finalizer
 *
 * Scheduled cron function that runs every 15 minutes to finalize
 * conversation runs that have been idle for > 30 minutes.
 * Safety net for cases where the frontend's sendBeacon on tab close fails.
 */
const idleConversationFinalizerFunction = inngest.createFunction(
    {
        id: "idle-conversation-finalizer",
        retries: 1
    },
    { cron: "*/15 * * * *" }, // Every 15 minutes
    async ({ step }) => {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        const idleRuns = await step.run("find-idle-runs", async () => {
            return prisma.agentRun.findMany({
                where: {
                    status: "RUNNING",
                    turnCount: { gt: 0 }, // Only conversation runs, not legacy
                    createdAt: { lt: thirtyMinutesAgo }
                },
                select: { id: true, agentId: true, turnCount: true }
            });
        });

        if (idleRuns.length === 0) {
            return { finalized: 0 };
        }

        let finalized = 0;
        for (const run of idleRuns) {
            await step.run(`finalize-${run.id}`, async () => {
                const { finalizeConversationRun } = await import("@/lib/run-recorder");
                const success = await finalizeConversationRun(run.id);
                if (success) finalized++;
                return success;
            });
        }

        console.log(
            `[IdleConversationFinalizer] Finalized ${finalized}/${idleRuns.length} idle conversation runs`
        );

        return { finalized, total: idleRuns.length };
    }
);

/**
 * Webhook Subscription Renewal
 *
 * Cron: every 12 hours. Finds Microsoft Graph subscriptions expiring
 * within 24 hours and renews them. Also cleans up error-heavy subscriptions.
 */
const webhookSubscriptionRenewalFunction = inngest.createFunction(
    {
        id: "webhook-subscription-renewal",
        retries: 2
    },
    { cron: "0 */12 * * *" },
    async ({ step }) => {
        const results = await step.run("renew-expiring-subscriptions", async () => {
            const renewalWindow = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const subscriptions = await prisma.webhookSubscription.findMany({
                where: {
                    isActive: true,
                    providerKey: { startsWith: "microsoft-" },
                    expiresAt: { lt: renewalWindow }
                },
                include: {
                    integrationConnection: { select: { id: true, isActive: true } }
                }
            });

            let renewed = 0;
            let failed = 0;

            for (const sub of subscriptions) {
                if (!sub.integrationConnection.isActive || !sub.externalSubscriptionId) {
                    continue;
                }

                try {
                    if (sub.providerKey === "microsoft-mail") {
                        const { renewMailSubscription } = await import("./outlook-mail");
                        await renewMailSubscription(
                            sub.integrationConnectionId,
                            sub.externalSubscriptionId
                        );
                    } else if (sub.providerKey === "microsoft-calendar") {
                        const { renewCalendarSubscription } = await import("./outlook-calendar");
                        await renewCalendarSubscription(
                            sub.integrationConnectionId,
                            sub.externalSubscriptionId
                        );
                    }
                    renewed++;
                } catch (error) {
                    failed++;
                    await prisma.webhookSubscription.update({
                        where: { id: sub.id },
                        data: {
                            errorCount: { increment: 1 },
                            errorMessage: error instanceof Error ? error.message : "Renewal failed"
                        }
                    });

                    // Disable after 3 consecutive failures
                    if (sub.errorCount >= 2) {
                        await prisma.webhookSubscription.update({
                            where: { id: sub.id },
                            data: { isActive: false }
                        });
                    }
                }
            }

            return { total: subscriptions.length, renewed, failed };
        });

        return results;
    }
);

/**
 * All Inngest functions to register
 */
export const inngestFunctions = [
    executeGoalFunction,
    retryGoalFunction,
    // Agent Workspace functions
    runCompletedFunction,
    evaluationCompletedFunction,
    guardrailEventFunction,
    budgetCheckFunction,
    // Agent Invocation
    asyncInvokeFunction,
    // Scheduler
    scheduleTriggerFunction,
    agentScheduleTriggerFunction,
    gmailMessageProcessFunction,
    gmailFollowUpFunction,
    agentTriggerFireFunction,
    // AI Insights generation
    generateInsightsFunction,
    // Closed-Loop Learning functions
    runEvaluationFunction,
    learningSignalDetectorFunction,
    scheduledLearningTriggerFunction, // Cron-triggered backstop
    learningSessionStartFunction,
    learningSignalExtractionFunction,
    learningProposalGenerationFunction,
    learningExperimentRunFunction,
    experimentEvaluationCheckerFunction, // Periodic experiment evaluation
    learningApprovalHandlerFunction,
    learningVersionPromotionFunction,
    dailyMetricsRollupFunction,
    // BIM functions
    bimIfcParseFunction,
    // Simulation functions
    simulationSessionStartFunction,
    simulationBatchRunFunction,
    // Conversation run finalization
    idleConversationFinalizerFunction,
    // Webhook subscription lifecycle
    webhookSubscriptionRenewalFunction
];
