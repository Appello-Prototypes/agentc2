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

async function resolveAgent(agentId: string, organizationId?: string) {
    return prisma.agent.findFirst({
        where: {
            OR: [{ slug: agentId }, { id: agentId }],
            ...(organizationId ? { workspace: { organizationId } } : {})
        },
        select: { id: true, slug: true, workspaceId: true }
    });
}

async function resolveWorkflow(workflowSlug: string, organizationId?: string) {
    return prisma.workflow.findFirst({
        where: {
            OR: [{ slug: workflowSlug }, { id: workflowSlug }],
            ...(organizationId ? { workspace: { organizationId } } : {})
        },
        select: { id: true, slug: true, workspaceId: true }
    });
}

async function resolveNetwork(networkSlug: string, organizationId?: string) {
    return prisma.network.findFirst({
        where: {
            OR: [{ slug: networkSlug }, { id: networkSlug }],
            ...(organizationId ? { workspace: { organizationId } } : {})
        },
        select: { id: true, slug: true, workspaceId: true }
    });
}

async function resolveEntity(
    entityType: string,
    identifiers: { agentId?: string; workflowSlug?: string; networkSlug?: string },
    organizationId?: string
): Promise<{ id: string; slug: string; workspaceId: string; entityType: string }> {
    if (entityType === "workflow") {
        if (!identifiers.workflowSlug)
            throw new Error("workflowSlug is required when entityType is 'workflow'");
        const workflow = await resolveWorkflow(identifiers.workflowSlug, organizationId);
        if (!workflow) throw new Error(`Workflow '${identifiers.workflowSlug}' not found`);
        return { ...workflow, entityType: "workflow" };
    }
    if (entityType === "network") {
        if (!identifiers.networkSlug)
            throw new Error("networkSlug is required when entityType is 'network'");
        const network = await resolveNetwork(identifiers.networkSlug, organizationId);
        if (!network) throw new Error(`Network '${identifiers.networkSlug}' not found`);
        return { ...network, entityType: "network" };
    }
    if (!identifiers.agentId) throw new Error("agentId is required when entityType is 'agent'");
    const agent = await resolveAgent(identifiers.agentId, organizationId);
    if (!agent) throw new Error(`Agent '${identifiers.agentId}' not found`);
    return { ...agent, entityType: "agent" };
}

const triggerInputSchema = z.object({
    entityType: z
        .enum(["agent", "workflow", "network"])
        .default("agent")
        .describe(
            "Target entity type. Use 'agent' (default) for agent triggers, 'workflow' for workflow triggers, 'network' for network triggers."
        ),
    agentId: z
        .string()
        .optional()
        .describe("Agent slug or ID (required when entityType is 'agent')"),
    workflowSlug: z
        .string()
        .optional()
        .describe("Workflow slug or ID (required when entityType is 'workflow')"),
    networkSlug: z
        .string()
        .optional()
        .describe("Network slug or ID (required when entityType is 'network')"),
    triggerId: z.string().optional().describe("Trigger ID (for get/update/delete operations)"),
    type: z
        .enum(["scheduled", "webhook", "event", "mcp", "api", "manual", "test"])
        .optional()
        .describe(
            "Trigger type. Use 'scheduled' for cron-based recurring execution, 'webhook' for HTTP-triggered, 'event' for event-driven."
        ),
    name: z.string().optional().describe("Human-readable trigger name"),
    description: z.string().optional().describe("Optional description of what the trigger does"),
    config: z
        .record(z.any())
        .optional()
        .describe(
            "Type-specific config. For scheduled: { cronExpr: '*/30 * * * *', timezone?: 'UTC' }. For event: { eventName: 'some.event.name' }."
        ),
    input: z
        .string()
        .optional()
        .describe("Default input message to send to the agent when triggered"),
    context: z.record(z.any()).optional().describe("Additional context to pass to the agent"),
    maxSteps: z.number().optional().describe("Max agentic loop steps (default: 10)"),
    environment: z.string().optional().describe("Environment label (e.g. 'production', 'staging')"),
    filter: z.record(z.any()).optional().describe("Event filter criteria"),
    inputMapping: z
        .record(z.any())
        .nullable()
        .optional()
        .describe("Input field mapping configuration"),
    isActive: z.boolean().optional().describe("Whether the trigger is active (default: true)")
});

