import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

/**
 * GET /api/user/timezone
 *
 * Returns the effective timezone for the current user.
 * Priority: user.timezone > organization.timezone > "UTC"
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
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
            where: { userId: session.user.id },
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
