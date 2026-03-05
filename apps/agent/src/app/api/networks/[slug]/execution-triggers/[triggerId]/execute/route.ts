import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { matchesTriggerFilter } from "@/lib/trigger-utils";
import { parseUnifiedTriggerId } from "@/lib/unified-triggers";
import { createTriggerEventRecord } from "@/lib/trigger-events";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * POST /api/networks/[slug]/execution-triggers/[triggerId]/execute
 *
 * Execute a network via a trigger with optional payload.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; triggerId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { slug, triggerId } = await params;
        const parsed = parseUnifiedTriggerId(triggerId);
        if (!parsed) {
            return NextResponse.json(
                { success: false, error: "Invalid triggerId format" },
                { status: 400 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const { payload } = body as { payload?: Record<string, unknown> };

        const network = await prisma.network.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                workspace: { organizationId: authContext.organizationId }
            },
            select: { id: true, slug: true, isActive: true, workspaceId: true }
        });

        if (!network) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' not found` },
                { status: 404 }
            );
        }

        if (!network.isActive) {
            return NextResponse.json(
                { success: false, error: `Network '${slug}' is not active` },
                { status: 403 }
            );
        }

        const trigger = await prisma.agentTrigger.findFirst({
            where: {
                id: parsed.id,
                networkId: network.id,
                entityType: "network"
            }
        });

        if (!trigger) {
            return NextResponse.json(
                { success: false, error: `Trigger '${parsed.id}' not found` },
                { status: 404 }
            );
        }

        if (!trigger.isActive) {
            return NextResponse.json(
                { success: false, error: "Trigger is disabled" },
                { status: 403 }
            );
        }

        const payloadObj = (
            payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}
        ) as Record<string, unknown>;

        if (
            !matchesTriggerFilter(payloadObj, trigger.filterJson as Record<string, unknown> | null)
        ) {
            return NextResponse.json(
                { success: false, error: "Trigger filter did not match payload" },
                { status: 400 }
            );
        }

        let triggerEventId: string | undefined;
        try {
            const te = await createTriggerEventRecord({
                triggerId: trigger.id,
                networkId: network.id,
                workspaceId: trigger.workspaceId || network.workspaceId || null,
                sourceType: trigger.triggerType,
                triggerType: trigger.triggerType,
                entityType: "network",
                eventName: trigger.eventName || undefined,
                payload: payloadObj,
                metadata: { triggerName: trigger.name }
            });
            triggerEventId = te.id;
        } catch (e) {
            console.warn("[Network Triggers] Failed to record trigger event:", e);
        }

        await inngest.send({
            name: "network/trigger.fire",
            data: {
                triggerId: trigger.id,
                networkId: network.id,
                networkSlug: network.slug,
                triggerEventId,
                payload: {
                    ...payloadObj,
                    _trigger: {
                        id: trigger.id,
                        name: trigger.name,
                        type: trigger.triggerType,
                        manual: true
                    }
                }
            }
        });

        await prisma.agentTrigger.update({
            where: { id: trigger.id },
            data: {
                lastTriggeredAt: new Date(),
                triggerCount: { increment: 1 }
            }
        });

        return NextResponse.json({
            success: true,
            message: "Network trigger execution queued"
        });
    } catch (error) {
        console.error("[Network Triggers] Error executing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to execute network trigger"
            },
            { status: 500 }
        );
    }
}
