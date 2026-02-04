import { NextRequest, NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

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
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;

        // Get current session token from cookies
        const cookieStore = await cookies();
        const currentToken = cookieStore.get("better-auth.session_token")?.value;

        // Find the session to delete
        const targetSession = await prisma.session.findFirst({
            where: {
                id: sessionId,
                userId: session.user.id
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
