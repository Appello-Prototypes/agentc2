import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";
import { randomBytes } from "crypto";

function generateCode(): string {
    return randomBytes(6).toString("hex").toUpperCase();
}

/**
 * GET /api/platform-invites
 *
 * List all platform invite codes.
 */
export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "platform-invite:list");

        const invites = await prisma.platformInvite.findMany({
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ invites });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/platform-invites
 *
 * Create a new platform invite code.
 * Body: { label?, maxUses?, expiresAt?, code? }
 */
export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdminAction(request, "platform-invite:create");
        const body = await request.json().catch(() => ({}));

        // Use provided code or generate one
        let code = body.code?.trim().toUpperCase() || generateCode();

        // Ensure uniqueness if auto-generated
        if (!body.code) {
            let attempts = 0;
            while ((await prisma.platformInvite.findUnique({ where: { code } })) && attempts < 10) {
                code = generateCode();
                attempts++;
            }
        }

        // Check for duplicate custom code
        if (body.code) {
            const existing = await prisma.platformInvite.findUnique({ where: { code } });
            if (existing) {
                return NextResponse.json(
                    { error: "A platform invite with that code already exists" },
                    { status: 409 }
                );
            }
        }

        const invite = await prisma.platformInvite.create({
            data: {
                code,
                label: body.label?.trim() || null,
                maxUses: body.maxUses ? parseInt(body.maxUses, 10) : null,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
                createdBy: admin.adminUserId
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "PLATFORM_INVITE_CREATE",
            entityType: "PlatformInvite",
            entityId: invite.id,
            afterJson: invite,
            ipAddress,
            userAgent
        });

        return NextResponse.json({ invite }, { status: 201 });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
