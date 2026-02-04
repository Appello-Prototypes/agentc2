import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

/**
 * GET /api/organizations
 *
 * List organizations for the current user
 */
export async function GET() {
    try {
        // TODO: Get user ID from auth context
        // For now, list all organizations
        const organizations = await prisma.organization.findMany({
            orderBy: { name: "asc" },
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
            organizations: organizations.map((org) => ({
                id: org.id,
                name: org.name,
                slug: org.slug,
                description: org.description,
                logoUrl: org.logoUrl,
                workspacesCount: org._count.workspaces,
                membersCount: org._count.memberships,
                createdAt: org.createdAt,
                updatedAt: org.updatedAt
            })),
            total: organizations.length
        });
    } catch (error) {
        console.error("[Organizations] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list organizations"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/organizations
 *
 * Create a new organization
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, slug, description, logoUrl } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: "Missing required field: name" },
                { status: 400 }
            );
        }

        // Generate slug if not provided
        const orgSlug =
            slug ||
            name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");

        // Check for slug uniqueness
        const existing = await prisma.organization.findUnique({
            where: { slug: orgSlug }
        });

        if (existing) {
            return NextResponse.json(
                { success: false, error: "Organization with this slug already exists" },
                { status: 409 }
            );
        }

        // Create organization
        const organization = await prisma.organization.create({
            data: {
                name,
                slug: orgSlug,
                description,
                logoUrl
            }
        });

        // Create default workspace
        const defaultWorkspace = await prisma.workspace.create({
            data: {
                organizationId: organization.id,
                name: "Production",
                slug: "production",
                environment: "production",
                isDefault: true
            }
        });

        // Audit log
        await auditLog.create({
            action: "ORG_CREATE",
            entityType: "Organization",
            entityId: organization.id,
            metadata: { name, slug: orgSlug }
        });

        return NextResponse.json({
            success: true,
            organization: {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
                description: organization.description,
                createdAt: organization.createdAt
            },
            defaultWorkspace: {
                id: defaultWorkspace.id,
                name: defaultWorkspace.name,
                slug: defaultWorkspace.slug,
                environment: defaultWorkspace.environment
            }
        });
    } catch (error) {
        console.error("[Organizations] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create organization"
            },
            { status: 500 }
        );
    }
}
