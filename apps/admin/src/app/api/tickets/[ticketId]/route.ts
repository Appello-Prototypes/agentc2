import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ ticketId: string }> }
) {
    try {
        await requireAdminAction(request, "ticket:read");
        const { ticketId } = await params;

        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                organization: {
                    select: { id: true, name: true, slug: true }
                },
                submittedBy: {
                    select: { id: true, name: true, email: true }
                },
                assignedTo: {
                    select: { id: true, name: true, email: true }
                },
                comments: {
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        if (!ticket) {
            return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
        }

        return NextResponse.json({ ticket });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Ticket Detail] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ ticketId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "ticket:triage");
        const { ticketId } = await params;
        const body = await request.json();

        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId }
        });

        if (!ticket) {
            return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
        }

        const beforeState = {
            title: ticket.title,
            description: ticket.description,
            type: ticket.type,
            status: ticket.status,
            priority: ticket.priority,
            assignedToId: ticket.assignedToId,
            tags: ticket.tags
        };

        const data: Prisma.SupportTicketUpdateInput = {};

        if (body.title && typeof body.title === "string" && body.title.trim()) {
            data.title = body.title.trim();
        }
        if (body.description && typeof body.description === "string" && body.description.trim()) {
            data.description = body.description.trim();
        }
        if (
            body.type &&
            ["BUG", "FEATURE_REQUEST", "IMPROVEMENT", "QUESTION"].includes(body.type)
        ) {
            data.type = body.type;
        }

        if (body.status && body.status !== ticket.status) {
            data.status = body.status;
            if (body.status === "TRIAGED" && !ticket.triagedAt) {
                data.triagedAt = new Date();
            }
            if (body.status === "RESOLVED") {
                data.resolvedAt = new Date();
            }
            if (body.status === "CLOSED") {
                data.closedAt = new Date();
            }
        }

        if (body.priority) data.priority = body.priority;
        if (body.assignedToId !== undefined) {
            data.assignedTo = body.assignedToId
                ? { connect: { id: body.assignedToId } }
                : { disconnect: true };
        }
        if (body.tags) data.tags = body.tags;

        const updated = await prisma.supportTicket.update({
            where: { id: ticketId },
            data,
            include: {
                assignedTo: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TICKET_UPDATE",
            entityType: "SupportTicket",
            entityId: ticketId,
            beforeJson: beforeState,
            afterJson: {
                title: updated.title,
                description: updated.description,
                type: updated.type,
                status: updated.status,
                priority: updated.priority,
                assignedToId: updated.assignedToId,
                tags: updated.tags
            },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ ticket: updated });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Ticket Update] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ ticketId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "ticket:delete");
        const { ticketId } = await params;

        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                organization: { select: { name: true } },
                submittedBy: { select: { name: true } }
            }
        });

        if (!ticket) {
            return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
        }

        await prisma.supportTicketComment.deleteMany({ where: { ticketId } });
        await prisma.supportTicket.delete({ where: { id: ticketId } });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TICKET_DELETE",
            entityType: "SupportTicket",
            entityId: ticketId,
            beforeJson: {
                ticketNumber: ticket.ticketNumber,
                title: ticket.title,
                type: ticket.type,
                status: ticket.status,
                organization: ticket.organization.name,
                submittedBy: ticket.submittedBy.name
            },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Ticket Delete] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
