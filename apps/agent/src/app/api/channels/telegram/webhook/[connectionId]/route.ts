/**
 * POST /api/channels/telegram/webhook/[connectionId]
 *
 * Per-bot webhook endpoint for multi-bot Telegram architecture.
 * Each IntegrationConnection gets its own webhook URL so we can
 * route messages to the correct agent or agent instance.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { decryptCredentials } from "@/lib/credential-crypto";
import {
    handleTelegramMessage,
    handleCallbackQuery,
    handleEngagementFeedbackReply,
    isDuplicate,
    type TelegramHandlerContext
} from "@/lib/telegram-handler";
import { type InstanceContext } from "@/lib/agent-instances";

interface ConnectionMetadata {
    botUsername?: string;
    botId?: number;
    agentSlug?: string;
    instanceId?: string;
}

async function resolveConnectionContext(connectionId: string): Promise<{
    botToken: string;
    organizationId: string;
    metadata: ConnectionMetadata;
    webhookSecret?: string;
} | null> {
    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId },
        include: { provider: true }
    });

    if (!connection || !connection.isActive || connection.provider.key !== "telegram-bot") {
        return null;
    }

    const decrypted = decryptCredentials(connection.credentials);
    if (!decrypted || typeof decrypted !== "object" || Array.isArray(decrypted)) {
        return null;
    }

    const creds = decrypted as Record<string, string>;
    const botToken = creds.TELEGRAM_BOT_TOKEN;
    if (!botToken) return null;

    const metadata = (connection.metadata ?? {}) as ConnectionMetadata;

    return {
        botToken,
        organizationId: connection.organizationId,
        metadata,
        webhookSecret: creds.TELEGRAM_WEBHOOK_SECRET
    };
}

async function loadInstanceContext(instanceId: string): Promise<InstanceContext | null> {
    const instance = await prisma.agentInstance.findUnique({
        where: { id: instanceId },
        include: {
            agent: { select: { id: true, slug: true, name: true } }
        }
    });

    if (!instance || !instance.isActive) return null;

    const contextData =
        instance.contextData && typeof instance.contextData === "object"
            ? (instance.contextData as Record<string, unknown>)
            : null;

    return {
        instanceId: instance.id,
        instanceName: instance.name,
        instanceSlug: instance.slug,
        agentId: instance.agent.id,
        agentSlug: instance.agent.slug,
        organizationId: instance.organizationId,
        contextType: instance.contextType,
        contextId: instance.contextId,
        contextData,
        instructionOverrides: instance.instructionOverrides,
        memoryNamespace: instance.memoryNamespace,
        ragCollectionId: instance.ragCollectionId,
        temperatureOverride: instance.temperatureOverride,
        maxStepsOverride: instance.maxStepsOverride,
        replyMode: null,
        responseLength: null,
        richFormatting: null,
        triggerOnAllMessages: true,
        triggerKeywords: [],
        triggerOnFileUpload: false,
        allowedUserIds: [],
        blockedUserIds: []
    };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    const { connectionId } = await params;

    const connCtx = await resolveConnectionContext(connectionId);
    if (!connCtx) {
        return NextResponse.json({ error: "Unknown bot" }, { status: 404 });
    }

    // Validate webhook secret if configured
    if (connCtx.webhookSecret) {
        const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
        if (secretToken !== connCtx.webhookSecret) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const update = await request.json();
        console.log(
            `[Telegram][${connCtx.metadata.botUsername || connectionId}] Received update:`,
            JSON.stringify(update).substring(0, 200)
        );

        if (update.update_id && isDuplicate(update.update_id)) {
            return NextResponse.json({ ok: true });
        }

        // Build handler context from connection metadata
        let fixedInstance: InstanceContext | null | undefined = undefined;
        if (connCtx.metadata.instanceId) {
            fixedInstance = await loadInstanceContext(connCtx.metadata.instanceId);
        }

        const ctx: TelegramHandlerContext = {
            botToken: connCtx.botToken,
            organizationId: connCtx.organizationId,
            fixedAgentSlug: fixedInstance?.agentSlug ?? connCtx.metadata.agentSlug,
            fixedInstance
        };

        if (update.message) {
            const chatId = update.message.chat?.id?.toString();
            const text = (update.message.text || "").trim();
            const userId = update.message.from?.id?.toString() || chatId || "";
            // Check if this message is feedback for a pending engagement
            if (chatId && text) {
                const handled = await handleEngagementFeedbackReply(chatId, text, userId, ctx);
                if (handled) {
                    return NextResponse.json({ ok: true });
                }
            }
            await handleTelegramMessage(update.message, ctx);
        }

        if (update.callback_query) {
            await handleCallbackQuery(update.callback_query, ctx);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error(
            `[Telegram][${connCtx.metadata.botUsername || connectionId}] Webhook error:`,
            error
        );
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
