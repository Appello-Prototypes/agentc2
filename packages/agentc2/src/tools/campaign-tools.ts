import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    prisma,
    Prisma,
    MissionTaskType,
    MissionStatus,
    MissionTaskStatus,
    CampaignStatus
} from "@repo/database";

const baseOutputSchema = z.object({}).passthrough();

const getInternalBaseUrl = () =>
    process.env.MASTRA_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const buildHeaders = () => {
    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    const apiKey = process.env.MASTRA_API_KEY || process.env.MCP_API_KEY;
    if (apiKey) {
        headers["X-API-Key"] = apiKey;
    }
    const orgSlug = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
    if (orgSlug) {
        headers["X-Organization-Slug"] = orgSlug;
    }
    return headers;
};

const callInternalApi = async (
    path: string,
    options?: {
        method?: string;
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
    }
) => {
    const url = new URL(path, getInternalBaseUrl());
    if (options?.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const response = await fetch(url.toString(), {
        method: options?.method ?? "GET",
        headers: buildHeaders(),
        body: options?.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();
    if (!response.ok) {
        const errorMessage =
            (data && typeof data === "object" && "error" in data ? data.error : undefined) ||
            `Request failed (${response.status})`;
        throw new Error(String(errorMessage));
    }
    return data;
};

export const campaignCreateTool = createTool({
    id: "campaign-create",
    description:
        "Create a new campaign using Mission Command principles. Define WHAT to achieve (intent + end state), and the platform autonomously decomposes into missions, assigns agents, executes, and generates After Action Reviews.",
    inputSchema: z.object({
        name: z.string().describe("Campaign name"),
        intent: z
            .string()
            .describe(
                "Commander's intent: WHAT to achieve, not HOW. The platform determines the approach autonomously."
            ),
        endState: z
            .string()
            .describe(
                "Observable conditions that define success — what the world looks like when the campaign is done."
            ),
        description: z.string().optional().describe("Additional context or background"),
        constraints: z
            .array(z.string())
            .optional()
            .describe("Restrictions on HOW (must/must not rules)"),
        restraints: z.array(z.string()).optional().describe("Limitations on resources or approach"),
        requireApproval: z
            .boolean()
            .optional()
            .describe("If true, pauses for human approval before execution. Default: false."),
        maxCostUsd: z.number().optional().describe("Maximum cost budget in USD"),
        timeoutMinutes: z.number().optional().describe("Maximum execution time in minutes"),
        templateId: z.string().optional().describe("Create from a template by ID"),
        parameterValues: z
            .record(z.string())
            .optional()
            .describe(
                "Parameter values for template interpolation (e.g. { customerName: 'Acme' })"
            ),
        parentCampaignId: z
            .string()
            .optional()
            .describe("Parent campaign ID for sub-campaign hierarchy (max depth 3)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        name,
        intent,
        endState,
        description,
        constraints,
        restraints,
        requireApproval,
        maxCostUsd,
        timeoutMinutes,
        templateId,
        parameterValues,
        parentCampaignId
    }) => {
        return callInternalApi("/api/campaigns", {
            method: "POST",
            body: {
                name,
                intent,
                endState,
                description,
                constraints,
                restraints,
                requireApproval,
                maxCostUsd,
                timeoutMinutes,
                templateId,
                parameterValues,
                parentCampaignId
            }
        });
    }
});

export const campaignListTool = createTool({
    id: "campaign-list",
    description:
        "List all campaigns with optional status filter and pagination. Returns campaigns with their missions summary.",
    inputSchema: z.object({
        status: z
            .enum([
                "PLANNING",
                "ANALYZING",
                "READY",
                "EXECUTING",
                "REVIEWING",
                "COMPLETE",
                "FAILED",
                "PAUSED"
            ])
            .optional()
            .describe("Filter by campaign status"),
        limit: z.number().optional().describe("Max results per page (default: 50)"),
        offset: z.number().optional().describe("Pagination offset (default: 0)")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ status, limit, offset }) => {
        return callInternalApi("/api/campaigns", {
            query: { status, limit, offset }
        });
    }
});

export const campaignGetTool = createTool({
    id: "campaign-get",
    description:
        "Get full campaign details including missions, tasks, evaluations, After Action Reviews, and activity logs.",
    inputSchema: z.object({
        campaignId: z.string().describe("Campaign ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ campaignId }) => {
        return callInternalApi(`/api/campaigns/${campaignId}`);
    }
});

export const campaignUpdateTool = createTool({
    id: "campaign-update",
    description:
        "Update a campaign's configuration or perform lifecycle actions. Actions: 'approve' starts a READY campaign, 'cancel' stops a running campaign, 'resume' restarts a PAUSED campaign. Field updates only allowed in PLANNING or READY status.",
    inputSchema: z.object({
        campaignId: z.string().describe("Campaign ID"),
        action: z
            .enum(["approve", "cancel", "resume"])
            .optional()
            .describe("Lifecycle action to perform"),
        name: z.string().optional().describe("Update campaign name"),
        intent: z.string().optional().describe("Update intent"),
        endState: z.string().optional().describe("Update end state"),
        description: z.string().optional().describe("Update description"),
        constraints: z.array(z.string()).optional().describe("Update constraints"),
        restraints: z.array(z.string()).optional().describe("Update restraints"),
        requireApproval: z.boolean().optional().describe("Update approval requirement"),
        maxCostUsd: z.number().optional().describe("Update cost budget"),
        timeoutMinutes: z.number().optional().describe("Update timeout")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({
        campaignId,
        action,
        name,
        intent,
        endState,
        description,
        constraints,
        restraints,
        requireApproval,
        maxCostUsd,
        timeoutMinutes
    }) => {
        const body: Record<string, unknown> = {};
        if (action) body.action = action;
        if (name !== undefined) body.name = name;
        if (intent !== undefined) body.intent = intent;
        if (endState !== undefined) body.endState = endState;
        if (description !== undefined) body.description = description;
        if (constraints !== undefined) body.constraints = constraints;
        if (restraints !== undefined) body.restraints = restraints;
        if (requireApproval !== undefined) body.requireApproval = requireApproval;
        if (maxCostUsd !== undefined) body.maxCostUsd = maxCostUsd;
        if (timeoutMinutes !== undefined) body.timeoutMinutes = timeoutMinutes;

        return callInternalApi(`/api/campaigns/${campaignId}`, {
            method: "PATCH",
            body
        });
    }
});

export const campaignDeleteTool = createTool({
    id: "campaign-delete",
    description:
        "Delete a campaign and all related data (missions, tasks, logs). Cannot delete campaigns in EXECUTING status — cancel first.",
    inputSchema: z.object({
        campaignId: z.string().describe("Campaign ID")
    }),
    outputSchema: baseOutputSchema,
    execute: async ({ campaignId }) => {
        return callInternalApi(`/api/campaigns/${campaignId}`, {
            method: "DELETE"
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Campaign Write Tools — used by campaign system agents to persist structured data
// These use direct Prisma because they run server-side within Inngest agent invocations
// ═══════════════════════════════════════════════════════════════════════════════

const taskSchema = z.object({
    name: z.string().describe("Short task name"),
    taskType: z
        .enum(["ASSIGNED", "IMPLIED", "ESSENTIAL"])
        .describe(
            "ASSIGNED=directly stated, IMPLIED=necessary but unstated, ESSENTIAL=single most critical"
        ),
    taskVerb: z.string().describe("The specific action verb for this task"),
    sequence: z
        .number()
        .int()
        .min(0)
        .describe("Execution order within mission, 0 = can run in parallel"),
    coordinatingInstructions: z
        .string()
        .nullable()
        .optional()
        .describe("Dependencies, context, or instructions to pass to the executing agent")
});

const missionSchema = z.object({
    name: z.string().describe("Short mission name"),
    missionStatement: z.string().describe("Verb + 'in order to' + purpose format"),
    priority: z.number().int().min(0).max(10).describe("0=low, 10=critical"),
    sequence: z
        .number()
        .int()
        .min(0)
        .describe("Execution order, 0 = can run in parallel with others at sequence 0"),
    tasks: z.array(taskSchema).describe("Tasks within this mission")
});

export const campaignWriteMissionsTool = createTool({
    id: "campaign-write-missions",
    description:
        "Persist mission decomposition to the database for a campaign. Creates Mission and MissionTask records and stores the analysis output on the campaign. Call this after analyzing campaign intent.",
    inputSchema: z.object({
        campaignId: z.string().describe("Campaign ID to write missions for"),
        missions: z.array(missionSchema).describe("Array of missions with their tasks"),
        essentialTask: z
            .string()
            .describe("The single task name that defines overall campaign success")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        missionCount: z.number(),
        taskCount: z.number()
    }),
    execute: async ({ campaignId, missions, essentialTask }) => {
        let totalTasks = 0;

        for (const mission of missions) {
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
                            ? ({
                                  instructions: task.coordinatingInstructions
                              } as Prisma.InputJsonValue)
                            : undefined,
                        status: MissionTaskStatus.PENDING
                    }
                });
                totalTasks++;
            }
        }

        // Store analysis output on campaign
        const analysisOutput = { missions, essentialTask };
        await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                analysisOutput: analysisOutput as unknown as Prisma.InputJsonValue
            }
        });

        return { success: true, missionCount: missions.length, taskCount: totalTasks };
    }
});

const taskAssignmentSchema = z.object({
    taskName: z.string().describe("Name of the task to assign"),
    agentSlug: z.string().describe("Slug of the agent best suited for this task"),
    reasoning: z.string().describe("Why this agent was chosen"),
    instructions: z
        .string()
        .optional()
        .describe(
            "Task-specific execution instructions for the assigned agent. Include tool usage guidance, specific URLs to target, expected output format, etc."
        ),
    estimatedTokens: z.number().nullable().optional(),
    estimatedCostUsd: z.number().nullable().optional()
});

const missionAssignmentSchema = z.object({
    missionName: z.string().describe("Name of the mission"),
    tasks: z.array(taskAssignmentSchema)
});

const gapSchema = z.object({
    taskName: z.string(),
    missionName: z.string(),
    reason: z.string().describe("Why no existing agent is suitable"),
    requiredCapabilities: z.array(z.string()).describe("What capabilities are needed"),
    suggestedTools: z.array(z.string()).optional().describe("Tool IDs that would be needed")
});

export const campaignWritePlanTool = createTool({
    id: "campaign-write-plan",
    description:
        "Persist agent assignments and execution plan to the database. Updates each task with its assigned agent and stores the overall execution plan on the campaign. Also reports capability gaps if any tasks lack suitable agents.",
    inputSchema: z.object({
        campaignId: z.string().describe("Campaign ID"),
        assignments: z.array(missionAssignmentSchema).describe("Agent assignments per mission"),
        executionStrategy: z
            .string()
            .describe("Overall execution approach: sequential, parallel, or mixed"),
        estimatedTotalCostUsd: z.number(),
        estimatedDurationMinutes: z.number(),
        gapsDetected: z
            .array(gapSchema)
            .optional()
            .describe("Capability gaps where no suitable agent exists")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        assignedCount: z.number(),
        gapCount: z.number()
    }),
    execute: async ({
        campaignId,
        assignments,
        executionStrategy,
        estimatedTotalCostUsd,
        estimatedDurationMinutes,
        gapsDetected
    }) => {
        // Load campaign with missions and tasks
        const campaign = await prisma.campaign.findUniqueOrThrow({
            where: { id: campaignId },
            include: {
                missions: {
                    include: { tasks: true }
                }
            }
        });

        // Get available agents for slug -> id lookup
        const agents = await prisma.agent.findMany({
            where: { isActive: true },
            select: { id: true, slug: true }
        });

        let assignedCount = 0;

        for (const missionAssignment of assignments) {
            const mission = campaign.missions.find((m) => m.name === missionAssignment.missionName);
            if (!mission) continue;

            for (const taskAssignment of missionAssignment.tasks) {
                const task = mission.tasks.find((t) => t.name === taskAssignment.taskName);
                if (!task) continue;

                const agent = agents.find((a) => a.slug === taskAssignment.agentSlug);

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
                            plannerInstructions: taskAssignment.instructions,
                            estimatedTokens: taskAssignment.estimatedTokens,
                            estimatedCostUsd: taskAssignment.estimatedCostUsd
                        } as Prisma.InputJsonValue
                    }
                });
                assignedCount++;
            }
        }

        // Store execution plan
        const plan = {
            assignments,
            executionStrategy,
            estimatedTotalCostUsd,
            estimatedDurationMinutes,
            gapsDetected: gapsDetected || []
        };

        const hasGaps = gapsDetected && gapsDetected.length > 0;

        await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                executionPlan: plan as unknown as Prisma.InputJsonValue,
                status: hasGaps ? CampaignStatus.ANALYZING : CampaignStatus.READY
            }
        });

        return {
            success: true,
            assignedCount,
            gapCount: gapsDetected?.length || 0
        };
    }
});

