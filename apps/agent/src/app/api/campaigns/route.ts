import { NextRequest, NextResponse } from "next/server";
import { prisma, CampaignStatus } from "@repo/database";
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
        const {
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

        if (!name || !intent || !endState) {
            return NextResponse.json(
                {
                    error: "name, intent, and endState are required"
                },
                { status: 400 }
            );
        }

        const campaign = await prisma.campaign.create({
            data: {
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
            }
        });

        // Log creation
        await prisma.campaignLog.create({
            data: {
                campaignId: campaign.id,
                event: "created",
                message: `Campaign "${name}" created`
            }
        });

        // Trigger analysis via Inngest
        await inngest.send({
            name: "campaign/analyze",
            data: { campaignId: campaign.id }
        });

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
