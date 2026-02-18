import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { z } from "zod";
import { requireAuth, requireOrgMembership, requireOrgRole } from "@/lib/authz";
import { parseJsonBodySchema } from "@/lib/security/validate-request";

const orgGuardrailUpdateSchema = z.object({
    configJson: z.record(z.string(), z.unknown()),
    createdBy: z.string().optional()
});

/**
 * GET /api/organizations/[orgId]/guardrails
 *
 * Get the org-wide guardrail policy.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const { orgId } = await params;
        const membership = await requireOrgMembership(authResult.context.userId, orgId);
        if (membership.response) {
            return membership.response;
        }

        const org = await prisma.organization.findFirst({
            where: {
                OR: [{ slug: orgId }, { id: orgId }]
            }
        });

        if (!org) {
            return NextResponse.json(
                { success: false, error: `Organization '${orgId}' not found` },
                { status: 404 }
            );
        }

        const policy = await prisma.orgGuardrailPolicy.findUnique({
            where: { organizationId: org.id }
        });

        return NextResponse.json({
            success: true,
            guardrailConfig: policy
                ? {
                      id: policy.id,
                      configJson: policy.configJson,
                      version: policy.version,
                      createdBy: policy.createdBy,
                      createdAt: policy.createdAt,
                      updatedAt: policy.updatedAt
                  }
                : null
        });
    } catch (error) {
        console.error("[Org Guardrails Get] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get org guardrails"
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/organizations/[orgId]/guardrails
 *
 * Create or update the org-wide guardrail policy.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const authResult = await requireAuth(request);
        if (authResult.response) {
            return authResult.response;
        }
        const { orgId } = await params;
        const body = await request.json();
        const membership = await requireOrgMembership(authResult.context.userId, orgId);
        if (membership.response) {
            return membership.response;
        }
        const role = await requireOrgRole(authResult.context.userId, membership.organizationId);
        if (role.response) {
            return role.response;
        }
        const parsed = parseJsonBodySchema(orgGuardrailUpdateSchema, body);
        if (parsed.response) return parsed.response;
        const { configJson } = parsed.data;
        const createdBy = authResult.context.userId;

        const org = await prisma.organization.findFirst({
            where: {
                OR: [{ slug: orgId }, { id: orgId }]
            }
        });

        if (!org) {
            return NextResponse.json(
                { success: false, error: `Organization '${orgId}' not found` },
                { status: 404 }
            );
        }

        const existing = await prisma.orgGuardrailPolicy.findUnique({
            where: { organizationId: org.id }
        });

        const newVersion = (existing?.version || 0) + 1;

        const policy = await prisma.orgGuardrailPolicy.upsert({
            where: { organizationId: org.id },
            update: {
                configJson: configJson as Prisma.InputJsonValue,
                version: newVersion,
                createdBy
            },
            create: {
                organizationId: org.id,
                configJson: configJson as Prisma.InputJsonValue,
                version: 1,
                createdBy
            }
        });

        await prisma.auditLog.create({
            data: {
                tenantId: org.id,
                actorId: createdBy,
                action: "ORG_GUARDRAIL_UPDATE",
                entityType: "OrgGuardrailPolicy",
                entityId: policy.id,
                metadata: {
                    organizationId: org.id,
                    version: policy.version
                }
            }
        });

        return NextResponse.json({
            success: true,
            guardrailConfig: {
                id: policy.id,
                configJson: policy.configJson,
                version: policy.version,
                createdBy: policy.createdBy,
                createdAt: policy.createdAt,
                updatedAt: policy.updatedAt
            }
        });
    } catch (error) {
        console.error("[Org Guardrails Update] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update org guardrails"
            },
            { status: 500 }
        );
    }
}
