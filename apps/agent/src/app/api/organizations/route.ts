import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";
import { z } from "zod";
import { requireAuth } from "@/lib/authz";
import { parseJsonBodySchema } from "@/lib/security/validate-request";

const createOrganizationSchema = z.object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(1000).optional(),
    logoUrl: z.string().trim().url().max(2048).optional()
});

/**
 * GET /api/organizations
 *
 * List organizations for the current user
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }

        const memberships = await prisma.membership.findMany({
            where: { userId: authResult.context.userId },
            select: { organizationId: true }
        });
        const orgIds = memberships.map((m) => m.organizationId);
        if (orgIds.length === 0) {
            return NextResponse.json({ success: true, organizations: [], total: 0 });
        }

        const organizations = await prisma.organization.findMany({
            where: { id: { in: orgIds } },
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
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const body = await request.json();
        const parsed = parseJsonBodySchema(createOrganizationSchema, body);
        if (parsed.response) return parsed.response;
        const { name, slug, description, logoUrl } = parsed.data;

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

        await prisma.membership.create({
            data: {
                userId: authResult.context.userId,
                organizationId: organization.id,
                role: "owner"
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
            userId: authResult.context.userId,
            metadata: { name, slug: orgSlug }
        });

        // Auto-deploy starter kit
        try {
            const { deployStarterKit } = await import("@repo/agentc2");
            await deployStarterKit(organization.id, defaultWorkspace.id, authResult.context.userId);
        } catch (error) {
            console.warn("[Organizations] Starter kit deployment failed:", error);
        }

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
