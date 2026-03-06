import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAuth, requireAgentAccess, requireEntityAccess } from "@/lib/authz";

const ALLOWED_PERMISSIONS = ["read_only", "write", "spend", "full"] as const;

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

        const permissions = await prisma.agentToolPermission.findMany({
            where: { agentId },
            select: { id: true, toolId: true, permission: true, maxCostUsd: true }
        });

        return NextResponse.json({
            success: true,
            permissions
        });
    } catch (error) {
        console.error("[Agent Permissions Get] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get permissions"
            },
            { status: 500 }
        );
    }
}

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

        const access = await requireEntityAccess(context.userId, context.organizationId, "admin");
        if (!access.allowed) return access.response;

        const body = await request.json();
        const { toolId, permission = "full", maxCostUsd } = body;

        if (!toolId || typeof toolId !== "string") {
            return NextResponse.json(
                { success: false, error: "toolId is required" },
                { status: 400 }
            );
        }

        if (!ALLOWED_PERMISSIONS.includes(permission)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `permission must be one of: ${ALLOWED_PERMISSIONS.join(", ")}`
                },
                { status: 400 }
            );
        }

        const permissionRecord = await prisma.agentToolPermission.upsert({
            where: {
                agentId_toolId: { agentId, toolId }
            },
            update: { permission, maxCostUsd: maxCostUsd ?? null },
            create: { agentId, toolId, permission, maxCostUsd: maxCostUsd ?? null }
        });

        return NextResponse.json({
            success: true,
            permission: {
                id: permissionRecord.id,
                toolId: permissionRecord.toolId,
                permission: permissionRecord.permission,
                maxCostUsd: permissionRecord.maxCostUsd
            }
        });
    } catch (error) {
        console.error("[Agent Permissions Put] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to upsert permission"
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const { context, response: authResponse } = await requireAuth(request);
        if (authResponse) return authResponse;
        const { agentId, response: accessResponse } = await requireAgentAccess(
            context.organizationId,
            id
        );
        if (accessResponse) return accessResponse;

        const access = await requireEntityAccess(context.userId, context.organizationId, "admin");
        if (!access.allowed) return access.response;

        const body = await request.json();
        const { toolId } = body;

        if (!toolId || typeof toolId !== "string") {
            return NextResponse.json(
                { success: false, error: "toolId is required" },
                { status: 400 }
            );
        }

        await prisma.agentToolPermission.deleteMany({
            where: { agentId, toolId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Agent Permissions Delete] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete permission"
            },
            { status: 500 }
        );
    }
}
