import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

const VALID_STATUSES = [
    "NEW",
    "TRIAGED",
    "IN_PROGRESS",
    "WAITING_ON_CUSTOMER",
    "RESOLVED",
    "CLOSED"
];
const VALID_PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export async function PATCH(request: NextRequest) {
    try {
        const admin = await requireAdminAction(request, "ticket:triage");
        const body = await request.json();

        const { ids, status, priority, assignedToId } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
        }

        if (ids.length > 100) {
            return NextResponse.json(
                { error: "Cannot bulk update more than 100 tickets at once" },
                { status: 400 }
            );
        }

        const hasUpdate =
            status !== undefined || priority !== undefined || assignedToId !== undefined;
        if (!hasUpdate) {
            return NextResponse.json(
                {
                    error: "At least one field to update is required (status, priority, assignedToId)"
                },
                { status: 400 }
            );
        }

        if (status && !VALID_STATUSES.includes(status)) {
            return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
        }
        if (priority && !VALID_PRIORITIES.includes(priority)) {
            return NextResponse.json({ error: "Invalid priority value" }, { status: 400 });
        }

        const tickets = await prisma.supportTicket.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                status: true,
                priority: true,
                assignedToId: true,
                triagedAt: true
            }
        });

        if (tickets.length === 0) {
            return NextResponse.json({ error: "No tickets found" }, { status: 404 });
        }

        const data: Prisma.SupportTicketUpdateInput = {};
        if (status) {
            data.status = status;
            if (status === "RESOLVED") data.resolvedAt = new Date();
            if (status === "CLOSED") data.closedAt = new Date();
        }
        if (priority) data.priority = priority;
        if (assignedToId !== undefined) {
            data.assignedTo = assignedToId
                ? { connect: { id: assignedToId } }
                : { disconnect: true };
        }

        const updateResults = await Promise.all(
            tickets.map(async (ticket) => {
                const ticketData = { ...data };
                if (status === "TRIAGED" && !ticket.triagedAt) {
                    ticketData.triagedAt = new Date();
                }
                return prisma.supportTicket.update({
                    where: { id: ticket.id },
                    data: ticketData
                });
            })
        );

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TICKET_BULK_UPDATE",
            entityType: "SupportTicket",
            entityId: ids.join(","),
            beforeJson: {
                ticketIds: tickets.map((t) => t.id),
                count: tickets.length
            },
            afterJson: {
                ...(status && { status }),
                ...(priority && { priority }),
                ...(assignedToId !== undefined && { assignedToId }),
                updatedCount: updateResults.length
            },
            ipAddress,
            userAgent
        });

        return NextResponse.json({
            updated: updateResults.length,
            total: ids.length,
            notFound: ids.length - tickets.length
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Tickets Bulk Update] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const admin = await requireAdminAction(request, "ticket:delete");
        const body = await request.json();

        const { ids } = body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
        }

        if (ids.length > 100) {
            return NextResponse.json(
                { error: "Cannot bulk delete more than 100 tickets at once" },
                { status: 400 }
            );
        }

        const tickets = await prisma.supportTicket.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                ticketNumber: true,
                title: true,
                status: true
            }
        });

        if (tickets.length === 0) {
            return NextResponse.json({ error: "No tickets found" }, { status: 404 });
        }

        const ticketIds = tickets.map((t) => t.id);
        await prisma.supportTicketComment.deleteMany({
            where: { ticketId: { in: ticketIds } }
        });
        const deleteResult = await prisma.supportTicket.deleteMany({
            where: { id: { in: ticketIds } }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TICKET_BULK_DELETE",
            entityType: "SupportTicket",
            entityId: ticketIds.join(","),
            beforeJson: {
                tickets: tickets.map((t) => ({
                    id: t.id,
                    ticketNumber: t.ticketNumber,
                    title: t.title,
                    status: t.status
                }))
            },
            ipAddress,
            userAgent
        });

        return NextResponse.json({
            deleted: deleteResult.count,
            total: ids.length,
            notFound: ids.length - tickets.length
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Tickets Bulk Delete] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
