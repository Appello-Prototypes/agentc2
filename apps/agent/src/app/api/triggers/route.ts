import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/triggers?type=webhook
 *
 * List agent triggers, optionally filtered by type.
 * Used by the webhooks page to show all webhook triggers in a flat table.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, any> = {};
        if (type) {
            where.triggerType = type;
        }

        const triggers = await prisma.agentTrigger.findMany({
            where,
            select: {
                id: true,
                name: true,
                description: true,
                triggerType: true,
                webhookPath: true,
                isActive: true,
                createdAt: true,
                triggerCount: true,
                lastTriggeredAt: true,
                agent: {
                    select: {
                        slug: true,
                        name: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            triggers
        });
    } catch (error) {
        console.error("[Triggers API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list triggers"
            },
            { status: 500 }
        );
    }
}
