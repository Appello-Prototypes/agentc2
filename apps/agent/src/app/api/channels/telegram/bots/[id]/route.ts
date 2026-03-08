/**
 * Individual Telegram Bot Management
 *
 * GET    /api/channels/telegram/bots/[id]  - Get bot details + live status
 * PATCH  /api/channels/telegram/bots/[id]  - Update binding (agent/instance)
 * DELETE /api/channels/telegram/bots/[id]  - Remove bot + webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, type Prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { decryptCredentials } from "@/lib/credential-crypto";
import { encryptCredentials } from "@/lib/credential-crypto";
import { invalidateBindingCache } from "@/lib/agent-instances";

async function getConnectionForOrg(id: string, organizationId: string) {
    return prisma.integrationConnection.findFirst({
        where: {
            id,
            organizationId,
            provider: { key: "telegram-bot" }
        },
        include: { provider: true }
    });
}

// -----------------------------------------------------------------------
// GET - Bot details + live Telegram status
// -----------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const connection = await getConnectionForOrg(id, authContext.organizationId);
    if (!connection) {
        return NextResponse.json({ success: false, error: "Bot not found" }, { status: 404 });
    }

    const metadata = (connection.metadata ?? {}) as Record<string, unknown>;
    const decrypted = decryptCredentials(connection.credentials) as Record<string, string> | null;
    const botToken = decrypted?.TELEGRAM_BOT_TOKEN;

    let botInfo = null;
    let webhookInfo = null;

    if (botToken) {
        try {
            const [meRes, whRes] = await Promise.all([
                fetch(`https://api.telegram.org/bot${botToken}/getMe`),
                fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
            ]);
            const meData = await meRes.json();
            const whData = await whRes.json();

            if (meData.ok) botInfo = meData.result;
            if (whData.ok) webhookInfo = whData.result;
        } catch (e) {
            console.warn("[TelegramBots] Failed to fetch Telegram status:", e);
        }
    }

    let instance = null;
    if (metadata.instanceId) {
        instance = await prisma.agentInstance.findUnique({
            where: { id: metadata.instanceId as string },
            select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                agent: {
                    select: {
                        id: true,
                        slug: true,
                        name: true
                    }
                }
            }
        });
    }

    let agent = null;
    if (metadata.agentSlug && !metadata.instanceId) {
        agent = await prisma.agent.findFirst({
            where: {
                slug: metadata.agentSlug as string,
                isActive: true
            },
            select: { id: true, slug: true, name: true }
        });
    }

    return NextResponse.json({
        success: true,
        bot: {
            id: connection.id,
            name: connection.name,
            botUsername: metadata.botUsername || null,
            botId: metadata.botId || null,
            agentSlug: metadata.agentSlug || null,
            instanceId: metadata.instanceId || null,
            instance,
            agent: instance?.agent ?? agent,
            botInfo,
            webhook: webhookInfo
                ? {
                      url: webhookInfo.url || null,
                      pendingUpdateCount: webhookInfo.pending_update_count,
                      lastErrorDate: webhookInfo.last_error_date,
                      lastErrorMessage: webhookInfo.last_error_message
                  }
                : null,
            webhookPath: connection.webhookPath,
            isActive: connection.isActive,
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt
        }
    });
}

// -----------------------------------------------------------------------
// PATCH - Update binding
// -----------------------------------------------------------------------

interface PatchBotBody {
    agentSlug?: string;
    instanceId?: string | null;
    name?: string;
    isActive?: boolean;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const connection = await getConnectionForOrg(id, authContext.organizationId);
    if (!connection) {
        return NextResponse.json({ success: false, error: "Bot not found" }, { status: 404 });
    }

    const body = (await request.json()) as PatchBotBody;
    const currentMetadata = (connection.metadata ?? {}) as Record<string, unknown>;
    const updatedMetadata = { ...currentMetadata };

    const updateData: Prisma.IntegrationConnectionUpdateInput = {};

    if (body.agentSlug !== undefined) {
        updatedMetadata.agentSlug = body.agentSlug;
    }
    if (body.instanceId !== undefined) {
        updatedMetadata.instanceId = body.instanceId;
    }
    if (body.name !== undefined) {
        updateData.name = body.name;
    }
    if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
    }

    // Update credentials with new agent slug if provided
    if (body.agentSlug !== undefined) {
        const decrypted = decryptCredentials(connection.credentials) as Record<
            string,
            string
        > | null;
        if (decrypted) {
            decrypted.TELEGRAM_DEFAULT_AGENT_SLUG = body.agentSlug;
            const encryptedCreds = encryptCredentials(decrypted as Record<string, unknown>);
            updateData.credentials = encryptedCreds
                ? JSON.parse(JSON.stringify(encryptedCreds))
                : undefined;
        }
    }

    updateData.metadata = updatedMetadata as Prisma.InputJsonValue;

    const updated = await prisma.integrationConnection.update({
        where: { id },
        data: updateData
    });

    invalidateBindingCache();

    return NextResponse.json({
        success: true,
        bot: {
            id: updated.id,
            name: updated.name,
            isActive: updated.isActive,
            metadata: updatedMetadata
        }
    });
}

// -----------------------------------------------------------------------
// DELETE - Remove bot
// -----------------------------------------------------------------------

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const connection = await getConnectionForOrg(id, authContext.organizationId);
    if (!connection) {
        return NextResponse.json({ success: false, error: "Bot not found" }, { status: 404 });
    }

    // 1. Delete webhook from Telegram
    const decrypted = decryptCredentials(connection.credentials) as Record<string, string> | null;
    const botToken = decrypted?.TELEGRAM_BOT_TOKEN;

    if (botToken) {
        try {
            await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
        } catch (e) {
            console.warn("[TelegramBots] Failed to delete Telegram webhook:", e);
        }
    }

    // 2. Remove related InstanceChannelBindings
    const metadata = (connection.metadata ?? {}) as Record<string, unknown>;
    const botUsername = metadata.botUsername as string | undefined;
    if (botUsername) {
        try {
            await prisma.instanceChannelBinding.deleteMany({
                where: {
                    channelType: "telegram",
                    channelIdentifier: `bot:${botUsername}`
                }
            });
        } catch (e) {
            console.warn("[TelegramBots] Failed to clean up channel bindings:", e);
        }
    }

    // 3. Delete the connection
    await prisma.integrationConnection.delete({
        where: { id }
    });

    invalidateBindingCache();

    return NextResponse.json({
        success: true,
        deleted: true
    });
}
