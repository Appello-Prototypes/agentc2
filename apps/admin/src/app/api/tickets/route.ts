import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@repo/database";
import { requireAdminAction, AdminAuthError } from "@repo/admin-auth";
import { adminAudit, getRequestContext } from "@/lib/admin-audit";

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

export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdminAction(request, "ticket:create");
        const body = await request.json();

        const {
            title,
            description,
            type,
            priority,
            organizationId,
            submittedById,
            assignedToId,
            tags
        } = body;

        if (!title || typeof title !== "string" || !title.trim()) {
            return NextResponse.json({ error: "title is required" }, { status: 400 });
        }
        if (!description || typeof description !== "string" || !description.trim()) {
            return NextResponse.json({ error: "description is required" }, { status: 400 });
        }
        if (!type || !["BUG", "FEATURE_REQUEST", "IMPROVEMENT", "QUESTION"].includes(type)) {
            return NextResponse.json({ error: "valid type is required" }, { status: 400 });
        }
        if (!organizationId) {
            return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
        }
        if (!submittedById) {
            return NextResponse.json({ error: "submittedById is required" }, { status: 400 });
        }

        const org = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!org) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const user = await prisma.user.findUnique({ where: { id: submittedById } });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const data: Prisma.SupportTicketCreateInput = {
            title: title.trim(),
            description: description.trim(),
            type,
            priority:
                priority && ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priority)
                    ? priority
                    : "MEDIUM",
            organization: { connect: { id: organizationId } },
            submittedBy: { connect: { id: submittedById } },
            tags: Array.isArray(tags)
                ? tags.filter((t: unknown) => typeof t === "string" && t.trim())
                : []
        };

        if (assignedToId) {
            data.assignedTo = { connect: { id: assignedToId } };
        }

        const ticket = await prisma.supportTicket.create({
            data,
            include: {
                organization: { select: { name: true, slug: true } },
                submittedBy: { select: { name: true, email: true } },
                assignedTo: { select: { name: true, email: true } }
            }
        });

        const { ipAddress, userAgent } = getRequestContext(request);
        await adminAudit.log({
            adminUserId: admin.adminUserId,
            action: "TICKET_CREATE",
            entityType: "SupportTicket",
            entityId: ticket.id,
            afterJson: {
                title: ticket.title,
                type: ticket.type,
                priority: ticket.priority,
                organizationId: ticket.organizationId,
                submittedById: (ticket as { submittedById: string }).submittedById
            },
            ipAddress,
            userAgent
        });

        return NextResponse.json({ ticket }, { status: 201 });
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[Admin Ticket Create] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
