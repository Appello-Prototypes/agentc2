import { prisma } from "@repo/database";

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export function getEmailDomain(email: string): string | null {
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

export interface BootstrapResult {
    success: boolean;
    organization?: {
        id: string;
        name: string;
        slug: string;
    };
    workspace?: {
        id: string;
        name: string;
        slug: string;
    };
    membership?: {
        id: string;
        userId: string;
        organizationId: string;
        role: string;
    };
    suggestedOrg?: {
        id: string;
        name: string;
        slug: string;
    };
    error?: string;
}

export interface BootstrapOptions {
    /** When true, do not auto-create an org as fallback — let the onboarding page handle it. */
    deferOrgCreation?: boolean;
}

/**
 * Ensures a user is assigned to an organization.
 * Supports invite code and domain-based matching. Falls back to creating a new org
 * unless `options.deferOrgCreation` is set (used by the social signup hook to let
 * the onboarding page present the org selection step).
 */
export async function bootstrapUserOrganization(
    userId: string,
    userName: string | null,
    userEmail: string | null,
    inviteCode?: string,
    options?: BootstrapOptions
): Promise<BootstrapResult> {
    // Check for existing membership
    const existingMembership = await prisma.membership.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { organization: true }
    });

    if (existingMembership) {
        return {
            success: true,
            organization: existingMembership.organization,
            membership: existingMembership
        };
    }

    // Try invite code — check platform-level access codes first, then org-scoped invites
    if (inviteCode) {
        // 1. Check platform invite (grants access to create own org)
        const platformInvite = await prisma.platformInvite.findUnique({
            where: { code: inviteCode }
        });

        if (platformInvite) {
            if (!platformInvite.isActive) {
                return { success: false, error: "Invalid invite code" };
            }
            if (platformInvite.expiresAt && platformInvite.expiresAt < new Date()) {
                return { success: false, error: "Invite code has expired" };
            }
            if (platformInvite.maxUses && platformInvite.usedCount >= platformInvite.maxUses) {
                return { success: false, error: "Invite code has reached its limit" };
            }

            // Valid platform invite — increment usage and let user create their own org
            await prisma.platformInvite.update({
                where: { id: platformInvite.id },
                data: { usedCount: { increment: 1 } }
            });

            // Defer org creation so onboarding handles it (user creates their own org)
            return { success: true };
        }

        // 2. Check org-scoped invite (joins user into existing org)
        const invite = await prisma.organizationInvite.findUnique({
            where: { code: inviteCode },
            include: { organization: true }
        });

        if (!invite || !invite.isActive) {
            return { success: false, error: "Invalid invite code" };
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
            return { success: false, error: "Invite code has expired" };
        }

        if (invite.maxUses && invite.usedCount >= invite.maxUses) {
            return { success: false, error: "Invite code has reached its limit" };
        }

        const membership = await prisma.$transaction(async (tx) => {
            const created = await tx.membership.create({
                data: {
                    userId,
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

        return {
            success: true,
            organization: invite.organization,
            membership
        };
    }

    // Try domain matching — return suggested org instead of auto-joining
    const domain = userEmail ? getEmailDomain(userEmail) : null;
    if (domain) {
        // 1. Check explicit OrganizationDomain table first
        const orgDomain = await prisma.organizationDomain.findUnique({
            where: { domain },
            include: { organization: true }
        });

        if (orgDomain) {
            return {
                success: true,
                suggestedOrg: {
                    id: orgDomain.organization.id,
                    name: orgDomain.organization.name,
                    slug: orgDomain.organization.slug
                }
            };
        }

        // 2. Fallback: check if any existing member shares the same email domain
        const coworker = await prisma.user.findFirst({
            where: {
                email: { endsWith: `@${domain}` },
                NOT: { id: userId }
            }
        });

        if (coworker) {
            const coworkerMembership = await prisma.membership.findFirst({
                where: { userId: coworker.id },
                include: { organization: true },
                orderBy: { createdAt: "asc" }
            });

            if (coworkerMembership) {
                return {
                    success: true,
                    suggestedOrg: {
                        id: coworkerMembership.organization.id,
                        name: coworkerMembership.organization.name,
                        slug: coworkerMembership.organization.slug
                    }
                };
            }
        }
    }

    // Fall back to creating a new org + workspace (only when not deferred)
    if (options?.deferOrgCreation) {
        return { success: true };
    }
    return createNewOrganizationForUser(userId, userName);
}

/**
 * Creates a brand-new organization, default workspace, and owner membership for a user.
 * Reused by bootstrap (fallback) and the confirm-org API (create_new action).
 */
export async function createNewOrganizationForUser(
    userId: string,
    userName: string | null
): Promise<BootstrapResult> {
    const baseName = userName?.trim() || "New Organization";
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
                userId,
                organizationId: organization.id,
                role: "owner"
            }
        });

        return { organization, workspace, membership };
    });

    return {
        success: true,
        organization,
        workspace,
        membership
    };
}
