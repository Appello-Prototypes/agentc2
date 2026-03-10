import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@repo/database";
import { prisma } from "@repo/database";
import { requireAuth, requirePulseAccess } from "@/lib/authz";
import { createDocumentRecord } from "@repo/agentc2/documents";
import { buildGodAgentInstructions, getGodAgentDefaults, getGodAgentToolIds } from "@repo/agentc2";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";
import { getNextRunAt } from "@/lib/schedule-utils";

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

async function createBoard(
    pulseId: string,
    organizationId: string,
    workspaceId: string,
    name: string,
    description: string,
    culturePrompt?: string
) {
    let slug = generateSlug(name);
    let suffix = 2;
    while (
        await prisma.communityBoard.findFirst({
            where: { slug, organizationId }
        })
    ) {
        slug = `${generateSlug(name)}-${suffix}`;
        suffix++;
    }

    return prisma.communityBoard.create({
        data: {
            slug,
            name,
            description,
            scope: "global",
            culturePrompt: culturePrompt ?? null,
            organizationId,
            workspaceId,
            pulseId
        }
    });
}

const EXPERIMENT_LOG_CULTURE_PROMPT = `This board is the experiment log for this Pulse. Every entry represents one experiment attempt. Entries are created via the pulse-log-experiment tool and have structured metadata in their settings field. When browsing: check settings.status to filter by keep/discard/crash. Do NOT post to this board manually -- use the pulse-log-experiment tool.`;

