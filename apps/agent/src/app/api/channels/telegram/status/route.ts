import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/channels/telegram/status
 *
 * Get Telegram bot status and session count.
 */
export async function GET() {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const enabled = process.env.TELEGRAM_ENABLED === "true";

        if (!enabled) {
            return NextResponse.json({
                enabled: false,
                status: "disabled",
                message: "Telegram channel is disabled"
            });
        }

        if (!botToken) {
            return NextResponse.json({
                enabled: true,
                status: "error",
                message: "TELEGRAM_BOT_TOKEN not configured"
            });
        }

        // Get bot info from Telegram
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const result = await response.json();

        if (!response.ok) {
            return NextResponse.json({
                enabled: true,
                status: "error",
                message: "Invalid bot token",
                error: result
            });
        }

        // Get session count
        const sessionCount = await prisma.channelSession.count({
            where: { channel: "telegram" }
        });

        // Get webhook info
        const webhookResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getWebhookInfo`
        );
        const webhookResult = await webhookResponse.json();

        return NextResponse.json({
            enabled: true,
            status: "connected",
            bot: {
                id: result.result.id,
                username: result.result.username,
                firstName: result.result.first_name,
                canJoinGroups: result.result.can_join_groups,
                canReadAllGroupMessages: result.result.can_read_all_group_messages,
                supportsInlineQueries: result.result.supports_inline_queries
            },
            webhook: {
                url: webhookResult.result?.url || null,
                hasCustomCertificate: webhookResult.result?.has_custom_certificate,
                pendingUpdateCount: webhookResult.result?.pending_update_count,
                lastErrorDate: webhookResult.result?.last_error_date,
                lastErrorMessage: webhookResult.result?.last_error_message
            },
            sessions: {
                total: sessionCount
            }
        });
    } catch (error) {
        console.error("[Telegram] Status error:", error);
        return NextResponse.json(
            {
                enabled: true,
                status: "error",
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/channels/telegram/status
 *
 * Set or remove webhook URL.
 *
 * Body:
 * - webhookUrl: string | null - URL to set, or null to remove
 * - secretToken?: string - Optional secret token for webhook verification
 */
export async function POST(request: Request) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            return NextResponse.json(
                { error: "TELEGRAM_BOT_TOKEN not configured" },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { webhookUrl, secretToken } = body;

        if (webhookUrl === null) {
            // Remove webhook
            const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
            const result = await response.json();

            return NextResponse.json({
                success: result.ok,
                message: result.ok ? "Webhook removed" : "Failed to remove webhook"
            });
        }

        // Set webhook
        const params: Record<string, string> = { url: webhookUrl };
        if (secretToken) {
            params.secret_token = secretToken;
        }

        const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params)
        });
        const result = await response.json();

        return NextResponse.json({
            success: result.ok,
            message: result.ok ? "Webhook set" : "Failed to set webhook",
            description: result.description
        });
    } catch (error) {
        console.error("[Telegram] Webhook config error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
