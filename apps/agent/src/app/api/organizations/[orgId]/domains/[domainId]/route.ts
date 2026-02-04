import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

/**
 * DELETE /api/organizations/[orgId]/domains/[domainId]
 *
 * Remove an email domain
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; domainId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId, domainId } = await params;

        // Find organization
        const organization = await prisma.organization.findFirst({
            where: {
                OR: [{ id: orgId }, { slug: orgId }]
            }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        // Check if user is owner or admin
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: organization.id
                }
            }
        });

        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        // Find domain
        const domain = await prisma.organizationDomain.findFirst({
            where: {
                id: domainId,
                organizationId: organization.id
            }
        });

        if (!domain) {
            return NextResponse.json(
                { success: false, error: "Domain not found" },
                { status: 404 }
            );
        }

        // Delete domain
        await prisma.organizationDomain.delete({
            where: { id: domainId }
        });

        // Audit log
        await auditLog.create({
            action: "DOMAIN_REMOVE",
            entityType: "OrganizationDomain",
            entityId: domainId,
            userId: session.user.id,
            metadata: { domain: domain.domain }
        });

        return NextResponse.json({
            success: true,
            message: "Domain removed"
        });
    } catch (error) {
        console.error("[Organization Domains] Error removing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to remove domain"
            },
            { status: 500 }
        );
    }
}
