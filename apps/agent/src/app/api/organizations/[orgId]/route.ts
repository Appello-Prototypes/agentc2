import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * Helper to check if user has required role in organization
 */
async function checkMembership(
    userId: string,
    orgId: string,
    requiredRoles?: string[]
): Promise<{ membership: { role: string } | null; organization: { id: string } | null }> {
    const organization = await prisma.organization.findFirst({
        where: {
            OR: [{ id: orgId }, { slug: orgId }]
        }
    });

    if (!organization) {
        return { membership: null, organization: null };
    }

    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId: organization.id
            }
        }
    });

    if (!membership) {
        return { membership: null, organization };
    }

    if (requiredRoles && !requiredRoles.includes(membership.role)) {
        return { membership: null, organization };
    }

    return { membership, organization };
}

/**
 * GET /api/organizations/[orgId]
 *
 * Get a single organization
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

        const { membership, organization } = await checkMembership(authContext.userId, orgId);

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        if (!membership) {
            return NextResponse.json(
                { success: false, error: "Not a member of this organization" },
                { status: 403 }
            );
        }

        const org = await prisma.organization.findUnique({
            where: { id: organization.id },
            include: {
                _count: {
                    select: {
                        workspaces: true,
                        memberships: true
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            organization: {
                id: org!.id,
                name: org!.name,
                slug: org!.slug,
                description: org!.description,
                logoUrl: org!.logoUrl,
                metadata: org!.metadata,
                workspacesCount: org!._count.workspaces,
                membersCount: org!._count.memberships,
                createdAt: org!.createdAt,
                updatedAt: org!.updatedAt
            }
        });
    } catch (error) {
        console.error("[Organization] Error fetching:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch organization"
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/organizations/[orgId]
 *
 * Update an organization
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

        const { membership, organization } = await checkMembership(authContext.userId, orgId, [
            "owner",
            "admin"
        ]);

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        if (!membership) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { name, slug, description, logoUrl, metadata } = body;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length === 0) {
                return NextResponse.json(
                    { success: false, error: "Name cannot be empty" },
                    { status: 400 }
                );
            }
            updateData.name = name.trim();
        }

        if (slug !== undefined) {
            const newSlug = slug
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");

            // Check uniqueness
            const existing = await prisma.organization.findFirst({
                where: {
                    slug: newSlug,
                    id: { not: organization.id }
                }
            });

            if (existing) {
                return NextResponse.json(
                    { success: false, error: "Slug already in use" },
                    { status: 409 }
                );
            }

            updateData.slug = newSlug;
        }

        if (description !== undefined) {
            updateData.description = description ? description.trim() : null;
        }

        if (logoUrl !== undefined) {
            updateData.logoUrl = logoUrl ? logoUrl.trim() : null;
        }

        if (metadata !== undefined && typeof metadata === "object" && metadata !== null) {
            // Shallow-merge with existing metadata so other keys aren't wiped
            const existing = await prisma.organization.findUnique({
                where: { id: organization.id },
                select: { metadata: true }
            });
            const prev =
                existing?.metadata && typeof existing.metadata === "object"
                    ? (existing.metadata as Record<string, unknown>)
                    : {};
            updateData.metadata = { ...prev, ...metadata };
        }

        const updatedOrg = await prisma.organization.update({
            where: { id: organization.id },
            data: updateData
        });

        // Audit log
        await auditLog.create({
            action: "ORG_UPDATE",
            entityType: "Organization",
            entityId: organization.id,
            userId: authContext.userId,
            metadata: updateData
        });

        return NextResponse.json({
            success: true,
            organization: {
                id: updatedOrg.id,
                name: updatedOrg.name,
                slug: updatedOrg.slug,
                description: updatedOrg.description,
                logoUrl: updatedOrg.logoUrl,
                metadata: updatedOrg.metadata,
                createdAt: updatedOrg.createdAt,
                updatedAt: updatedOrg.updatedAt
            }
        });
    } catch (error) {
        console.error("[Organization] Error updating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update organization"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/organizations/[orgId]
 *
 * Delete an organization (owner only)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

        const { membership, organization } = await checkMembership(authContext.userId, orgId, [
            "owner"
        ]);

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        if (!membership) {
            return NextResponse.json(
                { success: false, error: "Only the owner can delete the organization" },
                { status: 403 }
            );
        }

        // Delete the organization (cascades to workspaces, memberships, etc.)
        await prisma.organization.delete({
            where: { id: organization.id }
        });

        // Audit log
        await auditLog.create({
            action: "ORG_DELETE",
            entityType: "Organization",
            entityId: organization.id,
            userId: authContext.userId,
            metadata: {}
        });

        return NextResponse.json({
            success: true,
            message: "Organization deleted"
        });
    } catch (error) {
        console.error("[Organization] Error deleting:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete organization"
            },
            { status: 500 }
        );
    }
}
