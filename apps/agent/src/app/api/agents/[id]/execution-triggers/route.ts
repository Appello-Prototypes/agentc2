import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@repo/database";
import { getNextRunAt } from "@/lib/schedule-utils";
import {
    UNIFIED_TRIGGER_TYPES,
    buildUnifiedTriggerId,
    extractScheduleDefaults,
    extractTriggerConfig,
    extractTriggerInputMapping,
    mergeTriggerInputMapping,
    validateTriggerInputMapping,
    type TriggerInputDefaults,
    type UnifiedTrigger,
    type UnifiedTriggerRunSummary
} from "@/lib/unified-triggers";

type TriggerRow = {
    id: string;
    name: string;
    description: string | null;
    triggerType: string;
    eventName: string | null;
    webhookPath: string | null;
    webhookSecret: string | null;
    filterJson: unknown;
    inputMapping: unknown;
    isActive: boolean;
    lastTriggeredAt: Date | null;
    triggerCount: number;
    createdAt: Date;
    updatedAt: Date;
};

type ScheduleRow = {
    id: string;
    name: string;
    description: string | null;
    cronExpr: string;
    timezone: string;
    inputJson: unknown;
    isActive: boolean;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    runCount: number;
    createdAt: Date;
    updatedAt: Date;
};

type RunRow = {
    id: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    durationMs: number | null;
    triggerId: string | null;
};

function buildLastRunMap(runs: RunRow[]) {
    const map = new Map<string, UnifiedTriggerRunSummary>();
    for (const run of runs) {
        if (!run.triggerId || map.has(run.triggerId)) {
            continue;
        }
        map.set(run.triggerId, {
            id: run.id,
            status: run.status,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            durationMs: run.durationMs
        });
    }
    return map;
}

function buildScheduleTrigger(
    schedule: ScheduleRow,
    lastRun?: UnifiedTriggerRunSummary | null
): UnifiedTrigger {
    const defaults = extractScheduleDefaults(schedule.inputJson);
    return {
        id: buildUnifiedTriggerId("schedule", schedule.id),
        sourceId: schedule.id,
        sourceType: "schedule",
        type: "scheduled",
        name: schedule.name,
        description: schedule.description,
        isActive: schedule.isActive,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
        config: {
            cronExpr: schedule.cronExpr,
            timezone: schedule.timezone,
            environment: defaults?.environment ?? null
        },
        inputDefaults: defaults,
        stats: {
            lastRunAt: schedule.lastRunAt,
            nextRunAt: schedule.nextRunAt,
            runCount: schedule.runCount
        },
        lastRun: lastRun ?? null
    };
}

function buildTriggerTrigger(
    trigger: TriggerRow,
    agentSlug: string,
    lastRun?: UnifiedTriggerRunSummary | null
): UnifiedTrigger {
    const inputMapping = extractTriggerInputMapping(trigger.inputMapping);
    const config = extractTriggerConfig(inputMapping);
    const defaults = config?.defaults ?? null;
    return {
        id: buildUnifiedTriggerId("trigger", trigger.id),
        sourceId: trigger.id,
        sourceType: "trigger",
        type: trigger.triggerType as UnifiedTrigger["type"],
        name: trigger.name,
        description: trigger.description,
        isActive: trigger.isActive,
        createdAt: trigger.createdAt,
        updatedAt: trigger.updatedAt,
        config: {
            eventName: trigger.eventName,
            webhookPath: trigger.webhookPath,
            hasWebhookSecret: Boolean(trigger.webhookSecret),
            toolName: trigger.triggerType === "mcp" ? `agent.${agentSlug}` : undefined,
            apiEndpoint:
                trigger.triggerType === "api"
                    ? `/api/agents/${agentSlug}/execution-triggers/${buildUnifiedTriggerId(
                          "trigger",
                          trigger.id
                      )}/execute`
                    : undefined,
            environment: config?.environment ?? defaults?.environment ?? null
        },
        inputDefaults: defaults,
        filter:
            trigger.filterJson && typeof trigger.filterJson === "object"
                ? (trigger.filterJson as Record<string, unknown>)
                : null,
        inputMapping,
        stats: {
            lastRunAt: trigger.lastTriggeredAt,
            triggerCount: trigger.triggerCount
        },
        lastRun: lastRun ?? null
    };
}

