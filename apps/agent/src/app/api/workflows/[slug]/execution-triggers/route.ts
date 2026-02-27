import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@repo/database";
import { encryptString } from "@/lib/credential-crypto";
import {
    UNIFIED_TRIGGER_TYPES,
    buildUnifiedTriggerId,
    extractTriggerConfig,
    extractTriggerInputMapping,
    mergeTriggerInputMapping,
    validateTriggerInputMapping,
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
    isArchived: boolean;
    archivedAt: Date | null;
    lastTriggeredAt: Date | null;
    triggerCount: number;
    createdAt: Date;
    updatedAt: Date;
};

function buildTriggerTrigger(
    trigger: TriggerRow,
    workflowSlug: string,
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
        isArchived: trigger.isArchived,
        archivedAt: trigger.archivedAt,
        createdAt: trigger.createdAt,
        updatedAt: trigger.updatedAt,
        config: {
            eventName: trigger.eventName,
            webhookPath: trigger.webhookPath,
            hasWebhookSecret: Boolean(trigger.webhookSecret),
            apiEndpoint:
                trigger.triggerType === "api"
                    ? `/api/workflows/${workflowSlug}/execution-triggers/${buildUnifiedTriggerId("trigger", trigger.id)}/execute`
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

async function findWorkflow(slug: string) {
    return prisma.workflow.findFirst({
        where: { OR: [{ slug }, { id: slug }] },
        select: { id: true, slug: true, workspaceId: true }
    });
}

/**
 * GET /api/workflows/[slug]/execution-triggers
 *
 * List triggers for a workflow.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const workflow = await findWorkflow(slug);
        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const includeArchived = searchParams.get("includeArchived") === "true";
        const archiveFilter = includeArchived ? {} : { isArchived: false };

        const triggers = await prisma.agentTrigger.findMany({
            where: {
                workflowId: workflow.id,
                entityType: "workflow",
                ...archiveFilter
            },
            orderBy: { createdAt: "desc" }
        });

        const triggerIds = triggers.map((t) => t.id);

        const recentRuns = await prisma.workflowRun.findMany({
            where: {
                workflowId: workflow.id,
                inputJson: { path: ["_trigger", "triggerId"], not: "null" }
            },
            orderBy: { startedAt: "desc" },
            take: triggerIds.length * 3,
            select: {
                id: true,
                status: true,
                startedAt: true,
                completedAt: true,
                durationMs: true,
                inputJson: true
            }
        });

        const lastRunMap = new Map<string, UnifiedTriggerRunSummary>();
        for (const run of recentRuns) {
            const inputObj = run.inputJson as Record<string, unknown> | null;
            const triggerMeta = inputObj?._trigger as Record<string, unknown> | undefined;
            const tid = triggerMeta?.triggerId as string | undefined;
            if (!tid || lastRunMap.has(tid)) continue;
            lastRunMap.set(tid, {
                id: run.id,
                status: run.status,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
                durationMs: run.durationMs
            });
        }

        const unifiedTriggers: UnifiedTrigger[] = triggers.map((trigger) =>
            buildTriggerTrigger(
                trigger as TriggerRow,
                workflow.slug,
                lastRunMap.get(trigger.id) ?? null
            )
        );

        return NextResponse.json({
            success: true,
            triggers: unifiedTriggers,
            total: unifiedTriggers.length
        });
    } catch (error) {
        console.error("[Workflow Triggers] Error listing:", error);
        return NextResponse.json(
            { success: false, error: "Failed to list workflow triggers" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/workflows/[slug]/execution-triggers
 *
 * Create a trigger for a workflow.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const workflow = await findWorkflow(slug);
        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const body = await request.json();
        const {
            type,
            name,
            description,
            config = {},
            filter,
            inputMapping,
            isActive
        } = body as {
            type?: string;
            name?: string;
            description?: string;
            config?: Record<string, unknown>;
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

        const allowedTypes = UNIFIED_TRIGGER_TYPES.filter((t) => t !== "scheduled");
        if (!(allowedTypes as readonly string[]).includes(type)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid type. Must be one of: ${allowedTypes.join(", ")}`
                },
                { status: 400 }
            );
        }

        if (type === "event" && !config.eventName) {
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

        const mergedMapping = mergeTriggerInputMapping(mappingCandidate, null, {
            setDefaultField: false
        });
        const mappingValidation = validateTriggerInputMapping(mergedMapping);
        if (!mappingValidation.valid) {
            return NextResponse.json(
                { success: false, error: mappingValidation.error || "Invalid inputMapping" },
                { status: 400 }
            );
        }

        let webhookPath: string | null = null;
        let webhookSecret: string | null = null;
        let webhookSecretPlain: string | null = null;
        if (type === "webhook") {
            webhookPath = `trigger_${randomBytes(16).toString("hex")}`;
            webhookSecretPlain = randomBytes(32).toString("hex");
            webhookSecret = encryptString(webhookSecretPlain);
        }

        const trigger = await prisma.agentTrigger.create({
            data: {
                entityType: "workflow",
                workflowId: workflow.id,
                workspaceId: workflow.workspaceId,
                name,
                description,
                triggerType: type,
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
            trigger: buildTriggerTrigger(trigger as TriggerRow, workflow.slug, null)
        };

        if (type === "webhook") {
            response.webhook = {
                path: `/api/webhooks/${webhookPath}`,
                secret: webhookSecretPlain,
                note: "Save this secret - it won't be shown again"
            };
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error("[Workflow Triggers] Error creating:", error);
        return NextResponse.json(
            { success: false, error: "Failed to create workflow trigger" },
            { status: 500 }
        );
    }
}
