import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { getUserOrganizationId } from "@/lib/organization";

async function resolveTrigger(triggerId: string, organizationId: string) {
    return prisma.agentTrigger.findFirst({
        where: {
            id: triggerId,
            agent: {
                workspace: { organizationId }
            }
        }
    });
}

/**
 * PATCH /api/triggers/[triggerId]
 *
 * Enable or disable a trigger.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ triggerId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id, organizationId }
        });
        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const { triggerId } = await params;
        const trigger = await resolveTrigger(triggerId, organizationId);
        if (!trigger) {
            return NextResponse.json(
                { success: false, error: "Trigger not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { isActive } = body as { isActive?: boolean };
        if (typeof isActive !== "boolean") {
            return NextResponse.json(
                { success: false, error: "isActive must be a boolean" },
                { status: 400 }
            );
        }

        const updated = await prisma.agentTrigger.update({
            where: { id: trigger.id },
            data: { isActive }
        });

        return NextResponse.json({ success: true, trigger: updated });
    } catch (error) {
        console.error("[Triggers API] Error updating:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update trigger"
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/triggers/[triggerId]
 *
 * Delete a trigger and any linked integration connection.
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ triggerId: string }> }
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });
        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = await getUserOrganizationId(session.user.id);
        if (!organizationId) {
            return NextResponse.json(
                { success: false, error: "Organization membership required" },
                { status: 403 }
            );
        }

        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id, organizationId }
        });
        if (!membership || !["owner", "admin"].includes(membership.role)) {
            return NextResponse.json(
                { success: false, error: "Insufficient permissions" },
                { status: 403 }
            );
        }

        const { triggerId } = await params;
        const trigger = await resolveTrigger(triggerId, organizationId);
        if (!trigger) {
            return NextResponse.json(
                { success: false, error: "Trigger not found" },
                { status: 404 }
            );
        }

        await prisma.integrationConnection.deleteMany({
            where: { agentTriggerId: trigger.id }
        });

        await prisma.agentTrigger.delete({
            where: { id: trigger.id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Triggers API] Error deleting:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete trigger"
            },
            { status: 500 }
        );
    }
}