/**
 * GET /api/agents/[id]/execution-triggers
 *
 * Unified list of schedules + triggers for an agent.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            },
            select: {
                id: true,
                slug: true
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const [schedules, triggers] = await Promise.all([
            prisma.agentSchedule.findMany({
                where: { agentId: agent.id },
                orderBy: { createdAt: "desc" }
            }),
            prisma.agentTrigger.findMany({
                where: { agentId: agent.id },
                orderBy: { createdAt: "desc" }
            })
        ]);

        const triggerIds = [
            ...schedules.map((schedule) => schedule.id),
            ...triggers.map((trigger) => trigger.id)
        ];

        const recentRuns = await prisma.agentRun.findMany({
            where: {
                agentId: agent.id,
                triggerId: { in: triggerIds }
            },
            orderBy: { startedAt: "desc" },
            select: {
                id: true,
                status: true,
                startedAt: true,
                completedAt: true,
                durationMs: true,
                triggerId: true
            }
        });

        const lastRunMap = buildLastRunMap(recentRuns as RunRow[]);

        const unifiedTriggers: UnifiedTrigger[] = [
            ...schedules.map((schedule) =>
                buildScheduleTrigger(schedule as ScheduleRow, lastRunMap.get(schedule.id) ?? null)
            ),
            ...triggers.map((trigger) =>
                buildTriggerTrigger(
                    trigger as TriggerRow,
                    agent.slug,
                    lastRunMap.get(trigger.id) ?? null
                )
            )
        ].sort((a, b) => {
            const aTime = new Date(a.createdAt).getTime();
            const bTime = new Date(b.createdAt).getTime();
            return bTime - aTime;
        });

        return NextResponse.json({
            success: true,
            triggers: unifiedTriggers,
            total: unifiedTriggers.length
        });
    } catch (error) {
        console.error("[Execution Triggers] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list execution triggers"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/agents/[id]/execution-triggers
 *
 * Create a unified trigger or schedule for an agent.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const {
            type,
            name,
            description,
            config = {},
            input,
            context,
            maxSteps,
            environment,
            filter,
            inputMapping,
            isActive
        } = body as {
            type?: string;
            name?: string;
            description?: string;
            config?: Record<string, unknown>;
            input?: string;
            context?: Record<string, unknown>;
            maxSteps?: number;
            environment?: string;
            filter?: Record<string, unknown>;
            inputMapping?: Record<string, unknown>;
            isActive?: boolean;
        };

        if (!name || !type) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: name, type" },
                { status: 400 }
            );
        }

        if (!UNIFIED_TRIGGER_TYPES.includes(type as UnifiedTrigger["type"])) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid type. Must be one of: ${UNIFIED_TRIGGER_TYPES.join(", ")}`
                },
                { status: 400 }
            );
        }

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            },
            select: { id: true, slug: true, workspaceId: true }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        if (type === "scheduled") {
            const cronExpr = config.cronExpr as string | undefined;
            if (!cronExpr) {
                return NextResponse.json(
                    { success: false, error: "Missing required field: config.cronExpr" },
                    { status: 400 }
                );
            }

            const timezone = (config.timezone as string | undefined) || "UTC";
            let nextRunAt: Date;
            try {
                nextRunAt = getNextRunAt(cronExpr, timezone, new Date());
            } catch (error) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            error instanceof Error
                                ? error.message
                                : "Invalid schedule configuration"
                    },
                    { status: 400 }
                );
            }

            const defaults: TriggerInputDefaults = {
                input,
                context,
                maxSteps,
                environment
            };

            const inputJson =
                input !== undefined ||
                context !== undefined ||
                maxSteps !== undefined ||
                environment !== undefined
                    ? defaults
                    : null;

            const schedule = await prisma.agentSchedule.create({
                data: {
                    agentId: agent.id,
                    workspaceId: agent.workspaceId,
                    name,
                    description,
                    cronExpr,
                    timezone,
                    inputJson: inputJson ? JSON.parse(JSON.stringify(inputJson)) : null,
                    isActive: isActive !== false,
                    nextRunAt
                }
            });

            return NextResponse.json({
                success: true,
                trigger: buildScheduleTrigger(schedule as ScheduleRow, null)
            });
        }

        const triggerType = type;
        if (triggerType === "event" && !config.eventName) {
            return NextResponse.json(
                { success: false, error: "Missing required field: config.eventName" },
                { status: 400 }
            );
        }

        const mappingCandidate = extractTriggerInputMapping(inputMapping);
        if (inputMapping !== undefined && inputMapping !== null && !mappingCandidate) {
            return NextResponse.json(
                { success: false, error: "inputMapping must be an object" },
                { status: 400 }
            );
        }

        const defaults: TriggerInputDefaults = {
            input,
            context,
            maxSteps,
            environment
        };

        const configOverrides =
            input !== undefined ||
            context !== undefined ||
            maxSteps !== undefined ||
            environment !== undefined
                ? {
                      defaults,
                      environment
                  }
                : null;

        const shouldSetDefaultField = ["api", "manual", "test", "mcp"].includes(triggerType);
        const mergedMapping = mergeTriggerInputMapping(mappingCandidate, configOverrides, {
            setDefaultField: shouldSetDefaultField
        });
        const mappingValidation = validateTriggerInputMapping(mergedMapping);
        if (!mappingValidation.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: mappingValidation.error || "Invalid inputMapping"
                },
                { status: 400 }
            );
        }

        let webhookPath: string | null = null;
        let webhookSecret: string | null = null;
        if (triggerType === "webhook") {
            webhookPath = `trigger_${randomBytes(16).toString("hex")}`;
            webhookSecret = randomBytes(32).toString("hex");
        }

        const trigger = await prisma.agentTrigger.create({
            data: {
                agentId: agent.id,
                workspaceId: agent.workspaceId,
                name,
                description,
                triggerType,
                eventName: (config.eventName as string | undefined) ?? null,
                webhookPath,
                webhookSecret,
                filterJson: filter ? JSON.parse(JSON.stringify(filter)) : null,
                inputMapping: mergedMapping ? JSON.parse(JSON.stringify(mergedMapping)) : null,
                isActive: isActive !== false
            }
        });

        const response: Record<string, unknown> = {
            success: true,
            trigger: buildTriggerTrigger(trigger as TriggerRow, agent.slug, null)
        };

        if (triggerType === "webhook") {
            response.webhook = {
                path: `/api/webhooks/${webhookPath}`,
                secret: webhookSecret,
                note: "Save this secret - it won't be shown again"
            };
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error("[Execution Triggers] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create execution trigger"
            },
            { status: 500 }
        );
    }
}
