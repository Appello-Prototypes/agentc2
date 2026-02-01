import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/channels/telegram/send
 *
 * Send a message to a Telegram chat.
 *
 * Body:
 * - chatId: string - The chat ID to send to
 * - text: string - The message text
 * - replyToMessageId?: number - Optional message ID to reply to
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { chatId, text, replyToMessageId } = body;

        if (!chatId || !text) {
            return NextResponse.json(
                { error: "Missing required fields: chatId, text" },
                { status: 400 }
            );
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            return NextResponse.json(
                { error: "TELEGRAM_BOT_TOKEN not configured" },
                { status: 500 }
            );
        }

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                reply_parameters: replyToMessageId ? { message_id: replyToMessageId } : undefined
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: "Telegram API error", details: result },
                { status: response.status }
            );
        }

        return NextResponse.json({
            success: true,
            messageId: result.result?.message_id,
            chatId
        });
    } catch (error) {
        console.error("[Telegram] Send error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
