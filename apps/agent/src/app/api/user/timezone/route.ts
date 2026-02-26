import { NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireUser } from "@/lib/authz/require-auth";

/**
 * GET /api/user/timezone
 *
 * Returns the effective timezone for the current user.
 * Priority: user.timezone > organization.timezone > "UTC"
 */
export async function GET() {
    try {
        const authResult = await requireUser();
        if (authResult.response) return authResult.response;

        const { userId } = authResult.context;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { timezone: true }
        });

        if (user?.timezone) {
            return NextResponse.json({
                success: true,
                timezone: user.timezone,
                source: "user"
            });
        }

        const membership = await prisma.membership.findFirst({
            where: { userId },
            orderBy: { createdAt: "asc" },
            include: {
                organization: {
                    select: { timezone: true }
                }
            }
        });

        if (membership?.organization?.timezone) {
            return NextResponse.json({
                success: true,
                timezone: membership.organization.timezone,
                source: "organization"
            });
        }

        return NextResponse.json({
            success: true,
            timezone: "UTC",
            source: "default"
        });
    } catch (error) {
        console.error("[User Timezone] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch timezone"
            },
            { status: 500 }
        );
    }
}
