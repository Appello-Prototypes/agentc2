import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth } from "@/lib/authz/require-auth";
import { requireAgentAccess } from "@/lib/authz/require-agent-access";
import { userHasPermission } from "@/lib/organization";

/**
 * GET /api/agents/[id]/guardrails
 *
 * Get guardrail policy for an agent
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        // Get guardrail policy
        const guardrailPolicy = await prisma.guardrailPolicy.findUnique({
            where: { agentId }
        });

        // Check if the current user can toggle bypassOrgGuardrails
        const canOverrideGuardrails = await userHasPermission(
            context.userId,
            context.organizationId,
            "guardrail_override"
        );

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

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const body = await request.json();

        const { configJson, createdBy } = body;

        if (!configJson) {
            return NextResponse.json(
                { success: false, error: "Missing required field: configJson" },
                { status: 400 }
            );
        }

        // Guard: bypassOrgGuardrails requires guardrail_override permission
        if (configJson.bypassOrgGuardrails) {
            const hasPermission = await userHasPermission(
                context.userId,
                context.organizationId,
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
            where: { agentId }
        });

        const newVersion = (existingPolicy?.version || 0) + 1;

        // Upsert guardrail policy
        const guardrailPolicy = await prisma.guardrailPolicy.upsert({
            where: { agentId },
            update: {
                configJson,
                version: newVersion,
                createdBy
            },
            create: {
                agentId,
                configJson,
                version: 1,
                createdBy
            }
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                actorId: createdBy,
                action: "GUARDRAIL_UPDATE",
                entityType: "GuardrailPolicy",
                entityId: guardrailPolicy.id,
                metadata: {
                    agentId,
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
