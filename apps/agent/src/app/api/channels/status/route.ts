import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

/**
 * GET /api/channels/status
 *
 * Get status of all messaging channels.
 */
export async function GET() {
    try {
        const results: Record<string, unknown> = {};

        // WhatsApp status
        const whatsappEnabled = process.env.WHATSAPP_ENABLED === "true";
        if (whatsappEnabled) {
            try {
                const { isWhatsAppInitialized, getWhatsAppService } =
                    await import("../whatsapp/_service");
                if (isWhatsAppInitialized()) {
                    const service = await getWhatsAppService();
                    results.whatsapp = {
                        enabled: true,
                        status: service.getStatus(),
                        hasQR: !!service.getQRCode()
                    };
                } else {
                    results.whatsapp = {
                        enabled: true,
                        status: "not_initialized"
                    };
                }
            } catch (error) {
                results.whatsapp = {
                    enabled: true,
                    status: "error",
                    error: error instanceof Error ? error.message : "Unknown error"
                };
            }
        } else {
            results.whatsapp = { enabled: false, status: "disabled" };
        }

        // Telegram status
        const telegramEnabled = process.env.TELEGRAM_ENABLED === "true";
        const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        if (telegramEnabled && telegramBotToken) {
            try {
                const response = await fetch(
                    `https://api.telegram.org/bot${telegramBotToken}/getMe`
                );
                const data = await response.json();

                if (data.ok) {
                    results.telegram = {
                        enabled: true,
                        status: "connected",
                        bot: {
                            id: data.result.id,
                            username: data.result.username
                        }
                    };
                } else {
                    results.telegram = {
                        enabled: true,
                        status: "error",
                        error: data.description
                    };
                }
            } catch (error) {
                results.telegram = {
                    enabled: true,
                    status: "error",
                    error: error instanceof Error ? error.message : "Unknown error"
                };
            }
        } else {
            results.telegram = {
                enabled: telegramEnabled,
                status: telegramEnabled ? "not_configured" : "disabled"
            };
        }

        // Voice status
        const voiceEnabled = process.env.TWILIO_ENABLED === "true";
        if (voiceEnabled) {
            try {
                const { isVoiceInitialized, getVoiceService } = await import("../voice/_service");
                if (isVoiceInitialized()) {
                    const service = await getVoiceService();
                    results.voice = {
                        enabled: true,
                        status: service.getStatus(),
                        phoneNumber: process.env.TWILIO_PHONE_NUMBER,
                        activeCalls: service.getActiveCalls().length
                    };
                } else {
                    results.voice = {
                        enabled: true,
                        status: "not_initialized",
                        phoneNumber: process.env.TWILIO_PHONE_NUMBER
                    };
                }
            } catch (error) {
                results.voice = {
                    enabled: true,
                    status: "error",
                    error: error instanceof Error ? error.message : "Unknown error"
                };
            }
        } else {
            results.voice = { enabled: false, status: "disabled" };
        }

        // Get session counts
        const sessionCounts = await prisma.channelSession.groupBy({
            by: ["channel"],
            _count: true
        });

        const sessions = Object.fromEntries(sessionCounts.map((s) => [s.channel, s._count]));

        return NextResponse.json({
            channels: results,
            sessions,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Channels] Status error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
