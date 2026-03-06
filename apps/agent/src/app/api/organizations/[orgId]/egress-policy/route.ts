import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { requireEntityAccess } from "@/lib/authz";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

        const organization = await prisma.organization.findFirst({
            where: { OR: [{ id: orgId }, { slug: orgId }] }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: `Organization '${orgId}' not found` },
                { status: 404 }
            );
        }

        if (organization.id !== authContext.organizationId) {
            return NextResponse.json(
                { success: false, error: "Access denied to this organization" },
                { status: 403 }
            );
        }

        const policy = await prisma.networkEgressPolicy.findUnique({
            where: { organizationId: organization.id }
        });

        return NextResponse.json({
            success: true,
            policy: policy
                ? {
                      id: policy.id,
                      mode: policy.mode,
                      domains: policy.domains,
                      enabled: policy.enabled,
                      createdAt: policy.createdAt,
                      updatedAt: policy.updatedAt
                  }
                : null
        });
    } catch (error) {
        console.error("[Egress Policy Get] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get egress policy"
            },
            { status: 500 }
        );
    }
}

const EGRESS_MODES = ["allowlist", "denylist"] as const;

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

        const access = await requireEntityAccess(
            authContext.userId,
            authContext.organizationId,
            "admin"
        );
        if (!access.allowed) {
            return access.response;
        }

        const organization = await prisma.organization.findFirst({
            where: { OR: [{ id: orgId }, { slug: orgId }] }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: `Organization '${orgId}' not found` },
                { status: 404 }
            );
        }

        if (organization.id !== authContext.organizationId) {
            return NextResponse.json(
                { success: false, error: "Access denied to this organization" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { mode, domains, enabled } = body;

        if (!EGRESS_MODES.includes(mode)) {
            return NextResponse.json(
                { success: false, error: "mode must be 'allowlist' or 'denylist'" },
                { status: 400 }
            );
        }

        if (!Array.isArray(domains)) {
            return NextResponse.json(
                { success: false, error: "domains must be an array" },
                { status: 400 }
            );
        }

        const policy = await prisma.networkEgressPolicy.upsert({
            where: { organizationId: organization.id },
            create: {
                organizationId: organization.id,
                mode,
                domains: domains.map(String),
                enabled: enabled !== false
            },
            update: {
                mode,
                domains: domains.map(String),
                enabled: enabled !== false
            }
        });

        return NextResponse.json({
            success: true,
            policy: {
                id: policy.id,
                mode: policy.mode,
                domains: policy.domains,
                enabled: policy.enabled,
                createdAt: policy.createdAt,
                updatedAt: policy.updatedAt
            }
        });
    } catch (error) {
        console.error("[Egress Policy Put] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update egress policy"
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { orgId } = await params;

        const access = await requireEntityAccess(
            authContext.userId,
            authContext.organizationId,
            "admin"
        );
        if (!access.allowed) {
            return access.response;
        }

        const organization = await prisma.organization.findFirst({
            where: { OR: [{ id: orgId }, { slug: orgId }] }
        });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: `Organization '${orgId}' not found` },
                { status: 404 }
            );
        }

        if (organization.id !== authContext.organizationId) {
            return NextResponse.json(
                { success: false, error: "Access denied to this organization" },
                { status: 403 }
            );
        }

        await prisma.networkEgressPolicy
            .delete({ where: { organizationId: organization.id } })
            .catch(() => {});

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Egress Policy Delete] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete egress policy"
            },
            { status: 500 }
        );
    }
}
