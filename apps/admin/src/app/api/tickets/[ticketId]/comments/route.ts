import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ ticketId: string }> }
) {
    try {
        const admin = await requireAdminAction(request, "ticket:comment");
        const { ticketId } = await params;
        const body = await request.json();

        if (!body.content || typeof body.content !== "string") {
            return NextResponse.json({ error: "content is required" }, { status: 400 });
        }

        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId }
        });

        if (!ticket) {
            return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
        }

        const adminUser = await prisma.adminUser.findUnique({
            where: { id: admin.adminUserId },
            select: { name: true }
        });

        const comment = await prisma.supportTicketComment.create({
            data: {
                ticketId,
                authorType: "admin",
                authorId: admin.adminUserId,
                authorName: adminUser?.name ?? "Admin",
                content: body.content,
                isInternal: body.isInternal === true
            }
        });

        // If adding a non-internal comment and ticket is NEW or TRIAGED, move to IN_PROGRESS
        if (!body.isInternal && (ticket.status === "NEW" || ticket.status === "TRIAGED")) {
            await prisma.supportTicket.update({
                where: { id: ticketId },
                data: {
                    status: "IN_PROGRESS",
                    triagedAt: ticket.triagedAt ?? new Date()
                }
            });
        }

        return NextResponse.json({ comment });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Ticket Comment] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
