import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

const DEFAULT_ADMIN_ROLES = new Set(["owner", "admin"]);

export async function requireOrgRole(
    userId: string,
    organizationId: string,
    allowedRoles: string[] = [...DEFAULT_ADMIN_ROLES]
): Promise<{ role: string; response?: undefined } | { role?: undefined; response: NextResponse }> {
    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId
            }
        },
        select: { role: true }
    });

    if (!membership) {
        return {
            response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
        };
    }

    if (!allowedRoles.includes(membership.role)) {
        return {
            response: NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            )
        };
    }

    return { role: membership.role };
}
