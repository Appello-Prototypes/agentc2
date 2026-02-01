import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppService } from "../_service";

/**
 * POST /api/channels/whatsapp/send
 *
 * Send a message via WhatsApp.
 *
 * Body:
 * - to: string - Phone number (with country code, e.g., +15551234567)
 * - text: string - Message text
 * - replyToMessageId?: string - Optional message ID to reply to
 */
export async function POST(request: NextRequest) {
    try {
        const enabled = process.env.WHATSAPP_ENABLED === "true";

        if (!enabled) {
            return NextResponse.json({ error: "WhatsApp channel is disabled" }, { status: 400 });
        }

        const body = await request.json();
        const { to, text, replyToMessageId } = body;

        if (!to || !text) {
            return NextResponse.json(
                { error: "Missing required fields: to, text" },
                { status: 400 }
            );
        }

        const service = await getWhatsAppService();
        const status = service.getStatus();

        if (status !== "connected") {
            return NextResponse.json(
                { error: `WhatsApp not connected (status: ${status})` },
                { status: 503 }
            );
        }

        const result = await service.send({
            channel: "whatsapp",
            to,
            text,
            replyToMessageId
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || "Failed to send message" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            messageId: result.messageId,
            timestamp: result.timestamp
        });
    } catch (error) {
        console.error("[WhatsApp] Send error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
