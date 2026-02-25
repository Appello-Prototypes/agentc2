import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";
import crypto from "crypto";

async function hashPassword(password: string): Promise<string> {
    const { scrypt, randomBytes } = await import("node:crypto");

    const salt = randomBytes(16).toString("hex");
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        scrypt(
            password.normalize("NFKC"),
            salt,
            64,
            { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
            (err, key) => (err ? reject(err) : resolve(key))
        );
    });
    return `${salt}:${derivedKey.toString("hex")}`;
}

const VALID_ROLES = ["owner", "admin", "member", "viewer"];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        await requireAdminAction(request, "tenant:read");
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true }
        });
        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const memberships = await prisma.membership.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" }
        });

        const userIds = memberships.map((m) => m.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, status: true }
        });
        const userMap = new Map(users.map((u) => [u.id, u]));

        const members = memberships.map((m) => {
            const user = userMap.get(m.userId);
            return {
                id: m.id,
                userId: m.userId,
                role: m.role,
                createdAt: m.createdAt.toISOString(),
                userName: user?.name || "Unknown",
                userEmail: user?.email || m.userId,
                userStatus: user?.status || "unknown"
            };
        });

        return NextResponse.json({ members });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "tenant:update");
        const { orgId } = await params;
        const body = await request.json();

        const { email, name, role } = body;
        if (!email) {
            return NextResponse.json({ error: "email is required" }, { status: 400 });
        }

        const memberRole = role || "member";
        if (!VALID_ROLES.includes(memberRole)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
                { status: 400 }
            );
        }

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, name: true }
        });
        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        let user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, name: true, email: true }
        });

        let generatedPassword: string | null = null;

        if (!user) {
            if (!name) {
                return NextResponse.json(
                    { error: "User not found. Provide a name to create a new user." },
                    { status: 400 }
                );
            }

            generatedPassword = crypto.randomBytes(16).toString("base64url");
            const hashedPassword = await hashPassword(generatedPassword);

            user = await prisma.user.create({
                data: {
                    name,
                    email: email.toLowerCase(),
                    emailVerified: false,
                    accounts: {
                        create: {
                            accountId: email.toLowerCase(),
                            providerId: "credential",
                            password: hashedPassword
                        }
                    }
                },
                select: { id: true, name: true, email: true }
            });
        }

        const existingMembership = await prisma.membership.findUnique({
            where: { userId_organizationId: { userId: user.id, organizationId: orgId } }
        });
        if (existingMembership) {
            return NextResponse.json(
                { error: "User is already a member of this organization" },
                { status: 409 }
            );
        }

        const membership = await prisma.membership.create({
            data: {
                userId: user.id,
                organizationId: orgId,
                role: memberRole
            },
            select: { id: true, userId: true, role: true, createdAt: true }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TENANT_MEMBER_ADD",
            entityType: "Membership",
            entityId: membership.id,
            afterJson: {
                userId: user.id,
                email: user.email,
                name: user.name,
                role: memberRole,
                organizationId: orgId
            },
            ipAddress,
            userAgent
        });

        return NextResponse.json(
            {
                membership: {
                    ...membership,
                    userName: user.name,
                    userEmail: user.email,
                    createdAt: membership.createdAt.toISOString()
                },
                generatedPassword,
                userCreated: generatedPassword !== null
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin] Add tenant member error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
