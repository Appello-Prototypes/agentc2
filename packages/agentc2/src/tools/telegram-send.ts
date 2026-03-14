import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { decryptCredentials } from "../crypto";
import { formatForTelegram } from "../channels/telegram/format";

const FETCH_TIMEOUT_MS = 10_000;

async function resolveTelegramBotToken(organizationId?: string): Promise<string | null> {
    if (process.env.TELEGRAM_BOT_TOKEN) {
        return process.env.TELEGRAM_BOT_TOKEN;
    }

    try {
        const { prisma } = await import("@repo/database");
        const connection = await prisma.integrationConnection.findFirst({
            where: {
                provider: { key: "telegram-bot" },
                isActive: true,
                ...(organizationId ? { organizationId } : {})
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            select: { credentials: true }
        });

        if (!connection?.credentials) return null;

        const creds = decryptCredentials(connection.credentials);
        const token =
            (typeof creds.TELEGRAM_BOT_TOKEN === "string" && creds.TELEGRAM_BOT_TOKEN) ||
            (typeof creds.botToken === "string" && creds.botToken) ||
            (typeof creds.token === "string" && creds.token);
        return token || null;
    } catch {
        return null;
    }
}

export const telegramSendMessageTool = createTool({
    id: "telegram-send-message",
    description:
        "Send a proactive message to a Telegram chat (individual or group). " +
        "Use this to notify users about tee time availability, booking confirmations, " +
        "group poll announcements, or any message that isn't a direct reply to an incoming message. " +
        "Group chat IDs are negative numbers (e.g., -100123456789).",
    inputSchema: z.object({
        chatId: z
            .string()
            .describe(
                "Telegram chat ID to send to. Negative for groups (e.g., '-100123456789'). " +
                    "Get this from request metadata (platform context) or stored documents."
            ),
        text: z
            .string()
            .max(4000)
            .describe("Message text. Supports Markdown formatting (bold, italic, code)."),
        parseMode: z
            .enum(["Markdown", "HTML"])
            .optional()
            .default("Markdown")
            .describe("Parse mode for message formatting (default: Markdown)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        messageId: z.number().optional(),
        chatId: z.string().optional(),
        error: z.string().optional()
    }),
    execute: async ({ chatId, text, parseMode = "Markdown" }) => {
        const botToken = await resolveTelegramBotToken();
        if (!botToken) {
            return {
                success: false,
                error:
                    "Telegram bot token not configured. " +
                    "Set TELEGRAM_BOT_TOKEN in environment or add a telegram-bot integration connection."
            };
        }

        const formattedText = formatForTelegram(text);

        try {
            let response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: formattedText,
                    parse_mode: "HTML"
                }),
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
            });

            if (!response.ok) {
                response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text
                    }),
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
                });
            }

            const result = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    chatId,
                    error: `Telegram API error ${response.status}: ${result.description || JSON.stringify(result)}`
                };
            }

            return {
                success: true,
                messageId: result.result?.message_id,
                chatId
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                chatId,
                error: `Failed to send Telegram message: ${msg}`
            };
        }
    }
});
