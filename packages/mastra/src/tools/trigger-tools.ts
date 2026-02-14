import { randomBytes } from "crypto";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { prisma } from "@repo/database";
import {
    UNIFIED_TRIGGER_TYPES,
    buildUnifiedTriggerId,
    extractScheduleDefaults,
    extractTriggerConfig,
    extractTriggerInputMapping,
    mergeTriggerInputMapping,
    parseUnifiedTriggerId,
    validateTriggerInputMapping,
    type TriggerInputDefaults,
    type UnifiedTrigger,
    type UnifiedTriggerRunSummary
} from "../triggers/unified";
import { getNextRunAt } from "../triggers/schedule-utils";

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

async function resolveAgent(agentId: string) {
    return prisma.agent.findFirst({
        where: { OR: [{ slug: agentId }, { id: agentId }] },
        select: { id: true, slug: true, workspaceId: true }
    });
}

const triggerInputSchema = z.object({
    agentId: z.string(),
    triggerId: z.string().optional(),
    type: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    config: z.record(z.any()).optional(),
    input: z.string().optional(),
    context: z.record(z.any()).optional(),
    maxSteps: z.number().optional(),
    environment: z.string().optional(),
    filter: z.record(z.any()).optional(),
    inputMapping: z.record(z.any()).nullable().optional(),
    isActive: z.boolean().optional()
});

export const triggerUnifiedListTool = createTool({
    id: "trigger-unified-list",
    description: "List all execution triggers for an agent.",
    inputSchema: z.object({ agentId: z.string() }),
    outputSchema: z.object({
        success: z.boolean(),
        triggers: z.array(z.any()),
        total: z.number()
    }),
    execute: async ({ agentId }) => {
        const agent = await resolveAgent(agentId);
        if (!agent) {
            throw new Error(`Agent '${agentId}' not found`);
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

        return {
            success: true,
            triggers: unifiedTriggers,
            total: unifiedTriggers.length
        };
    }
});

export const triggerUnifiedGetTool = createTool({
    id: "trigger-unified-get",
    description: "Fetch a unified execution trigger by ID.",
    inputSchema: z.object({ agentId: z.string(), triggerId: z.string() }),
    outputSchema: z.object({
        success: z.boolean(),
        trigger: z.any()
    }),
    execute: async ({ agentId, triggerId }) => {
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            throw new Error("Invalid triggerId format");
        }

        const agent = await resolveAgent(agentId);
        if (!agent) {
            throw new Error(`Agent '${agentId}' not found`);
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
                throw new Error(`Schedule '${parsed.id}' not found`);
            }
            return {
                success: true,
                trigger: buildScheduleTrigger(
                    schedule as ScheduleRow,
                    (lastRun as RunRow | null) ?? null
                )
            };
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, agentId: agent.id }
        });
        if (!trigger) {
            throw new Error(`Trigger '${parsed.id}' not found`);
        }

        return {
            success: true,
            trigger: buildTriggerTrigger(
                trigger as TriggerRow,
                agent.slug,
                (lastRun as RunRow | null) ?? null
            )
        };
    }
});

