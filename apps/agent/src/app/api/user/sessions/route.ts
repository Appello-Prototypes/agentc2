import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

/**
 * GET /api/user/sessions
 *
 * List current user's active sessions
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Get current session token from cookies
        const cookieStore = await cookies();
        const currentToken = cookieStore.get("better-auth.session_token")?.value;

        const sessions = await prisma.session.findMany({
            where: {
                userId: session.user.id,
                expiresAt: { gt: new Date() }
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                token: true,
                ipAddress: true,
                userAgent: true,
                createdAt: true,
                expiresAt: true
            }
        });

        return NextResponse.json({
            success: true,
            sessions: sessions.map((s) => ({
                id: s.id,
                ipAddress: s.ipAddress,
                userAgent: s.userAgent,
                createdAt: s.createdAt,
                expiresAt: s.expiresAt,
                isCurrent: s.token === currentToken
            }))
        });
    } catch (error) {
        console.error("[User Sessions] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list sessions"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/user/sessions
 *
 * Revoke all sessions except current
 */
export async function DELETE() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Get current session token from cookies
        const cookieStore = await cookies();
        const currentToken = cookieStore.get("better-auth.session_token")?.value;

        // Delete all sessions except current
        const result = await prisma.session.deleteMany({
            where: {
                userId: session.user.id,
                token: { not: currentToken }
            }
        });

        return NextResponse.json({
            success: true,
            revokedCount: result.count
        });
    } catch (error) {
        console.error("[User Sessions] Error revoking all:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to revoke sessions"
            },
            { status: 500 }
        );
    }
}
