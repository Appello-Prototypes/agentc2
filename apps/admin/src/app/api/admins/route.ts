import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError, hashAdminPassword } from "@repo/admin-auth";
import type { AdminRole } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";
import crypto from "crypto";

const VALID_ROLES: AdminRole[] = [
    "super_admin",
    "platform_admin",
    "billing_admin",
    "support_agent",
    "viewer"
];

export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "admin:list");

        const admins = await prisma.adminUser.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                mfaEnabled: true,
                lastLoginAt: true,
                createdAt: true
            }
        });

        return NextResponse.json({ admins });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdminAction(request, "admin:create");
        const body = await request.json();

        if (!body.email || !body.name) {
            return NextResponse.json({ error: "email and name are required" }, { status: 400 });
        }

        const role = body.role || "viewer";
        if (!VALID_ROLES.includes(role)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
                { status: 400 }
            );
        }

        const existing = await prisma.adminUser.findUnique({
            where: { email: body.email.toLowerCase() }
        });
        if (existing) {
            return NextResponse.json(
                { error: "An admin with this email already exists" },
                { status: 409 }
            );
        }

        const generatedPassword = crypto.randomBytes(16).toString("base64url");
        const hashedPassword = await hashAdminPassword(generatedPassword);

        const newAdmin = await prisma.adminUser.create({
            data: {
                email: body.email.toLowerCase(),
                name: body.name,
                password: hashedPassword,
                role,
                isActive: true,
                mfaEnabled: false
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "ADMIN_USER_CREATE",
            entityType: "AdminUser",
            entityId: newAdmin.id,
            afterJson: { email: newAdmin.email, name: newAdmin.name, role: newAdmin.role },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ admin: newAdmin, generatedPassword }, { status: 201 });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin CRUD] Create error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
