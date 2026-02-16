import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma, TriggerEventStatus, CampaignStatus } from "@repo/database";
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
                        entityType: "agent",
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
                    entityType: "agent",
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
                    entityType: "agent",
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

        // Also check for campaign triggers matching this event
        let campaignsTriggered = 0;
        try {
            const campaignTriggers = await prisma.campaignTrigger.findMany({
                where: {
                    triggerType: "event",
                    isActive: true,
                    eventName
                },
                include: {
                    template: {
                        select: {
                            id: true,
                            slug: true,
                            name: true,
                            intentTemplate: true,
                            endStateTemplate: true,
                            description: true,
                            constraints: true,
                            restraints: true,
                            requireApproval: true,
                            maxCostUsd: true,
                            timeoutMinutes: true,
                            isActive: true
                        }
                    }
                }
            });

            for (const ct of campaignTriggers) {
                if (!ct.template.isActive) continue;

                // Map event payload to template parameters using inputMapping
                const mapping = (ct.inputMapping as Record<string, string>) || {};
                const parameterValues: Record<string, string> = {};
                for (const [paramKey, payloadPath] of Object.entries(mapping)) {
                    const value = payloadPath
                        .split(".")
                        .reduce(
                            (obj: Record<string, unknown>, key: string) =>
                                obj?.[key] as Record<string, unknown>,
                            normalizedPayload as Record<string, unknown>
                        );
                    if (value !== undefined) {
                        parameterValues[paramKey] = String(value);
                    }
                }

                // Interpolate template fields
                const interpolate = (text: string) =>
                    text.replace(
                        /\{\{(\w+)\}\}/g,
                        (_, key) => parameterValues[key] || `{{${key}}}`
                    );

                // Compute run number
                const lastRun = await prisma.campaign.findFirst({
                    where: { templateId: ct.template.id },
                    orderBy: { runNumber: "desc" },
                    select: { runNumber: true }
                });
                const runNumber = (lastRun?.runNumber || 0) + 1;

                const slug = ct.template.slug + "-triggered-" + Date.now().toString(36);

                const campaign = await prisma.campaign.create({
                    data: {
                        slug,
                        name: interpolate(ct.template.name),
                        intent: interpolate(ct.template.intentTemplate),
                        endState: interpolate(ct.template.endStateTemplate),
                        description: ct.template.description
                            ? interpolate(ct.template.description)
                            : null,
                        constraints: ct.template.constraints,
                        restraints: ct.template.restraints,
                        requireApproval: ct.template.requireApproval,
                        maxCostUsd: ct.template.maxCostUsd,
                        timeoutMinutes: ct.template.timeoutMinutes,
                        templateId: ct.template.id,
                        runNumber,
                        parameterValues: parameterValues as unknown as Prisma.InputJsonValue,
                        status: CampaignStatus.PLANNING
                    }
                });

                await inngest.send({
                    name: "campaign/analyze",
                    data: { campaignId: campaign.id }
                });

                // Update trigger stats
                await prisma.campaignTrigger.update({
                    where: { id: ct.id },
                    data: {
                        lastTriggeredAt: new Date(),
                        triggerCount: { increment: 1 }
                    }
                });

                campaignsTriggered++;
                console.log(
                    `[Triggers] Campaign trigger ${ct.id} fired for event "${eventName}" -> campaign ${campaign.id}`
                );
            }
        } catch (campaignTriggerErr) {
            console.error("[Triggers] Error processing campaign triggers:", campaignTriggerErr);
        }

        return NextResponse.json({
            success: true,
            triggered: activeTriggers.length,
            campaignsTriggered
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