export const triggerUnifiedCreateTool = createTool({
    id: "trigger-unified-create",
    description: "Create a unified execution trigger (schedule or event-based).",
    inputSchema: triggerInputSchema.extend({
        type: z.string(),
        name: z.string()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        trigger: z.any(),
        webhook: z
            .object({
                path: z.string(),
                secret: z.string(),
                note: z.string()
            })
            .optional()
    }),
    execute: async (input) => {
        const {
            agentId,
            type,
            name,
            description,
            config = {},
            input: inputText,
            context,
            maxSteps,
            environment,
            filter,
            inputMapping,
            isActive
        } = input;

        if (!UNIFIED_TRIGGER_TYPES.includes(type as UnifiedTrigger["type"])) {
            throw new Error(`Invalid type. Must be one of: ${UNIFIED_TRIGGER_TYPES.join(", ")}`);
        }

        const agent = await resolveAgent(agentId);
        if (!agent) {
            throw new Error(`Agent '${agentId}' not found`);
        }

        if (type === "scheduled") {
            const cronExpr = config.cronExpr as string | undefined;
            if (!cronExpr) {
                throw new Error("Missing required field: config.cronExpr");
            }
            const timezone = (config.timezone as string | undefined) || "UTC";
            const nextRunAt = getNextRunAt(cronExpr, timezone, new Date());

            const defaults: TriggerInputDefaults = {
                input: inputText,
                context,
                maxSteps,
                environment
            };
            const inputJson =
                inputText !== undefined ||
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

            return {
                success: true,
                trigger: buildScheduleTrigger(schedule as ScheduleRow, null)
            };
        }

        const triggerType = type;
        if (triggerType === "event" && !config.eventName) {
            throw new Error("Missing required field: config.eventName");
        }

        const mappingCandidate = extractTriggerInputMapping(inputMapping);
        if (inputMapping !== undefined && inputMapping !== null && !mappingCandidate) {
            throw new Error("inputMapping must be an object");
        }

        const defaults: TriggerInputDefaults = {
            input: inputText,
            context,
            maxSteps,
            environment
        };

        const configOverrides =
            inputText !== undefined ||
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
            throw new Error(mappingValidation.error || "Invalid inputMapping");
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

        const response: {
            success: boolean;
            trigger: UnifiedTrigger;
            webhook?: { path: string; secret: string; note: string };
        } = {
            success: true,
            trigger: buildTriggerTrigger(trigger as TriggerRow, agent.slug, null)
        };

        if (triggerType === "webhook") {
            response.webhook = {
                path: `/api/webhooks/${webhookPath}`,
                secret: webhookSecret || "",
                note: "Save this secret - it won't be shown again"
            };
        }

        return response;
    }
});

export const triggerUnifiedUpdateTool = createTool({
    id: "trigger-unified-update",
    description: "Update a unified execution trigger.",
    inputSchema: triggerInputSchema.extend({
        triggerId: z.string()
    }),
    outputSchema: z.object({
        success: z.boolean(),
        trigger: z.any()
    }),
    execute: async (input) => {
        const {
            agentId,
            triggerId,
            name,
            description,
            config = {},
            input: inputText,
            context,
            maxSteps,
            environment,
            filter,
            inputMapping,
            isActive
        } = input;

        if (!triggerId) {
            throw new Error("Missing required field: triggerId");
        }

        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            throw new Error("Invalid triggerId format");
        }

        const agent = await resolveAgent(agentId);
        if (!agent) {
            throw new Error(`Agent '${agentId}' not found`);
        }

        if (parsed.source === "schedule") {
            const schedule = await prisma.agentSchedule.findFirst({
                where: { id: parsed.id, agentId: agent.id }
            });
            if (!schedule) {
                throw new Error(`Schedule '${parsed.id}' not found`);
            }

            const updateData: Record<string, unknown> = {};
            if (name !== undefined) updateData.name = name;
            if (description !== undefined) updateData.description = description;
            if (config.cronExpr !== undefined) updateData.cronExpr = config.cronExpr;
            if (config.timezone !== undefined) updateData.timezone = config.timezone;
            if (isActive !== undefined) updateData.isActive = isActive !== false;

            const defaults: TriggerInputDefaults = {
                input: inputText,
                context,
                maxSteps,
                environment
            };
            if (
                inputText !== undefined ||
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
                updateData.nextRunAt = getNextRunAt(resolvedCron, resolvedTimezone, new Date());
            }

            if (isActive === false) {
                updateData.nextRunAt = null;
            }

            const updated = await prisma.agentSchedule.update({
                where: { id: schedule.id },
                data: updateData
            });

            return {
                success: true,
                trigger: buildScheduleTrigger(updated as ScheduleRow, null)
            };
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, agentId: agent.id }
        });
        if (!trigger) {
            throw new Error(`Trigger '${parsed.id}' not found`);
        }

        if (trigger.triggerType === "event" && config.eventName === "") {
            throw new Error("eventName cannot be empty");
        }

        const defaults: TriggerInputDefaults = {
            input: inputText,
            context,
            maxSteps,
            environment
        };
        const configOverrides =
            inputText !== undefined ||
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
                throw new Error("inputMapping must be an object");
            }

            const shouldSetDefaultField = ["api", "manual", "test", "mcp"].includes(
                trigger.triggerType
            );
            mergedMapping = mergeTriggerInputMapping(mappingCandidate, configOverrides, {
                setDefaultField: shouldSetDefaultField
            });
            const mappingValidation = validateTriggerInputMapping(mergedMapping);
            if (!mappingValidation.valid) {
                throw new Error(mappingValidation.error || "Invalid inputMapping");
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

        return {
            success: true,
            trigger: buildTriggerTrigger(updated as TriggerRow, agent.slug, null)
        };
    }
});

