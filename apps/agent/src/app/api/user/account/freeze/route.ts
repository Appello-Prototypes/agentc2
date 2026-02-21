import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

/**
 * POST /api/user/account/freeze
 *
 * Freeze or unfreeze the current user's account (GDPR Art. 18 restriction of processing).
 * Frozen accounts: authentication succeeds but all agent/tool execution is blocked.
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
        const { freeze } = body as { freeze?: boolean };

        if (typeof freeze !== "boolean") {
            return NextResponse.json(
                { success: false, error: "Missing required field: freeze (boolean)" },
                { status: 400 }
            );
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { status: true }
        });

        if (!currentUser) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }

        if (currentUser.status === "deleted") {
            return NextResponse.json(
                { success: false, error: "Account has been deleted" },
                { status: 400 }
            );
        }

        const newStatus = freeze ? "frozen" : "active";

        if (currentUser.status === newStatus) {
            return NextResponse.json({
                success: true,
                message: `Account is already ${newStatus}`,
                status: newStatus
            });
        }

        await prisma.user.update({
            where: { id: userId },
            data: { status: newStatus }
        });

        await auditLog.create({
            action: freeze ? "ACCOUNT_FREEZE" : "ACCOUNT_UNFREEZE",
            entityType: "User",
            entityId: userId,
            userId,
            metadata: {
                previousStatus: currentUser.status,
                newStatus
            }
        });

        // Create a DSR record for the restriction request
        if (freeze) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true }
            });

            await prisma.dataSubjectRequest.create({
                data: {
                    type: "RESTRICTION",
                    status: "COMPLETED",
                    requestorEmail: user?.email || "",
                    requestorUserId: userId,
                    notes: "Self-service account freeze via API (GDPR Art. 18)",
                    completedAt: new Date()
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: freeze
                ? "Account frozen. Agent execution and tool access have been restricted."
                : "Account unfrozen. Normal access has been restored.",
            status: newStatus
        });
    } catch (error) {
        console.error("[Account Freeze] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update account status"
            },
            { status: 500 }
        );
    }
}
