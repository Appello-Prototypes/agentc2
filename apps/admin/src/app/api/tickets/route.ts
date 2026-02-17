import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";

export async function GET(request: NextRequest) {
    try {
        await requireAdminAction(request, "ticket:list");

        const url = new URL(request.url);
        const search = url.searchParams.get("search") || "";
        const status = url.searchParams.get("status") || "";
        const type = url.searchParams.get("type") || "";
        const priority = url.searchParams.get("priority") || "";
        const orgId = url.searchParams.get("orgId") || "";
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 100);
        const skip = (page - 1) * limit;

        const where: Prisma.SupportTicketWhereInput = {};
        if (search) {
            const searchNum = parseInt(search);
            if (!isNaN(searchNum)) {
                where.OR = [
                    { ticketNumber: searchNum },
                    { title: { contains: search, mode: "insensitive" } }
                ];
            } else {
                where.title = { contains: search, mode: "insensitive" };
            }
        }
        if (status) where.status = status as Prisma.EnumTicketStatusFilter;
        if (type) where.type = type as Prisma.EnumTicketTypeFilter;
        if (priority) where.priority = priority as Prisma.EnumTicketPriorityFilter;
        if (orgId) where.organizationId = orgId;

        const [tickets, total] = await Promise.all([
            prisma.supportTicket.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    organization: {
                        select: { name: true, slug: true }
                    },
                    submittedBy: {
                        select: { name: true, email: true }
                    },
                    assignedTo: {
                        select: { name: true, email: true }
                    },
                    _count: {
                        select: { comments: true }
                    }
                }
            }),
            prisma.supportTicket.count({ where })
        ]);

        return NextResponse.json({
            tickets,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Tickets] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
