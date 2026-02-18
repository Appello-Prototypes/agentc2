import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/organizations/search?q=term
 *
 * Search for organizations by name or slug.
 * Excludes the requesting user's own org and orgs already connected.
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q")?.trim();

        if (!q || q.length < 2) {
            return NextResponse.json({ success: true, organizations: [] });
        }

        const existingAgreements = await prisma.federationAgreement.findMany({
            where: {
                OR: [
                    { initiatorOrgId: authContext.organizationId },
                    { responderOrgId: authContext.organizationId }
                ],
                status: { in: ["pending", "active"] }
            },
            select: { initiatorOrgId: true, responderOrgId: true }
        });

        const connectedOrgIds = new Set<string>();
        connectedOrgIds.add(authContext.organizationId);
        for (const a of existingAgreements) {
            connectedOrgIds.add(a.initiatorOrgId);
            connectedOrgIds.add(a.responderOrgId);
        }

        const organizations = await prisma.organization.findMany({
            where: {
                status: "active",
                id: { notIn: Array.from(connectedOrgIds) },
                OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { slug: { contains: q, mode: "insensitive" } }
                ]
            },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                logoUrl: true,
                createdAt: true
            },
            take: 10,
            orderBy: { name: "asc" }
        });

        return NextResponse.json({ success: true, organizations });
    } catch (error) {
        console.error("[OrgSearch] Error:", error);
        return NextResponse.json({ success: false, error: "Search failed" }, { status: 500 });
    }
}
