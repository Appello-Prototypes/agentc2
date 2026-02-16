import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getDemoSession } from "@/lib/standalone-auth";

/**
 * GET /api/campaigns/templates
 * List all campaign templates
 */
export async function GET(request: NextRequest) {
    const session = await getDemoSession(request);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const templates = await prisma.campaignTemplate.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { campaigns: true, schedules: true } }
            }
        });

        return NextResponse.json({ templates });
    } catch (error) {
        console.error("[Campaign Templates API] Failed to list:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to list templates" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/campaigns/templates
 * Create a new campaign template
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
            intentTemplate,
            endStateTemplate,
            description,
            category,
            constraints,
            restraints,
            parameters,
            requireApproval,
            maxCostUsd,
            timeoutMinutes
        } = body;

        if (!name || !intentTemplate || !endStateTemplate) {
            return NextResponse.json(
                { error: "name, intentTemplate, and endStateTemplate are required" },
                { status: 400 }
            );
        }

        const slug =
            name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") +
            "-" +
            Date.now().toString(36);

        const template = await prisma.campaignTemplate.create({
            data: {
                slug,
                name,
                intentTemplate,
                endStateTemplate,
                description: description || null,
                category: category || null,
                constraints: constraints || [],
                restraints: restraints || [],
                parameters: parameters || null,
                requireApproval: requireApproval || false,
                maxCostUsd: maxCostUsd || null,
                timeoutMinutes: timeoutMinutes || null,
                createdBy: session.user.id
            }
        });

        return NextResponse.json(template, { status: 201 });
    } catch (error) {
        console.error("[Campaign Templates API] Failed to create:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create template" },
            { status: 500 }
        );
    }
}
