import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

/**
 * GET /api/organizations/[orgId]/workspaces
 *
 * List workspaces for an organization
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;

        // Find organization
        const organization = await prisma.organization.findFirst({
            where: {
                OR: [{ id: orgId }, { slug: orgId }]
            }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: `Organization '${orgId}' not found` },
                { status: 404 }
            );
        }

        // Get workspaces
        const workspaces = await prisma.workspace.findMany({
            where: { organizationId: organization.id },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
            include: {
                _count: {
                    select: { agents: true }
                }
            }
        });

        return NextResponse.json({
            success: true,
            organization: {
                id: organization.id,
                name: organization.name,
                slug: organization.slug
            },
            workspaces: workspaces.map((ws) => ({
                id: ws.id,
                name: ws.name,
                slug: ws.slug,
                environment: ws.environment,
                description: ws.description,
                isDefault: ws.isDefault,
                agentsCount: ws._count.agents,
                createdAt: ws.createdAt,
                updatedAt: ws.updatedAt
            })),
            total: workspaces.length
        });
    } catch (error) {
        console.error("[Workspaces] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list workspaces"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/organizations/[orgId]/workspaces
 *
 * Create a new workspace in an organization
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;
        const body = await request.json();
        const { name, slug, environment, description, isDefault } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: "Missing required field: name" },
                { status: 400 }
            );
        }

        // Validate environment
        const validEnvironments = ["development", "staging", "production"];
        const env = environment || "development";
        if (!validEnvironments.includes(env)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid environment. Must be one of: ${validEnvironments.join(", ")}`
                },
                { status: 400 }
            );
        }

        // Find organization
        const organization = await prisma.organization.findFirst({
            where: {
                OR: [{ id: orgId }, { slug: orgId }]
            }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: `Organization '${orgId}' not found` },
                { status: 404 }
            );
        }

        // Generate slug if not provided
        const wsSlug =
            slug ||
            name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");

        // Check for slug uniqueness within org
        const existing = await prisma.workspace.findUnique({
            where: {
                organizationId_slug: {
                    organizationId: organization.id,
                    slug: wsSlug
                }
            }
        });

        if (existing) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Workspace with this slug already exists in this organization"
                },
                { status: 409 }
            );
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await prisma.workspace.updateMany({
                where: { organizationId: organization.id, isDefault: true },
                data: { isDefault: false }
            });
        }

        // Create workspace
        const workspace = await prisma.workspace.create({
            data: {
                organizationId: organization.id,
                name,
                slug: wsSlug,
                environment: env,
                description,
                isDefault: isDefault || false
            }
        });

        // Audit log
        await auditLog.create({
            action: "WORKSPACE_CREATE",
            entityType: "Workspace",
            entityId: workspace.id,
            metadata: { organizationId: organization.id, name, slug: wsSlug, environment: env }
        });

        return NextResponse.json({
            success: true,
            workspace: {
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
                environment: workspace.environment,
                description: workspace.description,
                isDefault: workspace.isDefault,
                createdAt: workspace.createdAt
            }
        });
    } catch (error) {
        console.error("[Workspaces] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create workspace"
            },
            { status: 500 }
        );
    }
}
