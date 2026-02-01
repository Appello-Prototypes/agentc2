import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { getWhatsAppService, isWhatsAppInitialized } from "../_service";

/**
 * GET /api/channels/whatsapp/status
 *
 * Get WhatsApp connection status.
 */
export async function GET() {
    try {
        const enabled = process.env.WHATSAPP_ENABLED === "true";

        if (!enabled) {
            return NextResponse.json({
                enabled: false,
                status: "disabled",
                message: "WhatsApp channel is disabled"
            });
        }

        if (!isWhatsAppInitialized()) {
            return NextResponse.json({
                enabled: true,
                status: "not_initialized",
                message: "WhatsApp service not initialized. Call /qr endpoint to start."
            });
        }

        const service = await getWhatsAppService();
        const status = service.getStatus();
        const hasQR = !!service.getQRCode();

        // Get session count
        const sessionCount = await prisma.channelSession.count({
            where: { channel: "whatsapp" }
        });

        return NextResponse.json({
            enabled: true,
            status,
            connected: status === "connected",
            hasQR,
            sessions: {
                total: sessionCount
            },
            config: {
                defaultAgentSlug: process.env.WHATSAPP_DEFAULT_AGENT_SLUG || "mcp-agent",
                allowlistConfigured: !!process.env.WHATSAPP_ALLOWLIST
            }
        });
    } catch (error) {
        console.error("[WhatsApp] Status error:", error);
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
 * POST /api/channels/whatsapp/status
 *
 * Control WhatsApp connection.
 *
 * Body:
 * - action: "connect" | "disconnect" | "logout"
 */
export async function POST(request: Request) {
    try {
        const enabled = process.env.WHATSAPP_ENABLED === "true";

        if (!enabled) {
            return NextResponse.json({ error: "WhatsApp channel is disabled" }, { status: 400 });
        }

        const body = await request.json();
        const { action } = body;

        const service = await getWhatsAppService();

        switch (action) {
            case "connect":
                if (service.getStatus() === "disconnected") {
                    await service.initialize();
                }
                return NextResponse.json({
                    success: true,
                    message: "Connection initiated. Check /qr for QR code."
                });

            case "disconnect":
                await service.shutdown();
                return NextResponse.json({
                    success: true,
                    message: "Disconnected"
                });

            case "logout":
                // This would clear the session and require re-pairing
                await service.shutdown();
                // TODO: Clear session files
                return NextResponse.json({
                    success: true,
                    message: "Logged out. You'll need to scan QR code again."
                });

            default:
                return NextResponse.json(
                    { error: "Invalid action. Use: connect, disconnect, logout" },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error("[WhatsApp] Action error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
