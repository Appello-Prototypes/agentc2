import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getWhatsAppService, isWhatsAppEnabled } from "../_service";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/channels/whatsapp/qr
 *
 * Get QR code for WhatsApp pairing.
 * Returns base64 PNG data URL or connection status.
 */
export async function GET(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const enabled = await isWhatsAppEnabled(authContext.organizationId);

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

        const qrDataUrl = await QRCode.toDataURL(qrCode, {
            width: 300,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
        });

        return NextResponse.json({
            success: true,
            connected: false,
            qr: qrDataUrl,
            qrType: "image",
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
