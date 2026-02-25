import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { auth, createNewOrganizationForUser, getEmailDomain } from "@repo/auth";

/**
 * POST /api/auth/confirm-org
 *
 * Called after the user sees the "join org" offer during onboarding.
 * Body: { action: "join" | "create_new", organizationId?: string }
 *
 * - join: Validates domain match, then creates membership in the specified org.
 * - create_new: Creates a brand-new org + default workspace with the user as owner.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        // Prevent double-join
        const existingMembership = await prisma.membership.findFirst({
            where: { userId: session.user.id }
        });

        if (existingMembership) {
            return NextResponse.json(
                { success: false, error: "User already belongs to an organization" },
                { status: 400 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const action = body?.action;

        if (action !== "join" && action !== "create_new") {
            return NextResponse.json(
                { success: false, error: "Invalid action. Must be 'join' or 'create_new'." },
                { status: 400 }
            );
        }

        if (action === "join") {
            const organizationId = body?.organizationId;
            if (typeof organizationId !== "string" || !organizationId) {
                return NextResponse.json(
                    { success: false, error: "organizationId is required for join action" },
                    { status: 400 }
                );
            }

            // Verify the user's email domain matches either:
            // 1. An explicit OrganizationDomain record, OR
            // 2. An existing member with the same email domain (soft match)
            const domain = session.user.email ? getEmailDomain(session.user.email) : null;
            if (!domain) {
                return NextResponse.json(
                    { success: false, error: "Cannot determine email domain" },
                    { status: 400 }
                );
            }

            // 1. Check explicit OrganizationDomain table
            const orgDomain = await prisma.organizationDomain.findFirst({
                where: { organizationId, domain },
                include: { organization: true }
            });

            // 2. Fallback: check if an existing member of this org shares the same domain
            let organization = orgDomain?.organization ?? null;
            if (!organization) {
                const coworkerMembership = await prisma.membership.findFirst({
                    where: {
                        organizationId,
                        userId: {
                            in: (
                                await prisma.user.findMany({
                                    where: {
                                        email: { endsWith: `@${domain}` },
                                        NOT: { id: session.user.id }
                                    },
                                    select: { id: true }
                                })
                            ).map((u) => u.id)
                        }
                    },
                    include: { organization: true }
                });
                organization = coworkerMembership?.organization ?? null;
            }

            if (!organization) {
                return NextResponse.json(
                    { success: false, error: "Organization domain does not match your email" },
                    { status: 400 }
                );
            }

            const membership = await prisma.membership.create({
                data: {
                    userId: session.user.id,
                    organizationId,
                    role: "member"
                }
            });

            return NextResponse.json({
                success: true,
                organization: {
                    id: organization.id,
                    name: organization.name,
                    slug: organization.slug
                },
                membership
            });
        }

        // action === "create_new"
        const result = await createNewOrganizationForUser(session.user.id, session.user.name);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || "Failed to create organization" },
                { status: 500 }
            );
        }

        // Auto-deploy starter kit for the new org
        if (result.organization?.id && result.workspace?.id) {
            try {
                const { deployStarterKit } = await import("@repo/agentc2");
                await deployStarterKit(
                    result.organization.id,
                    result.workspace.id,
                    session.user.id
                );
            } catch (error) {
                console.warn("[Confirm Org] Starter kit deployment failed:", error);
            }
        }

        // Auto-create a Starter (free) subscription for the new org
        if (result.organization?.id) {
            try {
                const starterPlan = await prisma.pricingPlan.findFirst({
                    where: { slug: "starter", isActive: true }
                });

                if (starterPlan) {
                    const now = new Date();
                    const periodEnd = new Date(now);
                    periodEnd.setMonth(periodEnd.getMonth() + 1);

                    await prisma.orgSubscription.upsert({
                        where: { organizationId: result.organization.id },
                        update: {},
                        create: {
                            organizationId: result.organization.id,
                            planId: starterPlan.id,
                            status: "active",
                            billingCycle: "monthly",
                            includedCreditsUsd: starterPlan.includedCreditsUsd,
                            currentPeriodStart: now,
                            currentPeriodEnd: periodEnd
                        }
                    });
                }
            } catch (subError) {
                console.warn("[Confirm Org] Failed to create starter subscription:", subError);
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("[Confirm Org] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to confirm organization"
            },
            { status: 500 }
        );
    }
}
