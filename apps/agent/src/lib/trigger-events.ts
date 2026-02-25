import { prisma, Prisma, TriggerEventStatus } from "@repo/database";
import { recordActivity } from "@repo/agentc2/activity/service";

const MAX_PAYLOAD_CHARS = 10000;
const PREVIEW_CHARS = 2000;

function normalizeTriggerPayload(payload: unknown): Record<string, unknown> {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return payload as Record<string, unknown>;
    }

    return { value: payload };
}

function truncateString(value: string, maxLength: number): { value: string; truncated: boolean } {
    if (value.length <= maxLength) {
        return { value, truncated: false };
    }

    return { value: `${value.slice(0, maxLength)}...(truncated)`, truncated: true };
}

export function buildTriggerPayloadSnapshot(payload: unknown): {
    payloadJson: Prisma.InputJsonValue | null;
    payloadPreview: string | null;
    payloadTruncated: boolean;
    normalizedPayload: Record<string, unknown>;
} {
    if (payload === undefined) {
        return {
            payloadJson: null,
            payloadPreview: null,
            payloadTruncated: false,
            normalizedPayload: {}
        };
    }

    const normalizedPayload = normalizeTriggerPayload(payload);
    let serialized = "";

    try {
        serialized = JSON.stringify(normalizedPayload);
    } catch (error) {
        serialized = JSON.stringify({
            error: "Failed to serialize payload",
            reason: error instanceof Error ? error.message : "unknown"
        });
    }

    const preview = truncateString(serialized, PREVIEW_CHARS);
    const payloadTruncated = serialized.length > MAX_PAYLOAD_CHARS;
    const payloadJson = payloadTruncated ? null : (JSON.parse(serialized) as Prisma.InputJsonValue);

    return {
        payloadJson,
        payloadPreview: preview.value,
        payloadTruncated: payloadTruncated || preview.truncated,
        normalizedPayload
    };
}

export async function ensureSlackTrigger(
    agentId: string,
    agentName: string,
    workspaceId: string | null
): Promise<{ id: string; isActive: boolean; isArchived: boolean }> {
    const existing = await prisma.agentTrigger.findFirst({
        where: { agentId, triggerType: "slack_listener" },
        select: { id: true, isActive: true, isArchived: true }
    });
    if (existing) return existing;

    const trigger = await prisma.agentTrigger.create({
        data: {
            agentId,
            workspaceId,
            name: `Slack Messages → ${agentName}`,
            description: "Incoming Slack messages routed to this agent",
            triggerType: "slack_listener",
            eventName: "slack.message",
            isActive: true
        },
        select: { id: true, isActive: true, isArchived: true }
    });
    return trigger;
}

export async function createTriggerEventRecord(options: {
    triggerId?: string | null;
    agentId?: string | null;
    workspaceId?: string | null;
    runId?: string | null;
    status?: TriggerEventStatus;
    sourceType: string;
    triggerType?: string | null;
    integrationKey?: string | null;
    integrationId?: string | null;
    eventName?: string | null;
    webhookPath?: string | null;
    payload?: unknown;
    errorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
    entityType?: string | null;
    workflowId?: string | null;
    workflowRunId?: string | null;
    networkId?: string | null;
    networkRunId?: string | null;
}) {
    const { payloadJson, payloadPreview, payloadTruncated } = buildTriggerPayloadSnapshot(
        options.payload
    );

    const result = await prisma.triggerEvent.create({
        data: {
            triggerId: options.triggerId ?? null,
            agentId: options.agentId ?? null,
            workspaceId: options.workspaceId ?? null,
            runId: options.runId ?? null,
            status: options.status ?? TriggerEventStatus.RECEIVED,
            sourceType: options.sourceType,
            triggerType: options.triggerType ?? null,
            integrationKey: options.integrationKey ?? null,
            integrationId: options.integrationId ?? null,
            eventName: options.eventName ?? null,
            webhookPath: options.webhookPath ?? null,
            payloadJson: payloadJson ?? undefined,
            payloadPreview,
            payloadTruncated,
            errorMessage: options.errorMessage ?? null,
            entityType: options.entityType ?? null,
            workflowId: options.workflowId ?? null,
            workflowRunId: options.workflowRunId ?? null,
            networkId: options.networkId ?? null,
            networkRunId: options.networkRunId ?? null,
            metadata: options.metadata
                ? (JSON.parse(JSON.stringify(options.metadata)) as Prisma.InputJsonValue)
                : undefined
        },
        select: {
            id: true,
            status: true,
            runId: true,
            payloadPreview: true,
            payloadTruncated: true
        }
    });

    // Record to Activity Feed
    recordActivity({
        type: options.sourceType === "schedule" ? "SCHEDULE_EXECUTED" : "TRIGGER_FIRED",
        agentId: options.agentId || undefined,
        summary: `Trigger fired: ${options.eventName || options.sourceType}`,
        status: "info",
        source: options.sourceType,
        runId: options.runId || undefined,
        networkRunId: options.networkRunId || undefined,
        metadata: {
            triggerId: options.triggerId,
            sourceType: options.sourceType,
            entityType: options.entityType
        },
        workspaceId: options.workspaceId || undefined
    });

    return result;
}

export async function updateTriggerEventRecord(
    triggerEventId: string,
    data: Prisma.TriggerEventUpdateInput
) {
    return prisma.triggerEvent.update({
        where: { id: triggerEventId },
        data
    });
}

export function buildTriggerTestPayload(
    basePayload: Record<string, unknown>,
    overrides?: Record<string, unknown> | null
) {
    return {
        ...basePayload,
        ...(overrides || {}),
        test: true,
        timestamp: new Date().toISOString()
    };
}