export const campaignWriteAarTool = createTool({
    id: "campaign-write-aar",
    description:
        "Persist an After Action Review (AAR) to the database for a mission or campaign. The AAR contains sustain/improve patterns, scores, cost data, and a summary.",
    inputSchema: z.object({
        targetType: z
            .enum(["mission", "campaign"])
            .describe("Whether this AAR is for a mission or campaign"),
        targetId: z.string().describe("The ID of the mission or campaign"),
        aar: z
            .object({})
            .passthrough()
            .describe(
                "Structured AAR data. For missions: plannedTasks, completedTasks, failedTasks, skippedTasks, avgTaskScore, lowestScoringTask, totalCostUsd, totalTokens, durationMs, sustainPatterns, improvePatterns, summary. For campaigns: add intentAchieved, endStateReached, lessonsLearned."
            )
    }),
    outputSchema: z.object({
        success: z.boolean()
    }),
    execute: async ({ targetType, targetId, aar }) => {
        if (targetType === "mission") {
            const aarData = aar as Record<string, unknown>;
            const requiresRework = aarData.requiresRework === true;

            // Check if the mission supports rework iterations
            let canRework = false;
            if (requiresRework) {
                const mission = await prisma.mission.findUnique({
                    where: { id: targetId },
                    select: { maxIterations: true, currentIteration: true }
                });
                canRework = mission !== null && mission.currentIteration < mission.maxIterations;
            }

            if (requiresRework && canRework) {
                // Set to REWORK status — mission will be re-executed with feedback
                await prisma.mission.update({
                    where: { id: targetId },
                    data: {
                        aarJson: aarData as unknown as Prisma.InputJsonValue,
                        status: MissionStatus.REWORK,
                        reworkReason:
                            (aarData.reworkFeedback as string) ||
                            (aarData.summary as string) ||
                            "Review requires rework",
                        currentIteration: { increment: 1 }
                    }
                });
            } else {
                // Normal completion
                await prisma.mission.update({
                    where: { id: targetId },
                    data: {
                        aarJson: aarData as unknown as Prisma.InputJsonValue,
                        status: MissionStatus.COMPLETE
                    }
                });
            }

            // Handle escalation
            if (aarData.shouldEscalate === true) {
                console.warn(
                    `[Campaign AAR] Mission ${targetId} flagged for escalation: ${aarData.summary || "no summary"}`
                );
            }
        } else {
            // Campaign AAR
            const campaign = await prisma.campaign.findUniqueOrThrow({
                where: { id: targetId },
                include: { missions: true }
            });

            const allMissionsFailed = campaign.missions.every(
                (m) => m.status === MissionStatus.FAILED
            );

            await prisma.campaign.update({
                where: { id: targetId },
                data: {
                    aarJson: aar as unknown as Prisma.InputJsonValue,
                    status: allMissionsFailed ? CampaignStatus.FAILED : CampaignStatus.COMPLETE,
                    progress: 100,
                    completedAt: new Date()
                }
            });
        }

        return { success: true };
    }
});
