import Link from "next/link";
import { prisma, Prisma } from "@repo/database";
import { Search, ClipboardList } from "lucide-react";
import { PlatformInviteManager } from "@/components/platform-invite-manager";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    invited: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    registered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
};

const SIGNUP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agentc2.ai";

export default async function WaitlistPage({
    searchParams
}: {
    searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
    const params = await searchParams;
    const search = params.search || "";
    const statusFilter = params.status || "";
    const page = parseInt(params.page || "1");
    const limit = 25;
    const skip = (page - 1) * limit;

    const where: Prisma.WaitlistWhereInput = {};
    if (search) {
        where.OR = [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } }
        ];
    }
    if (statusFilter) {
        where.status = statusFilter;
    }

    const [entries, total, statusCounts, platformInvites] = await Promise.all([
        prisma.waitlist.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit
        }),
        prisma.waitlist.count({ where }),
        prisma.waitlist.groupBy({
            by: ["status"],
            _count: { _all: true }
        }),
        prisma.platformInvite.findMany({
            orderBy: { createdAt: "desc" }
        })
    ]);

    const totalPages = Math.ceil(total / limit);
    const totalAll = statusCounts.reduce((sum, s) => sum + s._count._all, 0);
    const countByStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));

    // Serialize dates for the client component
    const serializedInvites = platformInvites.map((i) => ({
        ...i,
        expiresAt: i.expiresAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString()
    }));

    // Build pagination URL
    const buildUrl = (overrides: Record<string, string | number>) => {
        const p = new URLSearchParams();
        const merged = { search, status: statusFilter, page: String(page), ...overrides };
        for (const [k, v] of Object.entries(merged)) {
            if (v) p.set(k, String(v));
        }
        return `/waitlist?${p.toString()}`;
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Waitlist</h1>
                <span className="text-muted-foreground text-sm">{totalAll} on waitlist</span>
            </div>

            {/* ── Platform Invite Codes (interactive client component) */}
            <PlatformInviteManager
                initialInvites={serializedInvites}
                signupBaseUrl={SIGNUP_BASE_URL}
            />

            {/* ── Waitlist Entries ────────────────────────────────── */}
            <div className="border-border border-t pt-6">
                <h2 className="mb-4 text-lg font-semibold">Waitlist Signups</h2>
            </div>

            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2">
                <Link
                    href={buildUrl({ status: "", page: 1 })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        !statusFilter
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                >
                    All ({totalAll})
                </Link>
                {["pending", "invited", "registered"].map((s) => (
                    <Link
                        key={s}
                        href={buildUrl({ status: s, page: 1 })}
                        className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                            statusFilter === s
                                ? "bg-primary text-primary-foreground border-transparent"
                                : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                    >
                        {s} ({countByStatus[s] || 0})
                    </Link>
                ))}
            </div>

            {/* Search */}
            <form className="relative" action="/waitlist">
                {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
                <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                <input
                    name="search"
                    defaultValue={search}
                    placeholder="Search by email or name..."
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-3 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
            </form>

            {/* Table */}
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-3 text-left font-medium">Email</th>
                            <th className="px-4 py-3 text-left font-medium">Name</th>
                            <th className="px-4 py-3 text-left font-medium">Source</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Signed up</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry) => (
                            <tr
                                key={entry.id}
                                className="border-border hover:bg-accent/50 border-b transition-colors last:border-0"
                            >
                                <td className="px-4 py-3 font-medium">{entry.email}</td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {entry.name || "—"}
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {entry.source || "—"}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[entry.status] || "bg-secondary text-secondary-foreground"}`}
                                    >
                                        {entry.status}
                                    </span>
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {entry.createdAt.toLocaleDateString()}{" "}
                                    {entry.createdAt.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit"
                                    })}
                                </td>
                            </tr>
                        ))}
                        {entries.length === 0 && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                    No waitlist entries found
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
                            href={buildUrl({ page: page - 1 })}
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
                            href={buildUrl({ page: page + 1 })}
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
