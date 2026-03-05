import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { authenticateRequest } from "@/lib/api-auth";

async function verifyPolicyBelongsToOrg(
    policy: { scope: string; scopeId: string },
    organizationId: string,
    userId: string
): Promise<boolean> {
    switch (policy.scope) {
        case "organization":
            return policy.scopeId === organizationId;
        case "workspace": {
            const ws = await prisma.workspace.findFirst({
                where: { id: policy.scopeId, organizationId }
            });
            return !!ws;
        }
        case "agent": {
            const agent = await prisma.agent.findFirst({
                where: {
                    id: policy.scopeId,
                    workspace: { organizationId }
                }
            });
            return !!agent;
        }
        case "user":
            return policy.scopeId === userId;
        default:
            return false;
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, description, rules, priority, enabled } = body;

        const existing = await prisma.communicationPolicy.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Policy not found" },
                { status: 404 }
            );
        }

        const belongsToOrg = await verifyPolicyBelongsToOrg(
            existing,
            authContext.organizationId,
            authContext.userId
        );
        if (!belongsToOrg) {
            return NextResponse.json(
                { success: false, error: "Policy not found" },
                { status: 404 }
            );
        }

        const policy = await prisma.communicationPolicy.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(rules !== undefined ? { rules } : {}),
                ...(priority !== undefined ? { priority } : {}),
                ...(enabled !== undefined ? { enabled } : {})
            }
        });

        return NextResponse.json({ success: true, policy });
    } catch (error) {
        console.error("[CommPolicy Update] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update policy" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authContext = await authenticateRequest(request);
        if (!authContext) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const existing = await prisma.communicationPolicy.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Policy not found" },
                { status: 404 }
            );
        }

        const belongsToOrg = await verifyPolicyBelongsToOrg(
            existing,
            authContext.organizationId,
            authContext.userId
        );
        if (!belongsToOrg) {
            return NextResponse.json(
                { success: false, error: "Policy not found" },
                { status: 404 }
            );
        }

        await prisma.communicationPolicy.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[CommPolicy Delete] Error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to delete policy" },
            { status: 500 }
        );
    }
}
