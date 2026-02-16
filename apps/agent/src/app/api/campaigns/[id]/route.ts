import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma, CampaignStatus, MissionStatus } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { getDemoSession } from "@/lib/standalone-auth";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/campaigns/[id]
 * Get a single campaign with full details (missions, tasks, logs)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const url = new URL(request.url);

        // Log pagination & filtering
        const logLimit = Math.min(parseInt(url.searchParams.get("logLimit") || "50"), 200);
        const logOffset = parseInt(url.searchParams.get("logOffset") || "0");
        const logFilter = url.searchParams.get("logFilter") || undefined;

        const logWhere: { campaignId: string; event?: string } = { campaignId: id };
        if (logFilter) logWhere.event = logFilter;

        const [campaign, logCount] = await Promise.all([
            prisma.campaign.findUnique({
                where: { id },
                include: {
                    missions: {
                        include: {
                            tasks: {
                                include: {
                                    agentRun: {
                                        select: {
                                            id: true,
                                            status: true,
                                            outputText: true,
                                            durationMs: true,
                                            costUsd: true,
                                            totalTokens: true,
                                            promptTokens: true,
                                            completionTokens: true,
                                            evaluation: {
                                                select: {
                                                    id: true,
                                                    overallGrade: true,
                                                    scoresJson: true,
                                                    aarJson: true
                                                }
                                            }
                                        }
                                    }
                                },
                                orderBy: { sequence: "asc" }
                            }
                        },
                        orderBy: { sequence: "asc" }
                    },
                    logs: {
                        where: logFilter ? { event: logFilter } : undefined,
                        orderBy: { createdAt: "desc" },
                        take: logLimit,
                        skip: logOffset
                    }
                }
            }),
            prisma.campaignLog.count({ where: logWhere })
        ]);

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (campaign.createdBy !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({ ...campaign, logCount });
    } catch (error) {
        console.error("[Campaigns API] Failed to get campaign:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to get campaign"
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/campaigns/[id]
 * Update a campaign or perform actions (approve, cancel, retry)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { action, ...updates } = body;

        const campaign = await prisma.campaign.findUnique({ where: { id } });

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (campaign.createdBy !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Handle actions
        if (action) {
            switch (action) {
                case "approve": {
                    // Approve a READY campaign and start execution
                    if (campaign.status !== CampaignStatus.READY) {
                        return NextResponse.json(
                            {
                                error: "Can only approve campaigns in READY status"
                            },
                            { status: 400 }
                        );
                    }

                    await inngest.send({
                        name: "campaign/execute",
                        data: { campaignId: id }
                    });

                    await prisma.campaignLog.create({
                        data: {
                            campaignId: id,
                            event: "approved",
                            message: "Campaign approved by user, execution starting"
                        }
                    });

                    return NextResponse.json({
                        message: "Campaign approved and execution started"
                    });
                }

                case "cancel": {
                    if (
                        campaign.status === CampaignStatus.COMPLETE ||
                        campaign.status === CampaignStatus.FAILED
                    ) {
                        return NextResponse.json(
                            { error: "Cannot cancel finished campaigns" },
                            { status: 400 }
                        );
                    }

                    await prisma.campaign.update({
                        where: { id },
                        data: {
                            status: CampaignStatus.FAILED,
                            completedAt: new Date()
                        }
                    });

                    await prisma.campaignLog.create({
                        data: {
                            campaignId: id,
                            event: "cancelled",
                            message: "Campaign cancelled by user"
                        }
                    });

                    return NextResponse.json({
                        message: "Campaign cancelled"
                    });
                }

                case "resume": {
                    // Resume a PAUSED campaign
                    if (campaign.status !== CampaignStatus.PAUSED) {
                        return NextResponse.json(
                            {
                                error: "Can only resume paused campaigns"
                            },
                            { status: 400 }
                        );
                    }

                    await prisma.campaign.update({
                        where: { id },
                        data: { status: CampaignStatus.EXECUTING }
                    });

                    // Re-trigger execution for pending missions
                    const pendingMissions = await prisma.mission.findMany({
                        where: {
                            campaignId: id,
                            status: {
                                in: [MissionStatus.PENDING, MissionStatus.EXECUTING]
                            }
                        }
                    });

                    for (const mission of pendingMissions) {
                        await inngest.send({
                            name: "mission/execute",
                            data: { campaignId: id, missionId: mission.id }
                        });
                    }

                    await prisma.campaignLog.create({
                        data: {
                            campaignId: id,
                            event: "resumed",
                            message: `Campaign resumed. ${pendingMissions.length} missions restarted.`
                        }
                    });

                    return NextResponse.json({
                        message: "Campaign resumed"
                    });
                }

                case "retry": {
                    // Retry a stuck PLANNING or FAILED campaign
                    if (
                        campaign.status !== CampaignStatus.PLANNING &&
                        campaign.status !== CampaignStatus.FAILED
                    ) {
                        return NextResponse.json(
                            {
                                error: "Can only retry campaigns in PLANNING or FAILED status"
                            },
                            { status: 400 }
                        );
                    }

                    // Reset status to PLANNING and re-trigger analysis
                    await prisma.campaign.update({
                        where: { id },
                        data: {
                            status: CampaignStatus.PLANNING,
                            analysisOutput: Prisma.DbNull,
                            executionPlan: Prisma.DbNull,
                            aarJson: Prisma.DbNull,
                            progress: 0,
                            completedAt: null
                        }
                    });

                    // Clean up any existing missions/tasks from a failed run
                    await prisma.mission.deleteMany({
                        where: { campaignId: id }
                    });

                    await inngest.send({
                        name: "campaign/analyze",
                        data: { campaignId: id }
                    });

                    await prisma.campaignLog.create({
                        data: {
                            campaignId: id,
                            event: "retried",
                            message: "Campaign analysis re-triggered by user"
                        }
                    });

                    return NextResponse.json({
                        message: "Campaign retry started"
                    });
                }

                case "approve-mission": {
                    // Approve a mission that is AWAITING_APPROVAL
                    const { missionId, sequence: approvalSeq, notes } = body;

                    if (!missionId && approvalSeq === undefined) {
                        return NextResponse.json(
                            { error: "missionId or sequence required" },
                            { status: 400 }
                        );
                    }

                    // Send approval event
                    await inngest.send({
                        name: "mission/approved",
                        data: {
                            campaignId: id,
                            missionId: missionId || undefined,
                            sequence: approvalSeq !== undefined ? String(approvalSeq) : undefined
                        }
                    });

                    if (notes && missionId) {
                        await prisma.mission.update({
                            where: { id: missionId },
                            data: { approvalNotes: notes }
                        });
                    }

                    await prisma.campaignLog.create({
                        data: {
                            campaignId: id,
                            event: "mission_approved",
                            message: `Mission ${missionId || `sequence ${approvalSeq}`} approved by user`,
                            metadata: {
                                missionId,
                                sequence: approvalSeq,
                                notes
                            } as Prisma.InputJsonValue
                        }
                    });

                    return NextResponse.json({
                        message: "Mission approved"
                    });
                }

                default:
                    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
            }
        }

        // Handle field updates (only allowed in PLANNING or READY status)
        if (
            campaign.status !== CampaignStatus.PLANNING &&
            campaign.status !== CampaignStatus.READY
        ) {
            return NextResponse.json(
                {
                    error: "Can only update campaigns in PLANNING or READY status"
                },
                { status: 400 }
            );
        }

        const allowedFields = [
            "name",
            "intent",
            "endState",
            "description",
            "constraints",
            "restraints",
            "requireApproval",
            "maxCostUsd",
            "timeoutMinutes"
        ];

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }

        const updated = await prisma.campaign.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("[Campaigns API] Failed to update campaign:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to update campaign"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/campaigns/[id]
 * Delete a campaign and all related data
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;

        const campaign = await prisma.campaign.findUnique({ where: { id } });

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (campaign.createdBy !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Cannot delete executing campaigns
        if (campaign.status === CampaignStatus.EXECUTING) {
            return NextResponse.json(
                { error: "Cannot delete an executing campaign. Cancel it first." },
                { status: 400 }
            );
        }

        // Cascade delete handles missions, tasks, and logs
        await prisma.campaign.delete({ where: { id } });

        return NextResponse.json({ message: "Campaign deleted" });
    } catch (error) {
        console.error("[Campaigns API] Failed to delete campaign:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to delete campaign"
            },
            { status: 500 }
        );
    }
}
