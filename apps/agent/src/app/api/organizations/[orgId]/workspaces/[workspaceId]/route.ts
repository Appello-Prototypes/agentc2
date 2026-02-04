import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

/**
 * PATCH /api/organizations/[orgId]/workspaces/[workspaceId]
 *
 * Update a workspace
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; workspaceId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId, workspaceId } = await params;

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

        // Find workspace
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                organizationId: organization.id
            }
        });

        if (!workspace) {
            return NextResponse.json(
                { success: false, error: "Workspace not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { name, description, isDefault } = body;

        const updateData: {
            name?: string;
            description?: string | null;
            isDefault?: boolean;
        } = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length === 0) {
                return NextResponse.json(
                    { success: false, error: "Name cannot be empty" },
                    { status: 400 }
                );
            }
            updateData.name = name.trim();
        }

        if (description !== undefined) {
            updateData.description = description ? description.trim() : null;
        }

        if (isDefault !== undefined) {
            updateData.isDefault = isDefault;

            // If setting as default, unset other defaults
            if (isDefault) {
                await prisma.workspace.updateMany({
                    where: {
                        organizationId: organization.id,
                        isDefault: true,
                        id: { not: workspaceId }
                    },
                    data: { isDefault: false }
                });
            }
        }

        const updatedWorkspace = await prisma.workspace.update({
            where: { id: workspaceId },
            data: updateData
        });

        // Audit log
        await auditLog.create({
            action: "WORKSPACE_UPDATE",
            entityType: "Workspace",
            entityId: workspaceId,
            userId: session.user.id,
            metadata: updateData
        });

        return NextResponse.json({
            success: true,
            workspace: {
                id: updatedWorkspace.id,
                name: updatedWorkspace.name,
                slug: updatedWorkspace.slug,
                environment: updatedWorkspace.environment,
                description: updatedWorkspace.description,
                isDefault: updatedWorkspace.isDefault,
                createdAt: updatedWorkspace.createdAt,
                updatedAt: updatedWorkspace.updatedAt
            }
        });
    } catch (error) {
        console.error("[Workspace] Error updating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update workspace"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/organizations/[orgId]/workspaces/[workspaceId]
 *
 * Delete a workspace
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; workspaceId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId, workspaceId } = await params;

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

        // Find workspace
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                organizationId: organization.id
            },
            include: {
                _count: {
                    select: { agents: true }
                }
            }
        });

        if (!workspace) {
            return NextResponse.json(
                { success: false, error: "Workspace not found" },
                { status: 404 }
            );
        }

        // Cannot delete default workspace
        if (workspace.isDefault) {
            return NextResponse.json(
                { success: false, error: "Cannot delete the default workspace" },
                { status: 400 }
            );
        }

        // Cannot delete workspace with agents
        if (workspace._count.agents > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot delete workspace with ${workspace._count.agents} agent(s). Move or delete agents first.`
                },
                { status: 400 }
            );
        }

        // Delete workspace
        await prisma.workspace.delete({
            where: { id: workspaceId }
        });

        // Audit log
        await auditLog.create({
            action: "WORKSPACE_DELETE",
            entityType: "Workspace",
            entityId: workspaceId,
            userId: session.user.id,
            metadata: { name: workspace.name, slug: workspace.slug }
        });

        return NextResponse.json({
            success: true,
            message: "Workspace deleted"
        });
    } catch (error) {
        console.error("[Workspace] Error deleting:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete workspace"
            },
            { status: 500 }
        );
    }
}
