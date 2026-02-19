import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

async function checkOrgAdmin(userId: string, orgId: string) {
    const organization = await prisma.organization.findFirst({
        where: { OR: [{ id: orgId }, { slug: orgId }] }
    });
    if (!organization) return null;

    const membership = await prisma.membership.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId: organization.id
            }
        }
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) return null;

    return organization;
}

/**
 * PUT /api/organizations/[orgId]/budget/users
 *
 * Set or update a user's budget within the organization.
 * Body: { userId, enabled, monthlyLimitUsd, alertAtPct, hardLimit }
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await authenticateRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;
        const org = await checkOrgAdmin(session.userId, orgId);
        if (!org) {
            return NextResponse.json(
                { success: false, error: "Forbidden or not found" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { userId, enabled, monthlyLimitUsd, alertAtPct, hardLimit } = body;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: "userId is required" },
                { status: 400 }
            );
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: org.id
                }
            }
        });
        if (!membership) {
            return NextResponse.json(
                { success: false, error: "User is not a member of this organization" },
                { status: 400 }
            );
        }

        const policy = await prisma.userBudgetPolicy.upsert({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: org.id
                }
            },
            update: {
                enabled: enabled ?? undefined,
                monthlyLimitUsd: monthlyLimitUsd ?? undefined,
                alertAtPct: alertAtPct ?? undefined,
                hardLimit: hardLimit ?? undefined
            },
            create: {
                userId,
                organizationId: org.id,
                enabled: enabled ?? false,
                monthlyLimitUsd: monthlyLimitUsd ?? null,
                alertAtPct: alertAtPct ?? 80,
                hardLimit: hardLimit ?? true
            }
        });

        return NextResponse.json({ success: true, userBudget: policy });
    } catch (error) {
        console.error("[User Budget PUT] Error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed" },
            { status: 500 }
        );
    }
}
