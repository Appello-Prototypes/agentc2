import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getNextRunAt } from "@/lib/schedule-utils";
import {
    buildUnifiedTriggerId,
    extractScheduleDefaults,
    extractTriggerInputMapping,
    extractTriggerConfig,
    mergeTriggerInputMapping,
    parseUnifiedTriggerId,
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
 * GET /api/agents/[id]/execution-triggers/[triggerId]
 *
 * Fetch a unified trigger by ID.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; triggerId: string }> }
) {
    try {
        const { id, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            },
            select: { id: true, slug: true }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const lastRun = await prisma.agentRun.findFirst({
            where: { agentId: agent.id, triggerId: parsed.id },
            orderBy: { startedAt: "desc" },
            select: {
                id: true,
                status: true,
                startedAt: true,
                completedAt: true,
                durationMs: true
            }
        });

        if (parsed.source === "schedule") {
            const schedule = await prisma.agentSchedule.findFirst({
                where: { id: parsed.id, agentId: agent.id }
            });

            if (!schedule) {
                return NextResponse.json(
                    { success: false, error: `Schedule '${parsed.id}' not found` },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                trigger: buildScheduleTrigger(
                    schedule as ScheduleRow,
                    (lastRun as RunRow | null) ?? null
                )
            });
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, agentId: agent.id }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            trigger: buildTriggerTrigger(
                trigger as TriggerRow,
                agent.slug,
                (lastRun as RunRow | null) ?? null
            )
        });
    } catch (error) {
        console.error("[Execution Triggers] Error fetching:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch execution trigger"
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/agents/[id]/execution-triggers/[triggerId]
 *
 * Update a unified trigger (schedule or trigger).
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; triggerId: string }> }
) {
    try {
        const { id, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const body = await request.json();

        const {
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
            name?: string;
            description?: string;
            config?: Record<string, unknown>;
            input?: string;
            context?: Record<string, unknown>;
            maxSteps?: number;
            environment?: string;
            filter?: Record<string, unknown>;
            inputMapping?: Record<string, unknown> | null;
            isActive?: boolean;
        };

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            },
            select: { id: true, slug: true }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        if (parsed.source === "schedule") {
            const schedule = await prisma.agentSchedule.findFirst({
                where: { id: parsed.id, agentId: agent.id }
            });

            if (!schedule) {
                return NextResponse.json(
                    { success: false, error: `Schedule '${parsed.id}' not found` },
                    { status: 404 }
                );
            }

            const updateData: Record<string, unknown> = {};
            if (name !== undefined) updateData.name = name;
            if (description !== undefined) updateData.description = description;
            if (config.cronExpr !== undefined) updateData.cronExpr = config.cronExpr;
            if (config.timezone !== undefined) updateData.timezone = config.timezone;
            if (isActive !== undefined) updateData.isActive = isActive !== false;

            const defaults: TriggerInputDefaults = {
                input,
                context,
                maxSteps,
                environment
            };
            if (
                input !== undefined ||
                context !== undefined ||
                maxSteps !== undefined ||
                environment !== undefined
            ) {
                updateData.inputJson = JSON.parse(JSON.stringify(defaults));
            }

            const shouldRecalculate =
                config.cronExpr !== undefined ||
                config.timezone !== undefined ||
                (isActive === true && schedule.isActive === false);

            if (shouldRecalculate) {
                const resolvedCron = (config.cronExpr as string | undefined) ?? schedule.cronExpr;
                const resolvedTimezone =
                    (config.timezone as string | undefined) ?? schedule.timezone ?? "UTC";

                try {
                    updateData.nextRunAt = getNextRunAt(resolvedCron, resolvedTimezone, new Date());
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
            }

            if (isActive === false) {
                updateData.nextRunAt = null;
            }

            const updated = await prisma.agentSchedule.update({
                where: { id: schedule.id },
                data: updateData
            });

            return NextResponse.json({
                success: true,
                trigger: buildScheduleTrigger(updated as ScheduleRow, null)
            });
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, agentId: agent.id }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        if (trigger.triggerType === "event" && config.eventName === "") {
            return NextResponse.json(
                { success: false, error: "eventName cannot be empty" },
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

        let mergedMapping = null;
        if (inputMapping !== undefined || configOverrides) {
            const mappingCandidate =
                inputMapping === undefined
                    ? extractTriggerInputMapping(trigger.inputMapping)
                    : extractTriggerInputMapping(inputMapping);

            if (inputMapping !== undefined && inputMapping !== null && !mappingCandidate) {
                return NextResponse.json(
                    { success: false, error: "inputMapping must be an object" },
                    { status: 400 }
                );
            }

            const shouldSetDefaultField = ["api", "manual", "test", "mcp"].includes(
                trigger.triggerType
            );
            mergedMapping = mergeTriggerInputMapping(mappingCandidate, configOverrides, {
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
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (config.eventName !== undefined) updateData.eventName = config.eventName;
        if (filter !== undefined) {
            updateData.filterJson = filter ? JSON.parse(JSON.stringify(filter)) : null;
        }
        if (inputMapping !== undefined || configOverrides) {
            updateData.inputMapping = mergedMapping
                ? JSON.parse(JSON.stringify(mergedMapping))
                : null;
        }
        if (isActive !== undefined) updateData.isActive = isActive !== false;

        const updated = await prisma.agentTrigger.update({
            where: { id: trigger.id },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            trigger: buildTriggerTrigger(updated as TriggerRow, agent.slug, null)
        });
    } catch (error) {
        console.error("[Execution Triggers] Error updating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update execution trigger"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/agents/[id]/execution-triggers/[triggerId]
 *
 * Delete a unified trigger.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; triggerId: string }> }
) {
    try {
        const { id, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            },
            select: { id: true }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        if (parsed.source === "schedule") {
            const schedule = await prisma.agentSchedule.findFirst({
                where: { id: parsed.id, agentId: agent.id }
            });

            if (!schedule) {
                return NextResponse.json(
                    { success: false, error: `Schedule '${parsed.id}' not found` },
                    { status: 404 }
                );
            }

            await prisma.agentSchedule.delete({ where: { id: schedule.id } });

            return NextResponse.json({
                success: true,
                message: "Schedule deleted"
            });
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, agentId: agent.id }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        await prisma.agentTrigger.delete({ where: { id: trigger.id } });

        return NextResponse.json({
            success: true,
            message: "Trigger deleted"
        });
    } catch (error) {
        console.error("[Execution Triggers] Error deleting:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete execution trigger"
            },
            { status: 500 }
        );
    }
}
