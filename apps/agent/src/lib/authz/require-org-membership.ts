import { NextResponse } from "next/server";
import { prisma } from "@repo/database";

export async function resolveOrganizationId(orgRef: string): Promise<string | null> {
    const organization = await prisma.organization.findFirst({
        where: {
            OR: [{ id: orgRef }, { slug: orgRef }]
        },
        select: { id: true }
    });
    return organization?.id ?? null;
}

export async function requireOrgMembership(
    userId: string,
    orgRef: string
): Promise<
    | { organizationId: string; response?: undefined }
    | { organizationId?: undefined; response: NextResponse }
> {
    const organizationId = await resolveOrganizationId(orgRef);
    if (!organizationId) {
        return {
            response: NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            )
        };
    }

    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId
            }
        },
        select: { id: true }
    });

    if (!membership) {
        return {
            response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
        };
    }

    return { organizationId };
}
