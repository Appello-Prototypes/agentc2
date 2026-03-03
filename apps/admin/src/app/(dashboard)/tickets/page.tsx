import Link from "next/link";
import { prisma, Prisma } from "@repo/database";
import { Search, Plus } from "lucide-react";
import { TicketsTable } from "./tickets-table";

export const dynamic = "force-dynamic";

export default async function TicketsPage({
    searchParams
}: {
    searchParams: Promise<{
        search?: string;
        status?: string;
        type?: string;
        priority?: string;
        page?: string;
    }>;
}) {
    const params = await searchParams;
    const search = params.search || "";
    const status = params.status || "";
    const type = params.type || "";
    const priority = params.priority || "";
    const page = parseInt(params.page || "1");
    const limit = 25;
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

    const [tickets, total, kpis, adminUsers] = await Promise.all([
        prisma.supportTicket.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                organization: { select: { name: true, slug: true } },
                submittedBy: { select: { name: true, email: true } },
                assignedTo: { select: { name: true } },
                _count: { select: { comments: true } }
            }
        }),
        prisma.supportTicket.count({ where }),
        Promise.all([
            prisma.supportTicket.count({
                where: { status: { in: ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] } }
            }),
            prisma.supportTicket.count({ where: { type: "BUG" } }),
            prisma.supportTicket.count({ where: { type: "FEATURE_REQUEST" } }),
            prisma.supportTicket.count({
                where: { priority: { in: ["CRITICAL", "HIGH"] } }
            })
        ]),
        prisma.adminUser.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" }
        })
    ]);

    const [openCount, bugCount, featureCount, urgentCount] = kpis;
    const totalPages = Math.ceil(total / limit);

    const statuses = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"];
    const types = ["BUG", "FEATURE_REQUEST", "IMPROVEMENT", "QUESTION"];

    function buildFilterUrl(overrides: Record<string, string>) {
        const p = new URLSearchParams();
        const merged = { search, status, type, priority, ...overrides };
        for (const [k, v] of Object.entries(merged)) {
            if (v) p.set(k, v);
        }
        return `/tickets?${p.toString()}`;
    }

    const serializedTickets = tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        title: t.title,
        type: t.type,
        status: t.status,
        priority: t.priority,
        assignedToId: t.assignedToId,
        createdAt: t.createdAt.toISOString(),
        organization: t.organization,
        submittedBy: t.submittedBy,
        assignedTo: t.assignedTo,
        _count: t._count
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Support Tickets</h1>
                <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">{total} total</span>
                    <Link
                        href="/tickets/new"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        New Ticket
                    </Link>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Open Tickets</p>
                    <p className="text-3xl font-bold">{openCount}</p>
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Bug Reports</p>
                    <p className="text-3xl font-bold">{bugCount}</p>
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Feature Requests</p>
                    <p className="text-3xl font-bold">{featureCount}</p>
                </div>
                <div className="bg-card border-border rounded-lg border p-4">
                    <p className="text-muted-foreground text-sm">Urgent (Critical/High)</p>
                    <p className="text-3xl font-bold">{urgentCount}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <form className="relative flex-1" action="/tickets">
                    <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <input
                        name="search"
                        defaultValue={search}
                        placeholder="Search by title or ticket number..."
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-3 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                    {status && <input type="hidden" name="status" value={status} />}
                    {type && <input type="hidden" name="type" value={type} />}
                    {priority && <input type="hidden" name="priority" value={priority} />}
                </form>
            </div>

            {/* Status filters */}
            <div className="flex flex-wrap gap-1">
                <span className="text-muted-foreground mr-1 py-1.5 text-xs">Status:</span>
                <FilterLink href={buildFilterUrl({ status: "" })} label="All" active={!status} />
                {statuses.map((s) => (
                    <FilterLink
                        key={s}
                        href={buildFilterUrl({ status: s, page: "" })}
                        label={formatLabel(s)}
                        active={status === s}
                    />
                ))}
            </div>

            {/* Type filters */}
            <div className="flex flex-wrap gap-1">
                <span className="text-muted-foreground mr-1 py-1.5 text-xs">Type:</span>
                <FilterLink href={buildFilterUrl({ type: "" })} label="All" active={!type} />
                {types.map((t) => (
                    <FilterLink
                        key={t}
                        href={buildFilterUrl({ type: t, page: "" })}
                        label={formatLabel(t)}
                        active={type === t}
                    />
                ))}
            </div>

            {/* Table with bulk edit */}
            <TicketsTable tickets={serializedTickets} adminUsers={adminUsers} />

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {page > 1 && (
                        <Link
                            href={buildFilterUrl({ page: String(page - 1) })}
                            className="border-border rounded-md border px-3 py-1 text-sm"
                        >
                            Previous
                        </Link>
                    )}
                    <span className="text-muted-foreground text-sm">
                        Page {page} of {totalPages}
                    </span>
                    {page < totalPages && (
                        <Link
                            href={buildFilterUrl({ page: String(page + 1) })}
                            className="border-border rounded-md border px-3 py-1 text-sm"
                        >
                            Next
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

function formatLabel(s: string) {
    return s
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
        >
            {label}
        </Link>
    );
}
