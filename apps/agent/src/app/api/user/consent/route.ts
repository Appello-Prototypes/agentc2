import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

const VALID_CONSENT_TYPES = [
    "PRIVACY_POLICY",
    "TERMS_OF_SERVICE",
    "MARKETING",
    "DATA_PROCESSING"
] as const;

/**
 * POST /api/user/consent
 *
 * Record user consent. Writes to both User fields (legacy) and ConsentRecord.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await request.json();
        const { consentType, version, granted, termsAccepted, privacyConsent, marketingConsent } =
            body as {
                consentType?: string;
                version?: string;
                granted?: boolean;
                termsAccepted?: boolean;
                privacyConsent?: boolean;
                marketingConsent?: boolean;
            };

        // New ConsentRecord-based flow
        if (
            consentType &&
            VALID_CONSENT_TYPES.includes(consentType as (typeof VALID_CONSENT_TYPES)[number])
        ) {
            const ip =
                request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                request.headers.get("x-real-ip") ||
                null;
            const ua = request.headers.get("user-agent") || null;

            if (granted === false) {
                // Revoke: mark existing grants as revoked
                await prisma.consentRecord.updateMany({
                    where: {
                        userId,
                        consentType,
                        granted: true,
                        revokedAt: null
                    },
                    data: { revokedAt: new Date() }
                });

                await auditLog.create({
                    action: "CONSENT_REVOKE",
                    entityType: "ConsentRecord",
                    entityId: userId,
                    userId,
                    metadata: { consentType, version }
                });
            } else {
                // Grant: create new record
                await prisma.consentRecord.create({
                    data: {
                        userId,
                        consentType,
                        version: version || "1.0",
                        granted: true,
                        ipAddress: ip,
                        userAgent: ua
                    }
                });

                await auditLog.create({
                    action: "CONSENT_GRANT",
                    entityType: "ConsentRecord",
                    entityId: userId,
                    userId,
                    metadata: { consentType, version }
                });
            }

            return NextResponse.json({ success: true });
        }

        // Legacy User-field flow (backward compatible)
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
            where: { id: userId },
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
 * Get current user's consent status (legacy fields + ConsentRecord history).
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        const [user, records] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    termsAcceptedAt: true,
                    privacyConsentAt: true,
                    marketingConsent: true
                }
            }),
            prisma.consentRecord.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    consentType: true,
                    version: true,
                    granted: true,
                    createdAt: true,
                    revokedAt: true
                }
            })
        ]);

        return NextResponse.json({
            success: true,
            consent: user,
            records
        });
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
