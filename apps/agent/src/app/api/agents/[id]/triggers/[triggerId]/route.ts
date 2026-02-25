import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { mergeTriggerInputMapping, validateTriggerInputMapping } from "@/lib/unified-triggers";

/**
 * PATCH /api/agents/[id]/triggers/[triggerId]
 *
 * Update an existing trigger.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; triggerId: string }> }
) {
    try {
        const { id, triggerId } = await params;
        const body = await request.json();

        const { name, description, eventName, filter, inputMapping, isActive, triggerType, color } =
            body;

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: triggerId, agentId: agent.id }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${triggerId}' not found` },
                { status: 404 }
            );
        }

        if (triggerType && triggerType !== trigger.triggerType) {
            return NextResponse.json(
                { success: false, error: "Trigger type cannot be changed" },
                { status: 400 }
            );
        }

        if (trigger.triggerType === "event" && eventName === "") {
            return NextResponse.json(
                { success: false, error: "eventName cannot be empty" },
                { status: 400 }
            );
        }

        if (
            inputMapping !== undefined &&
            inputMapping !== null &&
            typeof inputMapping !== "object"
        ) {
            return NextResponse.json(
                { success: false, error: "inputMapping must be an object" },
                { status: 400 }
            );
        }

        const shouldSetDefaultField = ["api", "manual", "test", "mcp"].includes(
            trigger.triggerType
        );
        const mergedInputMapping =
            inputMapping === undefined
                ? null
                : mergeTriggerInputMapping(inputMapping as Record<string, unknown> | null, null, {
                      setDefaultField: shouldSetDefaultField
                  });
        const mappingValidation = validateTriggerInputMapping(
            mergedInputMapping as Record<string, unknown> | null
        );
        if (!mappingValidation.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: mappingValidation.error || "Invalid inputMapping"
                },
                { status: 400 }
            );
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (eventName !== undefined) updateData.eventName = eventName;
        if (filter !== undefined) {
            updateData.filterJson = filter ? JSON.parse(JSON.stringify(filter)) : null;
        }
        if (inputMapping !== undefined) {
            updateData.inputMapping = mergedInputMapping
                ? JSON.parse(JSON.stringify(mergedInputMapping))
                : null;
        }
        if (isActive !== undefined) updateData.isActive = isActive !== false;
        if (color !== undefined) updateData.color = color || null;

        const updated = await prisma.agentTrigger.update({
            where: { id: trigger.id },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            trigger: {
                id: updated.id,
                name: updated.name,
                description: updated.description,
                triggerType: updated.triggerType,
                eventName: updated.eventName,
                isActive: updated.isActive,
                updatedAt: updated.updatedAt
            }
        });
    } catch (error) {
        console.error("[Triggers] Error updating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update trigger"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/agents/[id]/triggers/[triggerId]
 *
 * Delete a trigger.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; triggerId: string }> }
) {
    try {
        const { id, triggerId } = await params;

        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: { id: triggerId, agentId: agent.id }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${triggerId}' not found` },
                { status: 404 }
            );
        }

        await prisma.agentTrigger.delete({ where: { id: trigger.id } });

        return NextResponse.json({
            success: true,
            message: "Trigger deleted"
        });
    } catch (error) {
        console.error("[Triggers] Error deleting:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete trigger"
            },
            { status: 500 }
        );
    }
}
