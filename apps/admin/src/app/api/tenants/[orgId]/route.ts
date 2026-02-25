import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { updateTenant, requestTenantDeletion } from "@/lib/tenant-actions";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        await requireAdminAction(request, "tenant:read");
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                _count: {
                    select: {
                        workspaces: true,
                        memberships: true,
                        integrationConnections: true
                    }
                }
            }
        });

        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        return NextResponse.json({ tenant: org });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "tenant:update");
        const { orgId } = await params;
        const body = await request.json();

        if (body.slug !== undefined) {
            const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
            if (!slugRegex.test(body.slug)) {
                return NextResponse.json(
                    { error: "Slug must be lowercase alphanumeric with optional hyphens" },
                    { status: 400 }
                );
            }
        }

        const before = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                name: true,
                slug: true,
                description: true,
                timezone: true,
                maxAgents: true,
                maxWorkspaces: true,
                maxRunsPerMonth: true,
                maxSeats: true
            }
        });
        if (!before) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const updated = await updateTenant(orgId, {
            name: body.name,
            slug: body.slug,
            description: body.description,
            timezone: body.timezone,
            maxAgents: body.maxAgents,
            maxWorkspaces: body.maxWorkspaces,
            maxRunsPerMonth: body.maxRunsPerMonth,
            maxSeats: body.maxSeats
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_UPDATE",
            entityType: "Organization",
            entityId: orgId,
            beforeJson: before,
            afterJson: {
                name: updated.name,
                slug: updated.slug,
                description: updated.description,
                timezone: updated.timezone,
                maxAgents: updated.maxAgents,
                maxWorkspaces: updated.maxWorkspaces,
                maxRunsPerMonth: updated.maxRunsPerMonth,
                maxSeats: updated.maxSeats
            },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ tenant: updated });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "tenant:delete");
        const { orgId } = await params;
        const body = await request.json().catch(() => ({}));
        const reason = body.reason || "Deleted by admin";

        const result = await requestTenantDeletion(orgId, reason, admin.adminUserId);

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_DELETE_REQUEST",
            entityType: "Organization",
            entityId: orgId,
            beforeJson: { status: result.previousStatus },
            afterJson: { status: "deactivated" },
            ipAddress,
            userAgent,
            metadata: { reason }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        const msg = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
