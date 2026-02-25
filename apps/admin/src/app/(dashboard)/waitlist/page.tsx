import Link from "next/link";
import { prisma, Prisma } from "@repo/database";
import { Search } from "lucide-react";
import { PlatformInviteManager } from "@/components/platform-invite-manager";
import { WaitlistTable } from "@/components/waitlist-table";

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

    const serializedInvites = platformInvites.map((i) => ({
        ...i,
        expiresAt: i.expiresAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString()
    }));

    const serializedEntries = entries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString()
    }));

    const buildUrl = (overrides: Record<string, string | number>) => {
        const p = new URLSearchParams();
        const merged = {
            search,
            status: statusFilter,
            page: String(page),
            ...overrides
        };
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

            {/* Table with checkboxes and bulk actions */}
            <WaitlistTable entries={serializedEntries} statusStyles={STATUS_STYLES} />

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