export const triggerUnifiedListTool = createTool({
    id: "trigger-unified-list",
    description:
        "List all execution triggers for an agent, workflow, or network. Defaults to agent if entityType is not specified.",
    inputSchema: z.object({
        entityType: z
            .enum(["agent", "workflow", "network"])
            .default("agent")
            .describe("Target entity type"),
        agentId: z
            .string()
            .optional()
            .describe("Agent slug or ID (required for entityType 'agent')"),
        workflowSlug: z
            .string()
            .optional()
            .describe("Workflow slug or ID (required for entityType 'workflow')"),
        networkSlug: z
            .string()
            .optional()
            .describe("Network slug or ID (required for entityType 'network')")
    }),
    outputSchema: z.object({
        success: z.boolean().optional(),
        triggers: z.array(z.any()),
        total: z.number()
    }),
    execute: async (input) => {
        const {
            entityType = "agent",
            agentId,
            workflowSlug,
            networkSlug
        } = input as {
            entityType?: string;
            agentId?: string;
            workflowSlug?: string;
            networkSlug?: string;
        };
        const organizationId = (input as Record<string, unknown>).organizationId as
            | string
            | undefined;
        const entity = await resolveEntity(
            entityType,
            { agentId, workflowSlug, networkSlug },
            organizationId
        );

        const scheduleWhere =
            entityType === "workflow"
                ? { workflowId: entity.id, entityType: "workflow" }
                : entityType === "network"
                  ? { networkId: entity.id, entityType: "network" }
                  : { agentId: entity.id };

        const triggerWhere =
            entityType === "workflow"
                ? { workflowId: entity.id, entityType: "workflow" }
                : entityType === "network"
                  ? { networkId: entity.id, entityType: "network" }
                  : { agentId: entity.id };

        const [schedules, triggers] = await Promise.all([
            prisma.agentSchedule.findMany({
                where: scheduleWhere,
                orderBy: { createdAt: "desc" }
            }),
            prisma.agentTrigger.findMany({
                where: triggerWhere,
                orderBy: { createdAt: "desc" }
            })
        ]);

        const triggerIds = [
            ...schedules.map((schedule) => schedule.id),
            ...triggers.map((trigger) => trigger.id)
        ];

        let lastRunMap = new Map<string, UnifiedTriggerRunSummary>();
        if (entityType === "agent" && triggerIds.length > 0) {
            const recentRuns = await prisma.agentRun.findMany({
                where: {
                    agentId: entity.id,
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
            lastRunMap = buildLastRunMap(recentRuns as RunRow[]);
        }

        const unifiedTriggers: UnifiedTrigger[] = [
            ...schedules.map((schedule) =>
                buildScheduleTrigger(schedule as ScheduleRow, lastRunMap.get(schedule.id) ?? null)
            ),
            ...triggers.map((trigger) =>
                buildTriggerTrigger(
                    trigger as TriggerRow,
                    entity.slug,
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
        success: z.boolean().optional(),
        trigger: z.any()
    }),
    execute: async (input) => {
        const { agentId, triggerId } = input as { agentId: string; triggerId: string };
        const organizationId = (input as Record<string, unknown>).organizationId as
            | string
            | undefined;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            throw new Error("Invalid triggerId format");
        }

        const agent = await resolveAgent(agentId, organizationId);
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
    description:
        'Create a unified execution trigger (schedule or event-based) for an agent, workflow, or network. For agents: { agentId: "my-agent", type: "scheduled", name: "Hourly check", config: { cronExpr: "0 * * * *" } }. For workflows: { entityType: "workflow", workflowSlug: "my-workflow", type: "scheduled", name: "Every 4h", config: { cronExpr: "0 */4 * * *" } }. For networks: { entityType: "network", networkSlug: "my-network", type: "webhook", name: "On event" }.',
    inputSchema: triggerInputSchema.extend({
        type: z
            .enum(["scheduled", "webhook", "event", "mcp", "api", "manual", "test"])
            .describe("Trigger type. Use 'scheduled' for cron-based recurring execution."),
        name: z.string().describe("Human-readable trigger name")
    }),
    outputSchema: z.object({
        success: z.boolean().optional(),
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
            entityType: rawEntityType,
            agentId,
            workflowSlug,
            networkSlug,
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
            isActive,
            ...rest
        } = input;

        const entityType = rawEntityType || "agent";

        if (!UNIFIED_TRIGGER_TYPES.includes(type as UnifiedTrigger["type"])) {
            throw new Error(`Invalid type. Must be one of: ${UNIFIED_TRIGGER_TYPES.join(", ")}`);
        }

        const organizationId = (rest as Record<string, unknown>).organizationId as
            | string
            | undefined;
        const entity = await resolveEntity(
            entityType,
            { agentId, workflowSlug, networkSlug },
            organizationId
        );

        if (type === "scheduled") {
            const cronExpr = (config.cronExpr ?? config.cron ?? config.cronExpression) as
                | string
                | undefined;
            if (cronExpr && !config.cronExpr) {
                config.cronExpr = cronExpr;
            }
            if (!cronExpr) {
                throw new Error(
                    'Missing required field: config.cronExpr. Example: config: { cronExpr: "*/30 * * * *" }'
                );
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

            const scheduleData: Record<string, unknown> = {
                entityType,
                workspaceId: entity.workspaceId,
                name,
                description,
                cronExpr,
                timezone,
                inputJson: inputJson ? JSON.parse(JSON.stringify(inputJson)) : null,
                isActive: isActive !== false,
                nextRunAt
            };

            if (entityType === "workflow") {
                scheduleData.workflowId = entity.id;
            } else if (entityType === "network") {
                scheduleData.networkId = entity.id;
            } else {
                scheduleData.agentId = entity.id;
            }

            const schedule = await prisma.agentSchedule.create({
                data: scheduleData as Parameters<typeof prisma.agentSchedule.create>[0]["data"]
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

        const triggerData: Record<string, unknown> = {
            entityType,
            workspaceId: entity.workspaceId,
            name,
            description,
            triggerType,
            eventName: (config.eventName as string | undefined) ?? null,
            webhookPath,
            webhookSecret,
            filterJson: filter ? JSON.parse(JSON.stringify(filter)) : null,
            inputMapping: mergedMapping ? JSON.parse(JSON.stringify(mergedMapping)) : null,
            isActive: isActive !== false
        };

        if (entityType === "workflow") {
            triggerData.workflowId = entity.id;
        } else if (entityType === "network") {
            triggerData.networkId = entity.id;
        } else {
            triggerData.agentId = entity.id;
        }

        const trigger = await prisma.agentTrigger.create({
            data: triggerData as Parameters<typeof prisma.agentTrigger.create>[0]["data"]
        });

        const response: {
            success: boolean;
            trigger: UnifiedTrigger;
            webhook?: { path: string; secret: string; note: string };
        } = {
            success: true,
            trigger: buildTriggerTrigger(trigger as TriggerRow, entity.slug, null)
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
        success: z.boolean().optional(),
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
            isActive,
            ...rest
        } = input;

        if (!triggerId) {
            throw new Error("Missing required field: triggerId");
        }

        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            throw new Error("Invalid triggerId format");
        }

        const organizationId = (rest as Record<string, unknown>).organizationId as
            | string
            | undefined;
        if (!agentId) {
            throw new Error("agentId is required for update operations");
        }
        const agent = await resolveAgent(agentId, organizationId);
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
        success: z.boolean().optional(),
        message: z.string()
    }),
    execute: async (input) => {
        const { agentId, triggerId } = input as { agentId: string; triggerId: string };
        const organizationId = (input as Record<string, unknown>).organizationId as
            | string
            | undefined;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            throw new Error("Invalid triggerId format");
        }

        const agent = await resolveAgent(agentId, organizationId);
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
    outputSchema: z.object({ success: z.boolean().optional(), trigger: z.any() }),
    execute: async (input) => {
        if (!triggerUnifiedUpdateTool.execute) {
            throw new Error("triggerUnifiedUpdateTool.execute is not available");
        }
        const organizationId = (input as Record<string, unknown>).organizationId as
            | string
            | undefined;
        return triggerUnifiedUpdateTool.execute(
            { ...input, isActive: true, organizationId } as Parameters<
                NonNullable<typeof triggerUnifiedUpdateTool.execute>
            >[0],
            {} as never
        );
    }
});

export const triggerUnifiedDisableTool = createTool({
    id: "trigger-unified-disable",
    description: "Disable a unified execution trigger.",
    inputSchema: z.object({ agentId: z.string(), triggerId: z.string() }),
    outputSchema: z.object({ success: z.boolean().optional(), trigger: z.any() }),
    execute: async (input) => {
        if (!triggerUnifiedUpdateTool.execute) {
            throw new Error("triggerUnifiedUpdateTool.execute is not available");
        }
        const organizationId = (input as Record<string, unknown>).organizationId as
            | string
            | undefined;
        return triggerUnifiedUpdateTool.execute(
            { ...input, isActive: false, organizationId } as Parameters<
                NonNullable<typeof triggerUnifiedUpdateTool.execute>
            >[0],
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
    outputSchema: z.object({ success: z.boolean().optional() }).passthrough(),
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
    outputSchema: z.object({ success: z.boolean().optional() }).passthrough(),
    execute: async ({ agentId, triggerId, input, context, maxSteps, environment, payload }) => {
        return callInternalApi(`/api/agents/${agentId}/execution-triggers/${triggerId}/execute`, {
            method: "POST",
            body: { input, context, maxSteps, environment, payload }
        });
    }
});
