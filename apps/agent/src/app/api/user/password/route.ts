import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { compare, hash } from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit-policy";

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
        const rate = await checkRateLimit(
            `password-change:${session.user.id}`,
            RATE_LIMIT_POLICIES.auth
        );
        if (!rate.allowed) {
            return NextResponse.json(
                { success: false, error: "Rate limit exceeded" },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { success: false, error: "Current and new password are required" },
                { status: 400 }
            );
        }

        const hasLength = newPassword.length >= 12;
        const hasUpper = /[A-Z]/.test(newPassword);
        const hasLower = /[a-z]/.test(newPassword);
        const hasNumber = /\d/.test(newPassword);
        const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
        if (!(hasLength && hasUpper && hasLower && hasNumber && hasSymbol)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Password must be at least 12 characters and include uppercase, lowercase, number, and symbol"
                },
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