const TASKS_CULTURE_PROMPT = `This board tracks task assignments for Pulse members. Tasks are assigned by the God Agent and tracked via taskStatus (pending/in_progress/completed/blocked). Workers should update their task status after each run.`;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ pulseId: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const { userId, organizationId } = auth.context;

        const { pulseId } = await params;

        const access = await requirePulseAccess(pulseId, userId, organizationId);
        if (access.response) return access.response;

        const pulse = await prisma.pulse.findUnique({
            where: { id: pulseId },
            include: {
                boards: { select: { slug: true } },
                milestones: true,
                members: {
                    include: { agent: { select: { id: true, slug: true, name: true } } }
                }
            }
        });

        if (!pulse) {
            return NextResponse.json({ success: false, error: "Pulse not found" }, { status: 404 });
        }

        const workspaceId =
            pulse.workspaceId || (await getDefaultWorkspaceIdForUser(userId, organizationId)) || "";

        const existingBoardSlugs = new Set(pulse.boards.map((b) => b.slug));
        const createdBoards: Record<string, string> = {};

        if (!existingBoardSlugs.has("tasks")) {
            const board = await createBoard(
                pulseId,
                organizationId,
                workspaceId,
                "Tasks",
                "Task assignments and tracking for Pulse members",
                TASKS_CULTURE_PROMPT
            );
            createdBoards.tasks = board.id;
        }

        if (!existingBoardSlugs.has("experiment-log")) {
            const board = await createBoard(
                pulseId,
                organizationId,
                workspaceId,
                "Experiment Log",
                "Structured experiment results for all Pulse members",
                EXPERIMENT_LOG_CULTURE_PROMPT
            );
            createdBoards.experimentLog = board.id;
        }

        const documentsCreated: string[] = [];

        const stateSlug = `pulse-${pulse.slug}-state`;
        const existingState = await prisma.document.findFirst({
            where: { slug: stateSlug, organizationId }
        });
        if (!existingState) {
            const stateContent = [
                `# State of the Pulse: ${pulse.name}`,
                "",
                `## Goal`,
                pulse.goal,
                "",
                `## Score Function`,
                pulse.scoreFunction || "Not yet defined -- God Agent will establish measurement.",
                "",
                `## Score Direction`,
                pulse.scoreDirection === "lower" ? "Lower is better" : "Higher is better",
                "",
                `## Current Score`,
                pulse.currentScore != null ? String(pulse.currentScore) : "Not yet measured",
                "",
                `## Target Score`,
                pulse.targetScore != null ? String(pulse.targetScore) : "Not yet defined",
                "",
                `## Status`,
                "BOOTSTRAPPING -- Initial setup complete. Awaiting first God Agent run.",
                "",
                `## Members`,
                ...pulse.members.map(
                    (m) =>
                        `- ${m.agent?.name ?? "Unknown"} (${m.agent?.slug ?? m.agentId}) -- role: ${m.role}`
                ),
                "",
                `## Milestones`,
                ...(pulse.milestones.length > 0
                    ? pulse.milestones.map(
                          (m) =>
                              `- [${m.status}] ${m.title}${m.targetMetric ? ` (target: ${m.targetValue} ${m.targetMetric})` : ""}`
                      )
                    : ["No milestones defined yet."]),
                "",
                `## What's Working`,
                "N/A -- just bootstrapped.",
                "",
                `## What's Next`,
                "God Agent's first run will: read this state, decompose the goal into milestones (if needed), create/assign tasks, and take the first score measurement.",
                ""
            ].join("\n");

            await createDocumentRecord({
                slug: stateSlug,
                name: `State of the Pulse: ${pulse.name}`,
                description: `Living status document for Pulse "${pulse.name}". Updated by the God Agent each run.`,
                content: stateContent,
                contentType: "markdown",
                category: "pulse",
                tags: ["pulse", pulse.slug, "state-of-the-pulse"],
                metadata: { pulseId, pulseSlug: pulse.slug, documentType: "state-of-the-pulse" },
                workspaceId,
                organizationId,
                createdBy: userId
            });
            documentsCreated.push(stateSlug);
        }

        const constraintSlug = `pulse-${pulse.slug}-constraints`;
        const existingConstraints = await prisma.document.findFirst({
            where: { slug: constraintSlug, organizationId }
        });
        if (!existingConstraints) {
            const constraintContent = [
                `# Constraint Library: ${pulse.name}`,
                "",
                "This document contains distilled rules learned from rejected experiments and failed approaches.",
                "The God Agent maintains this library. Workers MUST read it before every experiment.",
                "",
                "## Format",
                "Each constraint follows: NEVER [action] BECAUSE [reason learned from failure]",
                "",
                "## Active Constraints",
                "",
                "_No constraints yet. The God Agent will add constraints as patterns emerge from the experiment log._",
                "",
                "## Constraint Cap",
                "Maximum 50 active constraints. When approaching the cap, the God Agent should:",
                "1. Merge overlapping constraints",
                "2. Promote mature constraints to agent instructions or skills",
                "3. Archive constraints that are no longer relevant",
                ""
            ].join("\n");

            await createDocumentRecord({
                slug: constraintSlug,
                name: `Constraint Library: ${pulse.name}`,
                description: `Living constraint library for Pulse "${pulse.name}". Contains distilled rejection patterns. Updated by the God Agent.`,
                content: constraintContent,
                contentType: "markdown",
                category: "pulse",
                tags: ["pulse", pulse.slug, "constraint-library"],
                metadata: {
                    pulseId,
                    pulseSlug: pulse.slug,
                    documentType: "constraint-library",
                    constraintCount: 0
                },
                workspaceId,
                organizationId,
                createdBy: userId
            });
            documentsCreated.push(constraintSlug);
        }

        if (createdBoards.experimentLog) {
            await prisma.communityPost.create({
                data: {
                    boardId: createdBoards.experimentLog,
                    title: "Baseline",
                    content: `Pulse "${pulse.name}" bootstrapped. Goal: ${pulse.goal}. This is the baseline entry.`,
                    authorType: "human",
                    authorUserId: userId,
                    category: "experiment",
                    settings: {
                        experimentLog: true,
                        agentSlug: "system",
                        scoreDelta: 0,
                        status: "keep",
                        hypothesis: "Baseline measurement",
                        result: "Pulse bootstrapped and ready for first God Agent run."
                    }
                }
            });
        }

        const tasksBoard =
            createdBoards.tasks ||
            (
                await prisma.communityBoard.findFirst({
                    where: { pulseId, slug: "tasks" },
                    select: { id: true }
                })
            )?.id;

        if (tasksBoard) {
            await prisma.communityPost.create({
                data: {
                    boardId: tasksBoard,
                    title: "Mission Briefing",
                    content: [
                        `# Mission: ${pulse.name}`,
                        "",
                        `## Goal`,
                        pulse.goal,
                        "",
                        `## Score Function`,
                        pulse.scoreFunction || "To be defined by the God Agent.",
                        "",
                        `## Key Documents`,
                        `- State of the Pulse: \`${stateSlug}\``,
                        `- Constraint Library: \`${constraintSlug}\``,
                        "",
                        `## Rules of Engagement`,
                        "1. READ the Constraint Library before every experiment",
                        "2. LOG every experiment (keep, discard, or crash) via pulse-log-experiment",
                        "3. USE EVERY STEP -- do not stop early, do not yield steps back",
                        "4. One experiment per run -- measure, log, move on",
                        ""
                    ].join("\n"),
                    authorType: "human",
                    authorUserId: userId,
                    category: "mission",
                    isPinned: true
                }
            });
        }

        let initialScore: number | null = null;
        if (pulse.scoreFunctionType === "milestone_completion") {
            const total = pulse.milestones.length;
            const completed = pulse.milestones.filter((m) => m.status === "completed").length;
            initialScore = total > 0 ? Math.round((completed / total) * 100) : 0;
        } else if (pulse.scoreFunctionType === "task_completion") {
            initialScore = 0;
        } else if (pulse.scoreFunctionType === "community_activity") {
            initialScore = 0;
        }

        const existingSettings = (pulse.settings as Record<string, unknown>) ?? {};
        const godAgentConfig = existingSettings.godAgentConfig as
            | Record<string, unknown>
            | undefined;

        let godAgentId: string | null = null;
        let godAgentSlug: string | null = null;

        if (godAgentConfig?.enabled) {
            const existingGodMember = pulse.members.find((m) => m.role === "god");

            if (!existingGodMember) {
                const defaults = getGodAgentDefaults({
                    modelName: (godAgentConfig.model as string) ?? undefined,
                    cronExpr: (godAgentConfig.cronExpr as string) ?? undefined,
                    maxSteps: (godAgentConfig.maxSteps as number) ?? undefined
                });

                const milestonesStr =
                    pulse.milestones.length > 0
                        ? pulse.milestones
                              .map(
                                  (m) =>
                                      `- [${m.status}] ${m.title}${m.targetMetric ? ` (target: ${m.targetValue} ${m.targetMetric})` : ""}`
                              )
                              .join("\n")
                        : "None yet -- create milestones during your first run";

                const agentListStr =
                    pulse.members.length > 0
                        ? pulse.members
                              .map(
                                  (m) =>
                                      `- ${m.agent?.name ?? "Unknown"} (${m.agent?.slug ?? m.agentId})`
                              )
                              .join("\n")
                        : "None yet -- create worker agents during your first run";

                const instructions = buildGodAgentInstructions({
                    pulseId,
                    pulseName: pulse.name,
                    pulseGoal: pulse.goal,
                    workspaceId,
                    organizationId,
                    scoreFunction: pulse.scoreFunction,
                    scoreFunctionType: pulse.scoreFunctionType,
                    scoreDirection: pulse.scoreDirection,
                    currentScore: pulse.currentScore,
                    targetScore: pulse.targetScore,
                    milestones: milestonesStr,
                    agentList: agentListStr,
                    constraintLibraryDocId: constraintSlug
                });

                const agentSlugBase = `${pulse.slug}-god`;
                let agentSlugCandidate = agentSlugBase;
                let slugSuffix = 2;
                while (
                    await prisma.agent.findFirst({
                        where: { slug: agentSlugCandidate, workspaceId }
                    })
                ) {
                    agentSlugCandidate = `${agentSlugBase}-${slugSuffix}`;
                    slugSuffix++;
                }

                const agent = await prisma.agent.create({
                    data: {
                        slug: agentSlugCandidate,
                        name: `${pulse.name} God Agent`,
                        description: `Autonomous orchestrator for Pulse "${pulse.name}". Runs the READ → ORCHESTRATE → REVIEW → LEARN loop.`,
                        instructions,
                        modelProvider: defaults.modelProvider,
                        modelName: defaults.modelName,
                        temperature: defaults.temperature,
                        maxSteps: defaults.maxSteps,
                        memoryEnabled: defaults.memoryEnabled,
                        memoryConfig: defaults.memoryConfig as Prisma.InputJsonValue,
                        metadata: defaults.metadata as Prisma.InputJsonValue,
                        type: "USER",
                        workspaceId,
                        visibility: "ORGANIZATION",
                        isActive: true
                    }
                });

                godAgentId = agent.id;
                godAgentSlug = agent.slug;

                const toolIds = getGodAgentToolIds();
                if (toolIds.length > 0) {
                    await prisma.agentTool.createMany({
                        data: toolIds.map((toolId) => ({
                            agentId: agent.id,
                            toolId
                        })),
                        skipDuplicates: true
                    });
                }

                await prisma.pulseMember.create({
                    data: {
                        pulseId,
                        agentId: agent.id,
                        role: "god"
                    }
                });

                const cronExpr = defaults.cronExpr;
                const nextRunAt = getNextRunAt(cronExpr, "UTC", new Date());

                await prisma.agentSchedule.create({
                    data: {
                        agentId: agent.id,
                        workspaceId,
                        name: `${pulse.name} God Agent Loop`,
                        description: `Every 2 hours: READ → ORCHESTRATE → REVIEW → LEARN for Pulse "${pulse.name}"`,
                        cronExpr,
                        timezone: "UTC",
                        inputJson: {
                            maxSteps: defaults.maxSteps,
                            context: `You are orchestrating Pulse "${pulse.name}". Goal: ${pulse.goal}. Read your instructions carefully and execute all 4 steps.`
                        },
                        isActive: true,
                        nextRunAt,
                        healthPolicyEnabled: defaults.healthPolicyEnabled,
                        healthThreshold: defaults.healthThreshold,
                        healthWindow: defaults.healthWindow,
                        healthAction: defaults.healthAction
                    }
                });

                const pulseBoards = await prisma.communityBoard.findMany({
                    where: { pulseId },
                    select: { id: true }
                });
                if (pulseBoards.length > 0) {
                    await prisma.communityMember.createMany({
                        data: pulseBoards.map((b) => ({
                            boardId: b.id,
                            memberType: "agent",
                            agentId: agent.id
                        })),
                        skipDuplicates: true
                    });
                }
            } else {
                godAgentId = existingGodMember.agentId;
                godAgentSlug = existingGodMember.agent?.slug ?? null;
            }
        }

        await prisma.pulse.update({
            where: { id: pulseId },
            data: {
                ...(initialScore != null && {
                    currentScore: initialScore,
                    scoreHistory: [
                        {
                            timestamp: new Date().toISOString(),
                            score: initialScore,
                            source: "bootstrap"
                        }
                    ]
                }),
                settings: {
                    ...existingSettings,
                    bootstrappedAt: new Date().toISOString(),
                    bootstrappedBy: userId,
                    reviewConfig: existingSettings.reviewConfig ?? {
                        constraintReviewInterval: 10,
                        timeReviewDays: 7,
                        scoreCheckpoints: []
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            bootstrap: {
                boardsCreated: Object.keys(createdBoards),
                documentsCreated,
                initialScore,
                missionBriefingPosted: !!tasksBoard,
                godAgent: godAgentId ? { id: godAgentId, slug: godAgentSlug } : null
            }
        });
    } catch (error) {
        console.error("[pulse/bootstrap] POST error:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
