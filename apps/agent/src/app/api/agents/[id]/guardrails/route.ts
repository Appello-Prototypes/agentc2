import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";
import { userHasPermission } from "@/lib/organization";

/**
 * GET /api/agents/[id]/guardrails
 *
 * Get guardrail policy for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Get guardrail policy
        const guardrailPolicy = await prisma.guardrailPolicy.findUnique({
            where: { agentId: agent.id }
        });

        // Check if the current user can toggle bypassOrgGuardrails
        let canOverrideGuardrails = false;
        const authContext = await authenticateRequest(request);
        if (authContext) {
            canOverrideGuardrails = await userHasPermission(
                authContext.userId,
                authContext.organizationId,
                "guardrail_override"
            );
        }

        return NextResponse.json({
            success: true,
            canOverrideGuardrails,
            guardrailConfig: guardrailPolicy
                ? {
                      id: guardrailPolicy.id,
                      configJson: guardrailPolicy.configJson,
                      version: guardrailPolicy.version,
                      createdBy: guardrailPolicy.createdBy,
                      createdAt: guardrailPolicy.createdAt,
                      updatedAt: guardrailPolicy.updatedAt
                  }
                : null
        });
    } catch (error) {
        console.error("[Agent Guardrails Get] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get guardrails"
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/agents/[id]/guardrails
 *
 * Update guardrail policy for an agent
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { configJson, createdBy } = body;

        if (!configJson) {
            return NextResponse.json(
                { success: false, error: "Missing required field: configJson" },
                { status: 400 }
            );
        }

        // Find agent by slug or id
        const agent = await prisma.agent.findFirst({
            where: {
                OR: [{ slug: id }, { id: id }]
            }
        });

        if (!agent) {
            return NextResponse.json(
                { success: false, error: `Agent '${id}' not found` },
                { status: 404 }
            );
        }

        // Guard: bypassOrgGuardrails requires guardrail_override permission
        if (configJson.bypassOrgGuardrails) {
            const authContext = await authenticateRequest(request);
            if (!authContext) {
                return NextResponse.json(
                    { success: false, error: "Authentication required to set guardrail override" },
                    { status: 401 }
                );
            }
            const hasPermission = await userHasPermission(
                authContext.userId,
                authContext.organizationId,
                "guardrail_override"
            );
            if (!hasPermission) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "You do not have permission to bypass org guardrails. Requires guardrail_override permission."
                    },
                    { status: 403 }
                );
            }
        }

        // Get existing policy for version increment
        const existingPolicy = await prisma.guardrailPolicy.findUnique({
            where: { agentId: agent.id }
        });

        const newVersion = (existingPolicy?.version || 0) + 1;

        // Upsert guardrail policy
        const guardrailPolicy = await prisma.guardrailPolicy.upsert({
            where: { agentId: agent.id },
            update: {
                configJson,
                version: newVersion,
                createdBy
            },
            create: {
                agentId: agent.id,
                tenantId: agent.tenantId,
                configJson,
                version: 1,
                createdBy
            }
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                tenantId: agent.tenantId,
                actorId: createdBy,
                action: "GUARDRAIL_UPDATE",
                entityType: "GuardrailPolicy",
                entityId: guardrailPolicy.id,
                metadata: {
                    agentId: agent.id,
                    version: guardrailPolicy.version
                }
            }
        });

        return NextResponse.json({
            success: true,
            guardrailConfig: {
                id: guardrailPolicy.id,
                configJson: guardrailPolicy.configJson,
                version: guardrailPolicy.version,
                createdBy: guardrailPolicy.createdBy,
                createdAt: guardrailPolicy.createdAt,
                updatedAt: guardrailPolicy.updatedAt
            }
        });
    } catch (error) {
        console.error("[Agent Guardrails Update] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update guardrails"
            },
            { status: 500 }
        );
    }
}
