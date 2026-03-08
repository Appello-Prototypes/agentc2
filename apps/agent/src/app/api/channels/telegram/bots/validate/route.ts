/**
 * POST /api/channels/telegram/bots/validate
 *
 * Server-side proxy for validating a Telegram bot token via getMe().
 * Avoids CSP issues from calling api.telegram.org directly from the browser.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

export async function POST(request: NextRequest) {
    const authContext = await authenticateRequest(request)
    if (!authContext) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        )
    }

    try {
        const { botToken } = (await request.json()) as {
            botToken?: string
        }

        if (!botToken?.trim()) {
            return NextResponse.json(
                { success: false, error: "botToken is required" },
                { status: 400 }
            )
        }

        const res = await fetch(
            `https://api.telegram.org/bot${botToken.trim()}/getMe`
        )
        const data = await res.json()

        if (data.ok) {
            return NextResponse.json({
                success: true,
                bot: {
                    username: data.result.username,
                    firstName: data.result.first_name,
                    id: data.result.id,
                },
            })
        }

        return NextResponse.json(
            {
                success: false,
                error: "Invalid bot token. Make sure you copied it correctly from @BotFather.",
            },
            { status: 400 }
        )
    } catch (error) {
        console.error("[TelegramBots] Validate error:", error)
        return NextResponse.json(
            {
                success: false,
                error: "Failed to reach Telegram API",
            },
            { status: 502 }
        )
    }
}
