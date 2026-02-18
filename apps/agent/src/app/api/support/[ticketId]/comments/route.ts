import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";

export async function POST(
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
        select: { id: true, organizationId: true, status: true }
    });

    if (!ticket || ticket.organizationId !== organizationId) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "CLOSED") {
        return NextResponse.json(
            { error: "This ticket is closed and cannot receive new comments" },
            { status: 400 }
        );
    }

    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
        return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true }
    });

    const comment = await prisma.supportTicketComment.create({
        data: {
            ticketId: ticket.id,
            authorType: "user",
            authorId: session.user.id,
            authorName: user?.name ?? "Unknown",
            content: message,
            isInternal: false
        }
    });

    if (ticket.status === "WAITING_ON_CUSTOMER") {
        await prisma.supportTicket.update({
            where: { id: ticket.id },
            data: { status: "IN_PROGRESS" }
        });
    }

    return NextResponse.json({ success: true, comment });
}
