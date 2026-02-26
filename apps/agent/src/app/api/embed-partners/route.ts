import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireOrgRole } from "@/lib/authz/require-org-role";
import { generateSigningSecret } from "@/lib/embed-identity";

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    try {
        const partners = await prisma.embedPartner.findMany({
            where: { organizationId },
            include: {
                _count: {
                    select: { deployments: true, users: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            partners: partners.map((p) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                isActive: p.isActive,
                allowedDomains: p.allowedDomains,
                tokenMaxAgeSec: p.tokenMaxAgeSec,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
                _count: p._count
            }))
        });
    } catch (error) {
        console.error("[EmbedPartners API] List error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list partners"
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    try {
        const body = await request.json();
        const { name, slug, allowedDomains, tokenMaxAgeSec } = body as {
            name?: string;
            slug?: string;
            allowedDomains?: string[];
            tokenMaxAgeSec?: number;
        };

        if (!name || !slug) {
            return NextResponse.json(
                { success: false, error: "name and slug are required" },
                { status: 400 }
            );
        }

        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "slug must be lowercase alphanumeric with hyphens, cannot start or end with a hyphen"
                },
                { status: 400 }
            );
        }

        const existing = await prisma.embedPartner.findUnique({
            where: { slug },
            select: { id: true }
        });
        if (existing) {
            return NextResponse.json(
                { success: false, error: "A partner with this slug already exists" },
                { status: 409 }
            );
        }

        const signingSecret = generateSigningSecret();

        const partner = await prisma.embedPartner.create({
            data: {
                organizationId,
                name,
                slug,
                signingSecret,
                allowedDomains: allowedDomains || [],
                tokenMaxAgeSec: tokenMaxAgeSec ?? 3600
            }
        });

        return NextResponse.json(
            {
                success: true,
                partner: {
                    id: partner.id,
                    name: partner.name,
                    slug: partner.slug,
                    isActive: partner.isActive,
                    allowedDomains: partner.allowedDomains,
                    tokenMaxAgeSec: partner.tokenMaxAgeSec,
                    createdAt: partner.createdAt
                },
                signingSecret
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[EmbedPartners API] Create error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create partner"
            },
            { status: 500 }
        );
    }
}
