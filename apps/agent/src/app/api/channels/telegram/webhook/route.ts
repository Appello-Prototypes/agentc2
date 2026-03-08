/**
 * POST /api/channels/telegram/webhook
 *
 * Legacy single-bot webhook endpoint. Resolves the first active
 * telegram-bot IntegrationConnection and delegates to the shared handler.
 * Kept for backward compatibility -- new bots use /webhook/[connectionId].
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { resolveChannelCredentials } from "@/lib/channel-credentials";
import {
    handleTelegramMessage,
    handleCallbackQuery,
    isDuplicate,
    type TelegramHandlerContext
} from "@/lib/telegram-handler";

const FALLBACK_AGENT_SLUG = "bigjim2-appello";

let _cachedCreds: Record<string, string> | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 60_000;

async function resolveOrganizationId(): Promise<string | undefined> {
    const connection = await prisma.integrationConnection.findFirst({
        where: { provider: { key: "telegram-bot" }, isActive: true },
        select: { organizationId: true }
    });
    return connection?.organizationId ?? undefined;
}

async function getTelegramCredentials(): Promise<Record<string, string>> {
    const now = Date.now();
    if (!_cachedCreds || now - _cachedAt > CACHE_TTL_MS) {
        const orgId = await resolveOrganizationId();
        const { credentials } = await resolveChannelCredentials("telegram-bot", orgId);
        _cachedCreds = credentials;
        _cachedAt = now;
    }
    return _cachedCreds;
}

function getTelegramBotToken(creds: Record<string, string>): string | undefined {
    return creds.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
}

function getDefaultAgentSlug(creds: Record<string, string>): string {
    return (
        creds.TELEGRAM_DEFAULT_AGENT_SLUG ||
        process.env.TELEGRAM_DEFAULT_AGENT_SLUG ||
        FALLBACK_AGENT_SLUG
    );
}

function validateBotToken(request: NextRequest, creds: Record<string, string>): boolean {
    const configuredToken = getTelegramBotToken(creds);
    if (!configuredToken) {
        console.warn("[Telegram] TELEGRAM_BOT_TOKEN not configured");
        return false;
    }

    const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
    const expectedSecret = creds.TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;

    if (process.env.NODE_ENV === "production" && expectedSecret) {
        if (!secretToken || secretToken !== expectedSecret) {
            return false;
        }
    } else if (secretToken && expectedSecret && secretToken !== expectedSecret) {
        return false;
    }

    return true;
}

export async function POST(request: NextRequest) {
    const creds = await getTelegramCredentials();
    if (!validateBotToken(request, creds)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const update = await request.json();
        console.log("[Telegram] Received update:", JSON.stringify(update).substring(0, 200));

        if (update.update_id && isDuplicate(update.update_id)) {
            console.log(`[Telegram] Duplicate update_id ${update.update_id}, ignoring`);
            return NextResponse.json({ ok: true });
        }

        const botToken = getTelegramBotToken(creds)!;
        const channelOrgId = await resolveOrganizationId();

        const ctx: TelegramHandlerContext = {
            botToken,
            organizationId: channelOrgId,
            fixedAgentSlug:
                getDefaultAgentSlug(creds) !== FALLBACK_AGENT_SLUG
                    ? getDefaultAgentSlug(creds)
                    : undefined
        };

        if (update.message) {
            await handleTelegramMessage(update.message, ctx);
        }

        if (update.callback_query) {
            await handleCallbackQuery(update.callback_query, ctx);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[Telegram] Webhook error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
