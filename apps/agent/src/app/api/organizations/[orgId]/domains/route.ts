import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

/**
 * GET /api/organizations/[orgId]/domains
 *
 * List all email domains for an organization
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

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

        // Get all domains
        const domains = await prisma.organizationDomain.findMany({
            where: { organizationId: organization.id },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
        });

        return NextResponse.json({
            success: true,
            domains: domains.map((d) => ({
                id: d.id,
                domain: d.domain,
                isPrimary: d.isPrimary,
                createdAt: d.createdAt
            })),
            total: domains.length
        });
    } catch (error) {
        console.error("[Organization Domains] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list domains"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/organizations/[orgId]/domains
 *
 * Add an email domain for auto-join
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

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

        const body = await request.json();
        const { domain, isPrimary } = body;

        if (!domain) {
            return NextResponse.json(
                { success: false, error: "Domain is required" },
                { status: 400 }
            );
        }

        // Validate domain format
        const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
        const normalizedDomain = domain.trim().toLowerCase();

        if (!domainRegex.test(normalizedDomain)) {
            return NextResponse.json(
                { success: false, error: "Invalid domain format" },
                { status: 400 }
            );
        }

        // Check if domain already exists (globally)
        const existing = await prisma.organizationDomain.findUnique({
            where: { domain: normalizedDomain }
        });

        if (existing) {
            return NextResponse.json(
                { success: false, error: "Domain is already in use by another organization" },
                { status: 409 }
            );
        }

        // If setting as primary, unset other primary
        if (isPrimary) {
            await prisma.organizationDomain.updateMany({
                where: { organizationId: organization.id, isPrimary: true },
                data: { isPrimary: false }
            });
        }

        // Create domain
        const orgDomain = await prisma.organizationDomain.create({
            data: {
                organizationId: organization.id,
                domain: normalizedDomain,
                isPrimary: isPrimary || false
            }
        });

        // Audit log
        await auditLog.create({
            action: "DOMAIN_ADD",
            entityType: "OrganizationDomain",
            entityId: orgDomain.id,
            userId: session.user.id,
            metadata: { domain: normalizedDomain }
        });

        return NextResponse.json({
            success: true,
            domain: {
                id: orgDomain.id,
                domain: orgDomain.domain,
                isPrimary: orgDomain.isPrimary,
                createdAt: orgDomain.createdAt
            }
        });
    } catch (error) {
        console.error("[Organization Domains] Error adding:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to add domain"
            },
            { status: 500 }
        );
    }
}
