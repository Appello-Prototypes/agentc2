import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

/**
 * DELETE /api/user/account
 *
 * Delete the current user's account (GDPR right-to-be-forgotten).
 * Steps:
 *   1. Remove all organization memberships
 *   2. Cascade-delete Account, Session, IntegrationConnection records
 *   3. Anonymize the User record
 *   4. Log the deletion
 */
export async function DELETE() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        const memberships = await prisma.membership.findMany({
            where: { userId },
            select: { organizationId: true, role: true }
        });

        for (const m of memberships) {
            if (m.role === "owner") {
                const otherOwners = await prisma.membership.count({
                    where: {
                        organizationId: m.organizationId,
                        role: "owner",
                        userId: { not: userId }
                    }
                });
                if (otherOwners === 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: "You are the sole owner of an organization. Transfer ownership before deleting your account."
                        },
                        { status: 400 }
                    );
                }
            }
        }

        await prisma.membership.deleteMany({ where: { userId } });

        await prisma.integrationConnection.deleteMany({ where: { userId } });

        await prisma.session.deleteMany({ where: { userId } });

        await prisma.account.deleteMany({ where: { userId } });

        const deletedEmail = `deleted-${userId}@redacted.local`;
        await prisma.user.update({
            where: { id: userId },
            data: {
                name: "Deleted User",
                email: deletedEmail,
                image: null,
                timezone: null,
                termsAcceptedAt: null,
                privacyConsentAt: null,
                marketingConsent: false
            }
        });

        await auditLog.create({
            action: "ORG_DELETE",
            entityType: "User",
            entityId: userId,
            userId,
            metadata: {
                type: "user-self-deletion",
                organizationsRemoved: memberships.map((m) => m.organizationId)
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[User Account Deletion] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete account"
            },
            { status: 500 }
        );
    }
}
