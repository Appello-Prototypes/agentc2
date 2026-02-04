import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";
import { randomBytes } from "crypto";

/**
 * Generate a random invite code
 */
function generateInviteCode(): string {
    return randomBytes(6).toString("hex").toUpperCase();
}

/**
 * GET /api/organizations/[orgId]/invites
 *
 * List all invite codes for an organization
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

        // Get all invites
        const invites = await prisma.organizationInvite.findMany({
            where: { organizationId: organization.id },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({
            success: true,
            invites: invites.map((i) => ({
                id: i.id,
                code: i.code,
                expiresAt: i.expiresAt,
                maxUses: i.maxUses,
                usedCount: i.usedCount,
                isActive: i.isActive,
                createdAt: i.createdAt,
                createdBy: i.createdBy
            })),
            total: invites.length
        });
    } catch (error) {
        console.error("[Organization Invites] Error listing:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to list invites"
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/organizations/[orgId]/invites
 *
 * Create a new invite code
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

        const body = await request.json().catch(() => ({}));
        const { expiresAt, maxUses } = body;

        // Generate unique code
        let code = generateInviteCode();
        let attempts = 0;
        while ((await prisma.organizationInvite.findUnique({ where: { code } })) && attempts < 10) {
            code = generateInviteCode();
            attempts++;
        }

        // Create invite
        const invite = await prisma.organizationInvite.create({
            data: {
                organizationId: organization.id,
                code,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                maxUses: maxUses ? parseInt(maxUses, 10) : null,
                createdBy: session.user.id
            }
        });

        // Audit log
        await auditLog.create({
            action: "INVITE_CREATE",
            entityType: "OrganizationInvite",
            entityId: invite.id,
            userId: session.user.id,
            metadata: { code, expiresAt, maxUses }
        });

        return NextResponse.json({
            success: true,
            invite: {
                id: invite.id,
                code: invite.code,
                expiresAt: invite.expiresAt,
                maxUses: invite.maxUses,
                usedCount: invite.usedCount,
                isActive: invite.isActive,
                createdAt: invite.createdAt,
                createdBy: invite.createdBy
            }
        });
    } catch (error) {
        console.error("[Organization Invites] Error creating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to create invite"
            },
            { status: 500 }
        );
    }
}
