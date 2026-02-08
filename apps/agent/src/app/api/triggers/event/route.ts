import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma, TriggerEventStatus } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildTriggerPayloadSnapshot, createTriggerEventRecord } from "@/lib/trigger-events";

/**
 * POST /api/triggers/event
 *
 * Fire event triggers by event name.
 */
export async function POST(request: NextRequest) {
    try {
        const apiKey =
            request.headers.get("x-api-key") ||
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

        const validKey = process.env.MCP_API_KEY;
        if (!validKey || !apiKey || apiKey !== validKey) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
        const clientId = forwardedFor || request.headers.get("x-real-ip") || "unknown";
        const rate = checkRateLimit(`event:${clientId}`, { windowMs: 60000, max: 120 });
        if (!rate.allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded" },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { eventName, payload, workspaceId } = body;

        if (!eventName) {
            return NextResponse.json(
                { success: false, error: "Missing required field: eventName" },
                { status: 400 }
            );
        }

        const organizationSlug = request.headers.get("x-organization-slug")?.trim();
        const where: Prisma.AgentTriggerWhereInput = {
            triggerType: "event",
            isActive: true,
            eventName
        };

        if (workspaceId) {
            where.workspaceId = workspaceId;
        }

        if (organizationSlug) {
            where.workspace = { organization: { slug: organizationSlug } };
        }

        const triggers = await prisma.agentTrigger.findMany({
            where,
            include: {
                agent: {
                    select: {
                        id: true,
                        slug: true,
                        isActive: true
                    }
                }
            }
        });

        const activeTriggers = triggers.filter((trigger) => trigger.agent.isActive);
        const inactiveTriggers = triggers.filter((trigger) => !trigger.agent.isActive);
        const { normalizedPayload } = buildTriggerPayloadSnapshot(payload);

        if (inactiveTriggers.length > 0) {
            await Promise.all(
                inactiveTriggers.map((trigger) =>
                    createTriggerEventRecord({
                        triggerId: trigger.id,
                        agentId: trigger.agent.id,
                        workspaceId: trigger.workspaceId,
                        status: TriggerEventStatus.SKIPPED,
                        sourceType: "event",
                        triggerType: trigger.triggerType,
                        eventName: trigger.eventName,
                        payload: normalizedPayload,
                        errorMessage: "Agent is disabled"
                    })
                )
            );
        }

        if (activeTriggers.length === 0) {
            if (triggers.length > 0) {
                return NextResponse.json({
                    success: true,
                    triggered: 0
                });
            }

            let fallbackWorkspaceId = workspaceId || null;
            if (!fallbackWorkspaceId && organizationSlug) {
                const workspace = await prisma.workspace.findFirst({
                    where: {
                        organization: { slug: organizationSlug },
                        isDefault: true
                    },
                    select: { id: true }
                });
                fallbackWorkspaceId = workspace?.id ?? null;
            }

            if (fallbackWorkspaceId) {
                await createTriggerEventRecord({
                    workspaceId: fallbackWorkspaceId,
                    status: TriggerEventStatus.NO_MATCH,
                    sourceType: "event",
                    triggerType: "event",
                    eventName,
                    payload: normalizedPayload,
                    errorMessage: "No active triggers matched event"
                });
            }

            return NextResponse.json({
                success: true,
                triggered: 0
            });
        }

        const triggerEvents = await Promise.all(
            activeTriggers.map((trigger) =>
                createTriggerEventRecord({
                    triggerId: trigger.id,
                    agentId: trigger.agent.id,
                    workspaceId: trigger.workspaceId,
                    status: TriggerEventStatus.RECEIVED,
                    sourceType: "event",
                    triggerType: trigger.triggerType,
                    eventName: trigger.eventName,
                    payload: normalizedPayload
                })
            )
        );

        await Promise.all(
            activeTriggers.map((trigger, index) =>
                inngest.send({
                    name: "agent/trigger.fire",
                    data: {
                        triggerId: trigger.id,
                        agentId: trigger.agent.id,
                        triggerEventId: triggerEvents[index]?.id,
                        payload: {
                            ...normalizedPayload,
                            _trigger: {
                                id: trigger.id,
                                name: trigger.name,
                                type: trigger.triggerType,
                                eventName: trigger.eventName
                            }
                        }
                    }
                })
            )
        );

        return NextResponse.json({
            success: true,
            triggered: activeTriggers.length
        });
    } catch (error) {
        console.error("[Triggers] Error firing event:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fire event trigger"
            },
            { status: 500 }
        );
    }
}
