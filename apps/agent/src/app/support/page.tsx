import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, Prisma } from "@repo/database";
import { auth } from "@repo/auth";
import { getUserOrganizationId } from "@/lib/organization";
import { Search, TicketIcon, Plus } from "lucide-react";
import { SupportChatWidget } from "./support-chat-widget";

export const dynamic = "force-dynamic";

export default async function SupportTicketsPage({
    searchParams
}: {
    searchParams: Promise<{
        search?: string;
        status?: string;
        type?: string;
        page?: string;
    }>;
}) {
    const session = await auth.api.getSession({
        headers: await headers()
    });
    if (!session?.user) redirect("/login");

    const organizationId = await getUserOrganizationId(session.user.id);
    if (!organizationId) redirect("/login");

    const params = await searchParams;
    const search = params.search || "";
    const status = params.status || "";
    const type = params.type || "";
    const page = parseInt(params.page || "1");
    const limit = 25;
    const skip = (page - 1) * limit;

    const where: Prisma.SupportTicketWhereInput = { organizationId };
    if (search) {
        const searchNum = parseInt(search);
        if (!isNaN(searchNum)) {
            where.OR = [
                { ticketNumber: searchNum, organizationId },
                { title: { contains: search, mode: "insensitive" }, organizationId }
            ];
            delete where.organizationId;
        } else {
            where.title = { contains: search, mode: "insensitive" };
        }
    }
    if (status) where.status = status as Prisma.EnumTicketStatusFilter;
    if (type) where.type = type as Prisma.EnumTicketTypeFilter;

    const orgScope = { organizationId };

    const [tickets, total, kpis] = await Promise.all([
        prisma.supportTicket.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                submittedBy: { select: { name: true, email: true } },
                _count: { select: { comments: true } }
            }
        }),
        prisma.supportTicket.count({ where }),
        Promise.all([
            prisma.supportTicket.count({
                where: {
                    ...orgScope,
                    status: { in: ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] }
                }
            }),
            prisma.supportTicket.count({ where: { ...orgScope, type: "BUG" } }),
            prisma.supportTicket.count({ where: { ...orgScope, type: "FEATURE_REQUEST" } }),
            prisma.supportTicket.count({
                where: { ...orgScope, priority: { in: ["CRITICAL", "HIGH"] } }
            })
        ])
    ]);

    const [openCount, bugCount, featureCount, urgentCount] = kpis;
    const totalPages = Math.ceil(total / limit);

    const statuses = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"];
    const types = ["BUG", "FEATURE_REQUEST", "IMPROVEMENT", "QUESTION"];

    function buildFilterUrl(overrides: Record<string, string>) {
        const p = new URLSearchParams();
        const merged = { search, status, type, ...overrides };
        for (const [k, v] of Object.entries(merged)) {
            if (v) p.set(k, v);
        }
        return `/support?${p.toString()}`;
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Support Tickets</h1>
                        <p className="text-muted-foreground text-sm">
                            {total} ticket{total !== 1 ? "s" : ""} submitted by your organization
                        </p>
                    </div>
                    <Link
                        href="/support/new"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        New Ticket
                    </Link>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="bg-card border-border rounded-lg border p-4">
                        <p className="text-muted-foreground text-sm">Open</p>
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
                        <p className="text-muted-foreground text-sm">Urgent</p>
                        <p className="text-3xl font-bold">{urgentCount}</p>
                    </div>
                </div>

                {/* Search */}
                <div className="flex flex-wrap items-center gap-3">
                    <form className="relative flex-1" action="/support">
                        <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                        <input
                            name="search"
                            defaultValue={search}
                            placeholder="Search by title or ticket number..."
                            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-3 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        />
                        {status && <input type="hidden" name="status" value={status} />}
                        {type && <input type="hidden" name="type" value={type} />}
                    </form>
                </div>

                {/* Status filters */}
                <div className="flex flex-wrap gap-1">
                    <span className="text-muted-foreground mr-1 py-1.5 text-xs">Status:</span>
                    <FilterLink
                        href={buildFilterUrl({ status: "" })}
                        label="All"
                        active={!status}
                    />
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

                {/* Table */}
                <div className="bg-card border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-3 text-left font-medium">#</th>
                                <th className="px-4 py-3 text-left font-medium">Type</th>
                                <th className="px-4 py-3 text-left font-medium">Title</th>
                                <th className="px-4 py-3 text-left font-medium">Submitter</th>
                                <th className="px-4 py-3 text-left font-medium">Priority</th>
                                <th className="px-4 py-3 text-left font-medium">Status</th>
                                <th className="px-4 py-3 text-left font-medium">Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map((ticket) => (
                                <tr
                                    key={ticket.id}
                                    className="border-border hover:bg-accent/50 border-b transition-colors last:border-0"
                                >
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/support/${ticket.id}`}
                                            className="font-mono text-xs font-medium hover:underline"
                                        >
                                            #{ticket.ticketNumber}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3">
                                        <TypeBadge type={ticket.type} />
                                    </td>
                                    <td className="max-w-xs px-4 py-3">
                                        <Link
                                            href={`/support/${ticket.id}`}
                                            className="line-clamp-1 font-medium hover:underline"
                                        >
                                            {ticket.title}
                                        </Link>
                                        {ticket._count.comments > 0 && (
                                            <span className="text-muted-foreground ml-2 text-xs">
                                                ({ticket._count.comments} comments)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs">{ticket.submittedBy.name}</span>
                                        <div className="text-muted-foreground text-xs">
                                            {ticket.submittedBy.email}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <PriorityBadge priority={ticket.priority} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={ticket.status} />
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {ticket.createdAt.toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {tickets.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="text-muted-foreground px-4 py-8 text-center"
                                    >
                                        <TicketIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                        No tickets found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

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
            <SupportChatWidget />
        </div>
    );
}

function formatLabel(s: string) {
    return s
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function TypeBadge({ type }: { type: string }) {
    const colors: Record<string, string> = {
        BUG: "bg-red-500/10 text-red-500",
        FEATURE_REQUEST: "bg-purple-500/10 text-purple-500",
        IMPROVEMENT: "bg-blue-500/10 text-blue-500",
        QUESTION: "bg-gray-500/10 text-gray-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] || "bg-gray-500/10 text-gray-500"}`}
        >
            {formatLabel(type)}
        </span>
    );
}

function PriorityBadge({ priority }: { priority: string }) {
    const colors: Record<string, string> = {
        CRITICAL: "bg-red-500/10 text-red-500",
        HIGH: "bg-orange-500/10 text-orange-500",
        MEDIUM: "bg-yellow-500/10 text-yellow-500",
        LOW: "bg-green-500/10 text-green-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[priority] || "bg-gray-500/10 text-gray-500"}`}
        >
            {formatLabel(priority)}
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        NEW: "bg-blue-500/10 text-blue-500",
        TRIAGED: "bg-indigo-500/10 text-indigo-500",
        IN_PROGRESS: "bg-yellow-500/10 text-yellow-500",
        WAITING_ON_CUSTOMER: "bg-orange-500/10 text-orange-500",
        RESOLVED: "bg-green-500/10 text-green-500",
        CLOSED: "bg-gray-500/10 text-gray-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-500/10 text-gray-500"}`}
        >
            {formatLabel(status)}
        </span>
    );
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
