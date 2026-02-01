import { NextResponse } from "next/server";
import { getWhatsAppService } from "../_service";

/**
 * GET /api/channels/whatsapp/qr
 *
 * Get QR code for WhatsApp pairing.
 * Returns base64 encoded QR image or connection status.
 */
export async function GET() {
    try {
        const enabled = process.env.WHATSAPP_ENABLED === "true";

        if (!enabled) {
            return NextResponse.json({
                success: false,
                error: "WhatsApp channel is disabled"
            });
        }

        const service = await getWhatsAppService();
        const status = service.getStatus();

        if (status === "connected") {
            return NextResponse.json({
                success: true,
                connected: true,
                message: "Already connected to WhatsApp"
            });
        }

        const qrCode = service.getQRCode();

        if (!qrCode) {
            return NextResponse.json({
                success: true,
                connected: false,
                qr: null,
                message: "Connecting... QR code will appear shortly. Refresh in a few seconds."
            });
        }

        // Generate QR code as data URL using qrcode-terminal format
        // Note: For a proper QR image, you'd use the 'qrcode' package
        return NextResponse.json({
            success: true,
            connected: false,
            qr: qrCode,
            qrType: "text", // Terminal-style QR
            message: "Scan this QR code with WhatsApp (Settings > Linked Devices > Link a Device)"
        });
    } catch (error) {
        console.error("[WhatsApp] QR error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
