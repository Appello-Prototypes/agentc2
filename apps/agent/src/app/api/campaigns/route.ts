import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma, CampaignStatus } from "@repo/database";
import { inngest } from "@/lib/inngest";
import { getDemoSession } from "@/lib/standalone-auth";

function generateSlug(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") +
        "-" +
        Date.now().toString(36)
    );
}

/**
 * POST /api/campaigns
 * Create a new campaign and trigger analysis via Inngest
 */
export async function POST(request: NextRequest) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { templateId, parameterValues, parentCampaignId } = body;
        let {
            name,
            intent,
            endState,
            description,
            constraints,
            restraints,
            requireApproval,
            maxCostUsd,
            timeoutMinutes
        } = body;

        // If creating from a template, merge template fields
        if (templateId) {
            const template = await prisma.campaignTemplate.findUnique({
                where: { id: templateId }
            });
            if (!template) {
                return NextResponse.json({ error: "Template not found" }, { status: 404 });
            }
            // Interpolate template fields with parameter values
            const params = (parameterValues || {}) as Record<string, string>;
            const interpolate = (text: string) =>
                text.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] || `{{${key}}}`);

            name = name || interpolate(template.name);
            intent = interpolate(template.intentTemplate);
            endState = interpolate(template.endStateTemplate);
            description =
                description || (template.description ? interpolate(template.description) : null);
            constraints = constraints || template.constraints;
            restraints = restraints || template.restraints;
            requireApproval = requireApproval ?? template.requireApproval;
            maxCostUsd = maxCostUsd ?? template.maxCostUsd;
            timeoutMinutes = timeoutMinutes ?? template.timeoutMinutes;
        }

        if (!name || !intent || !endState) {
            return NextResponse.json(
                {
                    error: "name, intent, and endState are required"
                },
                { status: 400 }
            );
        }

        // Sub-campaign depth check
        let depth = 0;
        if (parentCampaignId) {
            const parent = await prisma.campaign.findUnique({
                where: { id: parentCampaignId },
                select: { depth: true }
            });
            if (parent && parent.depth >= 3) {
                return NextResponse.json(
                    { error: "Max campaign depth (3) exceeded" },
                    { status: 400 }
                );
            }
            depth = (parent?.depth ?? 0) + 1;
        }

        // Compute run number for template-based campaigns
        let runNumber: number | null = null;
        if (templateId) {
            const lastRun = await prisma.campaign.findFirst({
                where: { templateId },
                orderBy: { runNumber: "desc" },
                select: { runNumber: true }
            });
            runNumber = (lastRun?.runNumber || 0) + 1;
        }

        // Build campaign data, only including new fields when they have values
        // (gracefully handles running Prisma client that may not have schema updates yet)
        const campaignData: Record<string, unknown> = {
            slug: generateSlug(name),
            name,
            intent,
            endState,
            description: description || null,
            constraints: constraints || [],
            restraints: restraints || [],
            requireApproval: requireApproval || false,
            maxCostUsd: maxCostUsd || null,
            timeoutMinutes: timeoutMinutes || null,
            createdBy: session.user.id,
            status: CampaignStatus.PLANNING
        };

        // Add template/hierarchy fields only when they have values
        if (templateId) campaignData.templateId = templateId;
        if (runNumber !== null) campaignData.runNumber = runNumber;
        if (parameterValues) campaignData.parameterValues = parameterValues;
        if (parentCampaignId) {
            campaignData.parentCampaignId = parentCampaignId;
            campaignData.depth = depth;
        }

        const campaign = await prisma.campaign.create({
            data: campaignData as Prisma.CampaignCreateInput
        });

        // Log creation
        await prisma.campaignLog.create({
            data: {
                campaignId: campaign.id,
                event: "created",
                message: `Campaign "${name}" created`
            }
        });

        // Trigger analysis via Inngest (non-blocking -- campaign is already saved)
        try {
            await inngest.send({
                name: "campaign/analyze",
                data: { campaignId: campaign.id }
            });
        } catch (inngestError) {
            console.error(
                `[Campaigns API] Failed to send Inngest event for campaign ${campaign.id}:`,
                inngestError
            );
            // Update campaign to FAILED so it doesn't appear stuck
            await prisma.campaign.update({
                where: { id: campaign.id },
                data: { status: CampaignStatus.FAILED }
            });
            await prisma.campaignLog.create({
                data: {
                    campaignId: campaign.id,
                    event: "failed",
                    message: "Failed to trigger campaign analysis (Inngest send failed)"
                }
            });
        }

        console.log(`[Campaigns API] Created campaign: ${campaign.id} (${campaign.slug})`);

        return NextResponse.json(campaign, { status: 201 });
    } catch (error) {
        console.error("[Campaigns API] Failed to create campaign:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to create campaign"
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/campaigns
 * List all campaigns for the current user
 */
export async function GET(request: NextRequest) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const limit = parseInt(searchParams.get("limit") || "50", 10);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        const where: Record<string, unknown> = {
            createdBy: session.user.id
        };

        if (status) {
            where.status = status.toUpperCase();
        }

        const [campaigns, total] = await Promise.all([
            prisma.campaign.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                include: {
                    missions: {
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            sequence: true
                        },
                        orderBy: { sequence: "asc" }
                    },
                    _count: {
                        select: { missions: true, logs: true }
                    }
                }
            }),
            prisma.campaign.count({ where })
        ]);

        return NextResponse.json({ campaigns, total, limit, offset });
    } catch (error) {
        console.error("[Campaigns API] Failed to list campaigns:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to list campaigns"
            },
            { status: 500 }
        );
    }
}
