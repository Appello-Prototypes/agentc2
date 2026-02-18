import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ ticketId: string }> }
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = await getUserOrganizationId(session.user.id);
    if (!organizationId) {
        return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const { ticketId } = await params;

    const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, organizationId: true, submittedById: true, status: true }
    });

    if (!ticket || ticket.organizationId !== organizationId) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.submittedById !== session.user.id) {
        return NextResponse.json(
            { error: "Only the ticket submitter can edit this ticket" },
            { status: 403 }
        );
    }

    if (ticket.status === "CLOSED") {
        return NextResponse.json({ error: "Closed tickets cannot be edited" }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) {
        updateData.title = body.title.trim();
    }
    if (typeof body.description === "string" && body.description.trim()) {
        updateData.description = body.description.trim();
    }
    if (body.type) {
        const validTypes = ["BUG", "FEATURE_REQUEST", "IMPROVEMENT", "QUESTION"];
        if (validTypes.includes(body.type)) {
            updateData.type = body.type;
        }
    }
    if (Array.isArray(body.tags)) {
        updateData.tags = body.tags;
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: updateData
    });

    return NextResponse.json({ success: true, ticket: updated });
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ ticketId: string }> }
) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = await getUserOrganizationId(session.user.id);
    if (!organizationId) {
        return NextResponse.json({ error: "No organization" }, { status: 403 });
    }

    const { ticketId } = await params;

    const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, organizationId: true, submittedById: true }
    });

    if (!ticket || ticket.organizationId !== organizationId) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.submittedById !== session.user.id) {
        return NextResponse.json(
            { error: "Only the ticket submitter can delete this ticket" },
            { status: 403 }
        );
    }

    await prisma.supportTicketComment.deleteMany({ where: { ticketId } });
    await prisma.supportTicket.delete({ where: { id: ticketId } });

    return NextResponse.json({ success: true });
}