export const triggerUnifiedDeleteTool = createTool({
    id: "trigger-unified-delete",
    description: "Delete a unified execution trigger.",
    inputSchema: z.object({ agentId: z.string(), triggerId: z.string() }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string()
    }),
    execute: async ({ agentId, triggerId }) => {
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            throw new Error("Invalid triggerId format");
        }

        const agent = await resolveAgent(agentId);
        if (!agent) {
            throw new Error(`Agent '${agentId}' not found`);
        }

        if (parsed.source === "schedule") {
            const schedule = await prisma.agentSchedule.findFirst({
                where: { id: parsed.id, agentId: agent.id }
            });
            if (!schedule) {
                throw new Error(`Schedule '${parsed.id}' not found`);
            }
            await prisma.agentSchedule.delete({ where: { id: schedule.id } });
            return { success: true, message: "Schedule deleted" };
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, agentId: agent.id }
        });
        if (!trigger) {
            throw new Error(`Trigger '${parsed.id}' not found`);
        }
        await prisma.agentTrigger.delete({ where: { id: trigger.id } });
        return { success: true, message: "Trigger deleted" };
    }
});

export const triggerUnifiedEnableTool = createTool({
    id: "trigger-unified-enable",
    description: "Enable a unified execution trigger.",
    inputSchema: z.object({ agentId: z.string(), triggerId: z.string() }),
    outputSchema: z.object({ success: z.boolean(), trigger: z.any() }),
    execute: async ({ agentId, triggerId }) => {
        if (!triggerUnifiedUpdateTool.execute) {
            throw new Error("triggerUnifiedUpdateTool.execute is not available");
        }
        return triggerUnifiedUpdateTool.execute(
            { agentId, triggerId, isActive: true },
            {} as never
        );
    }
});

export const triggerUnifiedDisableTool = createTool({
    id: "trigger-unified-disable",
    description: "Disable a unified execution trigger.",
    inputSchema: z.object({ agentId: z.string(), triggerId: z.string() }),
    outputSchema: z.object({ success: z.boolean(), trigger: z.any() }),
    execute: async ({ agentId, triggerId }) => {
        if (!triggerUnifiedUpdateTool.execute) {
            throw new Error("triggerUnifiedUpdateTool.execute is not available");
        }
        return triggerUnifiedUpdateTool.execute(
            { agentId, triggerId, isActive: false },
            {} as never
        );
    }
});

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
    if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Request failed (${response.status})`);
    }
    return data;
};

export const triggerTestTool = createTool({
    id: "trigger-test",
    description: "Dry-run a unified trigger.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        triggerId: z.string().describe("Unified trigger ID"),
        input: z.string().optional(),
        context: z.record(z.any()).optional(),
        maxSteps: z.number().optional(),
        environment: z.string().optional(),
        payload: z.record(z.any()).optional()
    }),
    outputSchema: z.object({ success: z.boolean() }).passthrough(),
    execute: async ({ agentId, triggerId, input, context, maxSteps, environment, payload }) => {
        return callInternalApi(`/api/agents/${agentId}/execution-triggers/${triggerId}/test`, {
            method: "POST",
            body: { input, context, maxSteps, environment, payload }
        });
    }
});

export const triggerExecuteTool = createTool({
    id: "trigger-execute",
    description: "Execute a unified trigger.",
    inputSchema: z.object({
        agentId: z.string().describe("Agent slug or ID"),
        triggerId: z.string().describe("Unified trigger ID"),
        input: z.string().optional(),
        context: z.record(z.any()).optional(),
        maxSteps: z.number().optional(),
        environment: z.string().optional(),
        payload: z.record(z.any()).optional()
    }),
    outputSchema: z.object({ success: z.boolean() }).passthrough(),
    execute: async ({ agentId, triggerId, input, context, maxSteps, environment, payload }) => {
        return callInternalApi(`/api/agents/${agentId}/execution-triggers/${triggerId}/execute`, {
            method: "POST",
            body: { input, context, maxSteps, environment, payload }
        });
    }
});
