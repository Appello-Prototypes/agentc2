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
            include: {
                _count: {
                    select: { deployments: true, users: true }
                }
            }
        });

        if (!partner || partner.organizationId !== organizationId) {
            return NextResponse.json(
                { success: false, error: "Partner not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            partner: {
                id: partner.id,
                name: partner.name,
                slug: partner.slug,
                signingSecret: partner.signingSecret,
                isActive: partner.isActive,
                allowedDomains: partner.allowedDomains,
                tokenMaxAgeSec: partner.tokenMaxAgeSec,
                metadata: partner.metadata,
                createdAt: partner.createdAt,
                updatedAt: partner.updatedAt,
                _count: partner._count
            }
        });
    } catch (error) {
        console.error("[EmbedPartners API] Get error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get partner"
            },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    const { id } = await params;

    try {
        const existing = await prisma.embedPartner.findUnique({
            where: { id },
            select: { organizationId: true }
        });
        if (!existing || existing.organizationId !== organizationId) {
            return NextResponse.json(
                { success: false, error: "Partner not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { name, allowedDomains, tokenMaxAgeSec, metadata, isActive } = body as {
            name?: string;
            allowedDomains?: string[];
            tokenMaxAgeSec?: number;
            metadata?: Record<string, unknown>;
            isActive?: boolean;
        };

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (allowedDomains !== undefined) updateData.allowedDomains = allowedDomains;
        if (tokenMaxAgeSec !== undefined) updateData.tokenMaxAgeSec = tokenMaxAgeSec;
        if (metadata !== undefined) updateData.metadata = metadata;
        if (isActive !== undefined) updateData.isActive = isActive;

        const partner = await prisma.embedPartner.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            partner: {
                id: partner.id,
                name: partner.name,
                slug: partner.slug,
                isActive: partner.isActive,
                allowedDomains: partner.allowedDomains,
                tokenMaxAgeSec: partner.tokenMaxAgeSec,
                metadata: partner.metadata,
                updatedAt: partner.updatedAt
            }
        });
    } catch (error) {
        console.error("[EmbedPartners API] Update error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update partner"
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;
    const { userId, organizationId } = authResult.context;

    const roleResult = await requireOrgRole(userId, organizationId);
    if (roleResult.response) return roleResult.response;

    const { id } = await params;

    const { searchParams } = new URL(request.url);
    if (searchParams.get("confirm") !== "true") {
        return NextResponse.json(
            {
                success: false,
                error: "Deletion requires ?confirm=true query parameter"
            },
            { status: 400 }
        );
    }

    try {
        const existing = await prisma.embedPartner.findUnique({
            where: { id },
            select: { organizationId: true }
        });
        if (!existing || existing.organizationId !== organizationId) {
            return NextResponse.json(
                { success: false, error: "Partner not found" },
                { status: 404 }
            );
        }

        await prisma.embedPartner.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[EmbedPartners API] Delete error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete partner"
            },
            { status: 500 }
        );
    }
}
