import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@repo/database"

/**
 * PATCH /api/agents/[id]/output-actions/[actionId]
 *
 * Update an output action
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; actionId: string }> }
) {
    try {
        const { id, actionId } = await params
        const body = await request.json()

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] }
        })

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            )
        }

        const existing = await prisma.outputAction.findFirst({
            where: { id: actionId, agentId: agent.id }
        })

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Output action '${actionId}' not found` },
                { status: 404 }
            )
        }

        const { name, type, configJson, isActive } = body

        if (type) {
            const validTypes = ["WEBHOOK", "CHAIN_AGENT"]
            if (!validTypes.includes(type)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid type '${type}'. Must be one of: ${validTypes.join(", ")}`
                    },
                    { status: 400 }
                )
            }
        }

        const updated = await prisma.outputAction.update({
            where: { id: actionId },
            data: {
                ...(name !== undefined && { name }),
                ...(type !== undefined && { type }),
                ...(configJson !== undefined && { configJson }),
                ...(isActive !== undefined && { isActive })
            }
        })

        return NextResponse.json({
            success: true,
            outputAction: {
                id: updated.id,
                name: updated.name,
                type: updated.type,
                configJson: updated.configJson,
                isActive: updated.isActive,
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt
            }
        })
    } catch (error) {
        console.error("[OutputActions] Error updating:", error)
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to update output action"
            },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/agents/[id]/output-actions/[actionId]
 *
 * Delete an output action
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; actionId: string }> }
) {
    try {
        const { id, actionId } = await params

        const agent = await prisma.agent.findFirst({
            where: { OR: [{ slug: id }, { id }] }
        })

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            )
        }

        const existing = await prisma.outputAction.findFirst({
            where: { id: actionId, agentId: agent.id }
        })

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Output action '${actionId}' not found` },
                { status: 404 }
            )
        }

        await prisma.outputAction.delete({ where: { id: actionId } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[OutputActions] Error deleting:", error)
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to delete output action"
            },
            { status: 500 }
        )
    }
}
