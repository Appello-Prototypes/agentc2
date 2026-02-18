/**
 * Single Agent Instance API
 *
 * GET    /api/instances/:id       - Get instance by ID
 * PATCH  /api/instances/:id       - Update instance
 * DELETE /api/instances/:id       - Delete instance
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { getInstance, updateInstance, deleteInstance } from "@/lib/agent-instances";

async function getSessionOrgId() {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user?.id) return null;

    const membership = await prisma.membership.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true }
    });
    return membership?.organizationId ?? null;
}

async function verifyOwnership(instanceId: string, organizationId: string) {
    const instance = await prisma.agentInstance.findUnique({
        where: { id: instanceId },
        select: { organizationId: true }
    });
    return instance?.organizationId === organizationId;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const organizationId = await getSessionOrgId();
    if (!organizationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await verifyOwnership(id, organizationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const instance = await getInstance(id);
    if (!instance) {
        return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    return NextResponse.json({ instance });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const organizationId = await getSessionOrgId();
    if (!organizationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await verifyOwnership(id, organizationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
        name?: string;
        contextType?: string | null;
        contextId?: string | null;
        contextData?: Record<string, unknown> | null;
        instructionOverrides?: string | null;
        ragCollectionId?: string | null;
        temperatureOverride?: number | null;
        maxStepsOverride?: number | null;
        metadata?: Record<string, unknown> | null;
        isActive?: boolean;
    };

    const instance = await updateInstance(id, body);
    return NextResponse.json({ instance });
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const organizationId = await getSessionOrgId();
    if (!organizationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await verifyOwnership(id, organizationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteInstance(id);
    return NextResponse.json({ deleted: true });
}
