/**
 * Agent Instances CRUD API
 *
 * GET    /api/instances           - List instances for the org
 * POST   /api/instances           - Create a new instance
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { createInstance, listInstances } from "@/lib/agent-instances";

async function getSessionOrg() {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user?.id) return null;

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true, userId: true }
    });
    return membership
        ? { organizationId: membership.organizationId, userId: membership.userId }
        : null;
}

export async function GET(request: NextRequest) {
    const sessionOrg = await getSessionOrg();
    if (!sessionOrg) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const contextType = url.searchParams.get("contextType") ?? undefined;
    const isActive = url.searchParams.has("isActive")
        ? url.searchParams.get("isActive") === "true"
        : undefined;

    const instances = await listInstances(sessionOrg.organizationId, {
        agentId,
        contextType,
        isActive
    });

    return NextResponse.json({ instances });
}

export async function POST(request: NextRequest) {
    const sessionOrg = await getSessionOrg();
    if (!sessionOrg) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
        agentId?: string;
        name?: string;
        slug?: string;
        contextType?: string;
        contextId?: string;
        contextData?: Record<string, unknown>;
        instructionOverrides?: string;
        ragCollectionId?: string;
        temperatureOverride?: number;
        maxStepsOverride?: number;
        metadata?: Record<string, unknown>;
    };

    if (!body.agentId || !body.name || !body.slug) {
        return NextResponse.json(
            { error: "agentId, name, and slug are required" },
            { status: 400 }
        );
    }

    // Verify agent belongs to this org
    const agent = await prisma.agent.findFirst({
        where: {
            id: body.agentId,
            workspace: { organizationId: sessionOrg.organizationId }
        },
        select: { id: true }
    });

    if (!agent) {
        return NextResponse.json(
            { error: "Agent not found in your organization" },
            { status: 404 }
        );
    }

    try {
        const instance = await createInstance({
            agentId: body.agentId,
            organizationId: sessionOrg.organizationId,
            name: body.name,
            slug: body.slug,
            contextType: body.contextType,
            contextId: body.contextId,
            contextData: body.contextData,
            instructionOverrides: body.instructionOverrides,
            ragCollectionId: body.ragCollectionId,
            temperatureOverride: body.temperatureOverride,
            maxStepsOverride: body.maxStepsOverride,
            metadata: body.metadata,
            createdBy: sessionOrg.userId
        });

        return NextResponse.json({ instance }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Unique constraint failed")) {
            return NextResponse.json(
                { error: "An instance with this slug already exists" },
                { status: 409 }
            );
        }
        console.error("[Instances] Failed to create instance:", error);
        return NextResponse.json({ error: "Failed to create instance" }, { status: 500 });
    }
}
