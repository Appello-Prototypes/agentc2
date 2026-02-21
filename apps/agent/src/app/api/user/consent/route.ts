import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

/**
 * POST /api/user/consent
 *
 * Record user consent for terms of service, privacy policy, and/or marketing.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { termsAccepted, privacyConsent, marketingConsent } = body as {
            termsAccepted?: boolean;
            privacyConsent?: boolean;
            marketingConsent?: boolean;
        };

        const updateData: Record<string, unknown> = {};
        const now = new Date();

        if (termsAccepted === true) {
            updateData.termsAcceptedAt = now;
        }
        if (privacyConsent === true) {
            updateData.privacyConsentAt = now;
        }
        if (marketingConsent !== undefined) {
            updateData.marketingConsent = !!marketingConsent;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { success: false, error: "No consent fields provided" },
                { status: 400 }
            );
        }

        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: updateData,
            select: {
                id: true,
                termsAcceptedAt: true,
                privacyConsentAt: true,
                marketingConsent: true
            }
        });

        return NextResponse.json({ success: true, consent: user });
    } catch (error) {
        console.error("[User Consent] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to record consent"
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/user/consent
 *
 * Get current user's consent status.
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                termsAcceptedAt: true,
                privacyConsentAt: true,
                marketingConsent: true
            }
        });

        return NextResponse.json({ success: true, consent: user });
    } catch (error) {
        console.error("[User Consent] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get consent status"
            },
            { status: 500 }
        );
    }
}
