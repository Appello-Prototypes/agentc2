import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireOrgRole } from "@/lib/authz/require-org-role";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    const { id } = await params;

    try {
        const partner = await prisma.embedPartner.findUnique({
            where: { id },
            select: { organizationId: true }
        });
        if (!partner || partner.organizationId !== organizationId) {
            return NextResponse.json(
                { success: false, error: "Partner not found" },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.toLowerCase();

        const users = await prisma.embedPartnerUser.findMany({
            where: {
                partnerId: id,
                ...(search
                    ? {
                          OR: [
                              { name: { contains: search, mode: "insensitive" as const } },
                              { email: { contains: search, mode: "insensitive" as const } },
                              { externalUserId: { contains: search, mode: "insensitive" as const } }
                          ]
                      }
                    : {})
            },
            include: {
                user: {
                    select: { id: true, email: true, name: true }
                }
            },
            orderBy: { lastSeenAt: { sort: "desc", nulls: "last" } },
            take: 100
        });

        return NextResponse.json({
            success: true,
            users: users.map((u) => ({
                id: u.id,
                externalUserId: u.externalUserId,
                email: u.email,
                name: u.name,
                linkedUser: u.user
                    ? { id: u.user.id, email: u.user.email, name: u.user.name }
                    : null,
                lastSeenAt: u.lastSeenAt,
                createdAt: u.createdAt
            }))
        });
    } catch (error) {
        console.error("[EmbedPartners API] List users error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list partner users"
            },
            { status: 500 }
        );
    }
}
