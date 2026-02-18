/**
 * Instance Channel Bindings API
 *
 * GET    /api/instances/:id/bindings           - List bindings for instance
 * POST   /api/instances/:id/bindings           - Add a channel binding
 * PATCH  /api/instances/:id/bindings?bindingId= - Update a binding
 * DELETE /api/instances/:id/bindings?bindingId= - Remove a binding
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import {
    addChannelBinding,
    updateChannelBinding,
    removeChannelBinding,
    invalidateBindingCache
} from "@/lib/agent-instances";

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

async function verifyInstanceOwnership(instanceId: string, organizationId: string) {
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
    if (!(await verifyInstanceOwnership(id, organizationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const bindings = await prisma.instanceChannelBinding.findMany({
        where: { instanceId: id },
        orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ bindings });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const organizationId = await getSessionOrgId();
    if (!organizationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await verifyInstanceOwnership(id, organizationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
        channelType?: string;
        channelIdentifier?: string;
        channelName?: string;
        channelMetadata?: Record<string, unknown>;
        replyMode?: string;
        responseLength?: string;
        richFormatting?: boolean;
        triggerOnAllMessages?: boolean;
        triggerKeywords?: string[];
        triggerOnFileUpload?: boolean;
        allowedUserIds?: string[];
        blockedUserIds?: string[];
    };

    if (!body.channelType || !body.channelIdentifier) {
        return NextResponse.json(
            { error: "channelType and channelIdentifier are required" },
            { status: 400 }
        );
    }

    const validTypes = ["slack", "email", "whatsapp", "web", "voice"];
    if (!validTypes.includes(body.channelType)) {
        return NextResponse.json(
            { error: `channelType must be one of: ${validTypes.join(", ")}` },
            { status: 400 }
        );
    }

    try {
        const binding = await addChannelBinding({
            instanceId: id,
            channelType: body.channelType,
            channelIdentifier: body.channelIdentifier,
            channelName: body.channelName,
            channelMetadata: body.channelMetadata,
            replyMode: body.replyMode,
            responseLength: body.responseLength,
            richFormatting: body.richFormatting,
            triggerOnAllMessages: body.triggerOnAllMessages,
            triggerKeywords: body.triggerKeywords,
            triggerOnFileUpload: body.triggerOnFileUpload,
            allowedUserIds: body.allowedUserIds,
            blockedUserIds: body.blockedUserIds
        });

        return NextResponse.json({ binding }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Unique constraint failed")) {
            return NextResponse.json(
                { error: "This channel is already bound to an instance" },
                { status: 409 }
            );
        }
        console.error("[Bindings] Failed to add binding:", error);
        return NextResponse.json({ error: "Failed to add binding" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const organizationId = await getSessionOrgId();
    if (!organizationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await verifyInstanceOwnership(id, organizationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const bindingId = url.searchParams.get("bindingId");
    if (!bindingId) {
        return NextResponse.json({ error: "bindingId query param required" }, { status: 400 });
    }

    // Verify binding belongs to this instance
    const existing = await prisma.instanceChannelBinding.findUnique({
        where: { id: bindingId },
        select: { instanceId: true }
    });
    if (!existing || existing.instanceId !== id) {
        return NextResponse.json({ error: "Binding not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
        channelName?: string;
        channelMetadata?: Record<string, unknown> | null;
        replyMode?: string | null;
        responseLength?: string | null;
        richFormatting?: boolean | null;
        triggerOnAllMessages?: boolean;
        triggerKeywords?: string[];
        triggerOnFileUpload?: boolean;
        allowedUserIds?: string[];
        blockedUserIds?: string[];
        isActive?: boolean;
    };

    const binding = await updateChannelBinding(bindingId, body);
    return NextResponse.json({ binding });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const organizationId = await getSessionOrgId();
    if (!organizationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await verifyInstanceOwnership(id, organizationId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const bindingId = url.searchParams.get("bindingId");
    if (!bindingId) {
        return NextResponse.json({ error: "bindingId query param required" }, { status: 400 });
    }

    const existing = await prisma.instanceChannelBinding.findUnique({
        where: { id: bindingId },
        select: { instanceId: true }
    });
    if (!existing || existing.instanceId !== id) {
        return NextResponse.json({ error: "Binding not found" }, { status: 404 });
    }

    await removeChannelBinding(bindingId);
    invalidateBindingCache();
    return NextResponse.json({ deleted: true });
}
