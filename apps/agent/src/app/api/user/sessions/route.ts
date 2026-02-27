import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@repo/database";
import { requireUser } from "@/lib/authz/require-auth";

/**
 * GET /api/user/sessions
 *
 * List current user's active sessions
 */
export async function GET() {
    try {
        const authResult = await requireUser();
        if (authResult.response) return authResult.response;

        const { userId } = authResult.context;

        const cookieStore = await cookies();
        const currentToken = cookieStore.get("better-auth.session_token")?.value;

        const sessions = await prisma.session.findMany({
            where: {
                userId,
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
        const authResult = await requireUser();
        if (authResult.response) return authResult.response;

        const { userId } = authResult.context;

        const cookieStore = await cookies();
        const currentToken = cookieStore.get("better-auth.session_token")?.value;

        const result = await prisma.session.deleteMany({
            where: {
                userId,
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
