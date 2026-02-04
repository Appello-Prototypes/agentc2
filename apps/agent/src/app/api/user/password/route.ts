import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { compare, hash } from "bcryptjs";

/**
 * POST /api/user/password
 *
 * Change current user's password
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
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { success: false, error: "Current and new password are required" },
                { status: 400 }
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { success: false, error: "Password must be at least 8 characters" },
                { status: 400 }
            );
        }

        // Get the user's account with password
        const account = await prisma.account.findFirst({
            where: {
                userId: session.user.id,
                providerId: "credential"
            }
        });

        if (!account || !account.password) {
            return NextResponse.json(
                { success: false, error: "No password set for this account" },
                { status: 400 }
            );
        }

        // Verify current password
        const isValid = await compare(currentPassword, account.password);
        if (!isValid) {
            return NextResponse.json(
                { success: false, error: "Current password is incorrect" },
                { status: 400 }
            );
        }

        // Hash and update the new password
        const hashedPassword = await hash(newPassword, 12);
        await prisma.account.update({
            where: { id: account.id },
            data: { password: hashedPassword }
        });

        return NextResponse.json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (error) {
        console.error("[User Password] Error changing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to change password"
            },
            { status: 500 }
        );
    }
}
