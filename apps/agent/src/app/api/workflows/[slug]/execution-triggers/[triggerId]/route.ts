import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import {
    buildUnifiedTriggerId,
    extractTriggerConfig,
    extractTriggerInputMapping,
    mergeTriggerInputMapping,
    parseUnifiedTriggerId,
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
        select: { id: true, slug: true }
    });
}

/**
 * GET /api/workflows/[slug]/execution-triggers/[triggerId]
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string; triggerId: string }> }
) {
    try {
        const { slug, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const workflow = await findWorkflow(slug);
        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, workflowId: workflow.id, entityType: "workflow" }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            trigger: buildTriggerTrigger(trigger as TriggerRow, workflow.slug, null)
        });
    } catch (error) {
        console.error("[Workflow Triggers] Error fetching:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch workflow trigger" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/workflows/[slug]/execution-triggers/[triggerId]
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; triggerId: string }> }
) {
    try {
        const { slug, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const workflow = await findWorkflow(slug);
        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, workflowId: workflow.id, entityType: "workflow" }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        const body = await request.json();
        const {
            name,
            description,
            config = {},
            filter,
            inputMapping,
            isActive,
            isArchived
        } = body as {
            name?: string;
            description?: string;
            config?: Record<string, unknown>;
            filter?: Record<string, unknown>;
            inputMapping?: Record<string, unknown> | null;
            isActive?: boolean;
            isArchived?: boolean;
        };

        if (trigger.triggerType === "event" && config.eventName === "") {
            return NextResponse.json(
                { success: false, error: "eventName cannot be empty" },
                { status: 400 }
            );
        }

        let mergedMapping = null;
        if (inputMapping !== undefined) {
            const mappingCandidate =
                inputMapping === undefined
                    ? extractTriggerInputMapping(trigger.inputMapping)
                    : extractTriggerInputMapping(inputMapping);

            if (inputMapping !== null && !mappingCandidate) {
                return NextResponse.json(
                    { success: false, error: "inputMapping must be an object" },
                    { status: 400 }
                );
            }

            mergedMapping = mergeTriggerInputMapping(mappingCandidate, null, {
                setDefaultField: false
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
        if (inputMapping !== undefined) {
            updateData.inputMapping = mergedMapping
                ? JSON.parse(JSON.stringify(mergedMapping))
                : null;
        }
        if (isActive !== undefined) updateData.isActive = isActive !== false;

        if (typeof isArchived === "boolean") {
            updateData.isArchived = isArchived;
            if (isArchived) {
                updateData.archivedAt = new Date();
                updateData.isActive = false;
            } else {
                updateData.archivedAt = null;
            }
        }

        const updated = await prisma.agentTrigger.update({
            where: { id: trigger.id },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            trigger: buildTriggerTrigger(updated as TriggerRow, workflow.slug, null)
        });
    } catch (error) {
        console.error("[Workflow Triggers] Error updating:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update workflow trigger" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/workflows/[slug]/execution-triggers/[triggerId]
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string; triggerId: string }> }
) {
    try {
        const { slug, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const workflow = await findWorkflow(slug);
        if (!workflow) {
            return NextResponse.json(
                { success: false, error: `Workflow '${slug}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, workflowId: workflow.id, entityType: "workflow" }
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
        console.error("[Workflow Triggers] Error deleting:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete workflow trigger" },
            { status: 500 }
        );
    }
}
