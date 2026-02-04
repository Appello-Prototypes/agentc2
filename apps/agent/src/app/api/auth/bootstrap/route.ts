import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function getEmailDomain(email: string): string | null {
    const parts = email.split("@");
    if (parts.length !== 2) return null;
    return parts[1]?.toLowerCase() || null;
}

async function generateUniqueOrgSlug(base: string): Promise<string> {
    const normalizedBase = base || "organization";
    let slug = normalizedBase;
    let counter = 1;

    while (await prisma.organization.findUnique({ where: { slug } })) {
        counter += 1;
        slug = `${normalizedBase}-${counter}`;
    }

    return slug;
}

/**
 * POST /api/auth/bootstrap
 *
 * Ensures the signed-in user is assigned to an organization.
 * Supports invite code and domain-based matching. Falls back to creating a new org.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim() : "";

        const existingMembership = await prisma.membership.findFirst({
            where: { userId: session.user.id },
            orderBy: { createdAt: "asc" },
            include: { organization: true }
        });

        if (existingMembership) {
            return NextResponse.json({
                success: true,
                organization: existingMembership.organization,
                membership: existingMembership
            });
        }

        if (inviteCode) {
            const invite = await prisma.organizationInvite.findUnique({
                where: { code: inviteCode },
                include: { organization: true }
            });

            if (!invite || !invite.isActive) {
                return NextResponse.json(
                    { success: false, error: "Invalid invite code" },
                    { status: 400 }
                );
            }

            if (invite.expiresAt && invite.expiresAt < new Date()) {
                return NextResponse.json(
                    { success: false, error: "Invite code has expired" },
                    { status: 400 }
                );
            }

            if (invite.maxUses && invite.usedCount >= invite.maxUses) {
                return NextResponse.json(
                    { success: false, error: "Invite code has reached its limit" },
                    { status: 400 }
                );
            }

            const membership = await prisma.$transaction(async (tx) => {
                const created = await tx.membership.create({
                    data: {
                        userId: session.user.id,
                        organizationId: invite.organizationId,
                        role: "member"
                    }
                });

                await tx.organizationInvite.update({
                    where: { id: invite.id },
                    data: { usedCount: { increment: 1 } }
                });

                return created;
            });

            return NextResponse.json({
                success: true,
                organization: invite.organization,
                membership
            });
        }

        const domain = session.user.email ? getEmailDomain(session.user.email) : null;
        if (domain) {
            const orgDomain = await prisma.organizationDomain.findUnique({
                where: { domain },
                include: { organization: true }
            });

            if (orgDomain) {
                const membership = await prisma.membership.create({
                    data: {
                        userId: session.user.id,
                        organizationId: orgDomain.organizationId,
                        role: "member"
                    }
                });

                return NextResponse.json({
                    success: true,
                    organization: orgDomain.organization,
                    membership
                });
            }
        }

        const baseName = session.user.name?.trim() || "New Organization";
        const orgName = baseName.endsWith("Organization") ? baseName : `${baseName}'s Organization`;
        const baseSlug = slugify(orgName) || "organization";
        const orgSlug = await generateUniqueOrgSlug(baseSlug);

        const { organization, workspace, membership } = await prisma.$transaction(async (tx) => {
            const organization = await tx.organization.create({
                data: {
                    name: orgName,
                    slug: orgSlug
                }
            });

            const workspace = await tx.workspace.create({
                data: {
                    organizationId: organization.id,
                    name: "Production",
                    slug: "production",
                    environment: "production",
                    isDefault: true
                }
            });

            const membership = await tx.membership.create({
                data: {
                    userId: session.user.id,
                    organizationId: organization.id,
                    role: "owner"
                }
            });

            return { organization, workspace, membership };
        });

        return NextResponse.json({
            success: true,
            organization,
            workspace,
            membership
        });
    } catch (error) {
        console.error("[Auth Bootstrap] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to bootstrap organization"
            },
            { status: 500 }
        );
    }
}
