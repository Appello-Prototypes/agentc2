import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getDemoSession } from "@/lib/standalone-auth";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/campaigns/templates/[id]
 * Get a single template with its campaigns and schedules
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;

        const template = await prisma.campaignTemplate.findUnique({
            where: { id },
            include: {
                campaigns: {
                    orderBy: { createdAt: "desc" },
                    take: 20,
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        status: true,
                        runNumber: true,
                        totalCostUsd: true,
                        totalTokens: true,
                        createdAt: true,
                        completedAt: true
                    }
                },
                schedules: true
            }
        });

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        return NextResponse.json(template);
    } catch (error) {
        console.error("[Campaign Templates API] Failed to get:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to get template" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/campaigns/templates/[id]
 * Update a template
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await request.json();

        const allowedFields = [
            "name",
            "description",
            "category",
            "intentTemplate",
            "endStateTemplate",
            "constraints",
            "restraints",
            "parameters",
            "requireApproval",
            "maxCostUsd",
            "timeoutMinutes",
            "isActive"
        ];

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        const updated = await prisma.campaignTemplate.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("[Campaign Templates API] Failed to update:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update template" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/campaigns/templates/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        await prisma.campaignTemplate.delete({ where: { id } });
        return NextResponse.json({ message: "Template deleted" });
    } catch (error) {
        console.error("[Campaign Templates API] Failed to delete:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete template" },
            { status: 500 }
        );
    }
}
