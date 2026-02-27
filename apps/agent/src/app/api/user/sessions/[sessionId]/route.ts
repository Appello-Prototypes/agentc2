import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@repo/database";
import { requireUser } from "@/lib/authz/require-auth";

/**
 * DELETE /api/user/sessions/[sessionId]
 *
 * Revoke a specific session
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const authResult = await requireUser();
        if (authResult.response) return authResult.response;

        const { userId } = authResult.context;

        const { sessionId } = await params;

        const cookieStore = await cookies();
        const currentToken = cookieStore.get("better-auth.session_token")?.value;

        const targetSession = await prisma.session.findFirst({
            where: {
                id: sessionId,
                userId
            }
        });

        if (!targetSession) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            );
        }

        // Don't allow revoking current session
        if (targetSession.token === currentToken) {
            return NextResponse.json(
                { success: false, error: "Cannot revoke current session" },
                { status: 400 }
            );
        }

        // Delete the session
        await prisma.session.delete({
            where: { id: sessionId }
        });

        return NextResponse.json({
            success: true,
            message: "Session revoked"
        });
    } catch (error) {
        console.error("[User Sessions] Error revoking:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to revoke session"
            },
            { status: 500 }
        );
    }
}
