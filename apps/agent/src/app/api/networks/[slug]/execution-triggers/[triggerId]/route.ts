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

function buildNetworkTrigger(
    trigger: TriggerRow,
    networkSlug: string,
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
                    ? `/api/networks/${networkSlug}/execution-triggers/${buildUnifiedTriggerId("trigger", trigger.id)}/execute`
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

async function findNetwork(slug: string) {
    return prisma.network.findFirst({
        where: { OR: [{ slug }, { id: slug }] },
        select: { id: true, slug: true }
    });
}

/**
 * GET /api/networks/[slug]/execution-triggers/[triggerId]
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

        const network = await findNetwork(slug);
        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, networkId: network.id, entityType: "network" }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            trigger: buildNetworkTrigger(trigger as TriggerRow, network.slug, null)
        });
    } catch (error) {
        console.error("[Network Triggers] Error fetching:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch network trigger" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/networks/[slug]/execution-triggers/[triggerId]
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

        const network = await findNetwork(slug);
        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, networkId: network.id, entityType: "network" }
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
            trigger: buildNetworkTrigger(updated as TriggerRow, network.slug, null)
        });
    } catch (error) {
        console.error("[Network Triggers] Error updating:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update network trigger" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/networks/[slug]/execution-triggers/[triggerId]
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

        const network = await findNetwork(slug);
        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: parsed.id, networkId: network.id, entityType: "network" }
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
        console.error("[Network Triggers] Error deleting:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete network trigger" },
            { status: 500 }
        );
    }
}
