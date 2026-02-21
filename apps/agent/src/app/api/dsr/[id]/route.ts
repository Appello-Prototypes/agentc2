import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { auditLog } from "@/lib/audit-log";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/dsr/[id]
 *
 * Get a single DSR by ID. Users can only view their own.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        const dsr = await prisma.dataSubjectRequest.findFirst({
            where: {
                id,
                requestorUserId: session.user.id
            }
        });

        if (!dsr) {
            return NextResponse.json({ success: false, error: "DSR not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, dsr });
    } catch (error) {
        console.error("[DSR Get] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to get DSR"
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/dsr/[id]
 *
 * Update DSR status. Only the requesting user can update their own DSR.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const userId = session.user.id;

        const existing = await prisma.dataSubjectRequest.findFirst({
            where: { id, requestorUserId: userId }
        });

        if (!existing) {
            return NextResponse.json({ success: false, error: "DSR not found" }, { status: 404 });
        }

        const body = await request.json();
        const { status, notes, rejectionReason } = body as {
            status?: string;
            notes?: string;
            rejectionReason?: string;
        };

        const validStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
                },
                { status: 400 }
            );
        }

        const updateData: Record<string, unknown> = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;
        if (status === "COMPLETED") updateData.completedAt = new Date();

        const dsr = await prisma.dataSubjectRequest.update({
            where: { id },
            data: updateData
        });

        if (status === "COMPLETED") {
            await auditLog.create({
                action: "DSR_COMPLETE",
                entityType: "DataSubjectRequest",
                entityId: id,
                userId,
                metadata: { type: dsr.type, status }
            });
        }

        return NextResponse.json({ success: true, dsr });
    } catch (error) {
        console.error("[DSR Update] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to update DSR"
            },
            { status: 500 }
        );
    }
}
