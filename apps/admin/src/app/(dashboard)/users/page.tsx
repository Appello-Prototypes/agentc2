import Link from "next/link";
import { prisma, Prisma } from "@repo/database";
import {
    Search,
    Users as UsersIcon,
    ArrowUp,
    ArrowDown,
    Activity,
    Snowflake,
    Trash2
} from "lucide-react";
import { UsersTable } from "@/components/users-table";
import { getServerTimezone } from "@/lib/timezone-server";

export const dynamic = "force-dynamic";

type SortField = "name" | "email" | "status" | "created";
type SortDir = "asc" | "desc";

const SORTABLE_COLUMNS: { key: SortField; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "status", label: "Status" },
    { key: "created", label: "Joined" }
];

function buildOrderBy(sort: SortField, dir: SortDir): Prisma.UserOrderByWithRelationInput {
    switch (sort) {
        case "name":
            return { name: dir };
        case "email":
            return { email: dir };
        case "status":
            return { status: dir };
        case "created":
            return { createdAt: dir };
        default:
            return { createdAt: dir };
    }
}

export default async function UsersPage({
    searchParams
}: {
    searchParams: Promise<{
        search?: string;
        status?: string;
        page?: string;
        sort?: string;
        dir?: string;
    }>;
}) {
    const params = await searchParams;
    const search = params.search || "";
    const status = params.status || "";
    const page = parseInt(params.page || "1");
    const sort = (params.sort as SortField) || "created";
    const dir = (params.dir as SortDir) || "desc";
    const limit = 25;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
        ];
    }
    if (status) {
        where.status = status;
    }

    const tz = await getServerTimezone();

    const [users, total, statusCounts] = await Promise.all([
        prisma.user.findMany({
            where,
            orderBy: buildOrderBy(sort, dir),
            skip,
            take: limit
        }),
        prisma.user.count({ where }),
        prisma.user.groupBy({
            by: ["status"],
            _count: { id: true }
        })
    ]);

    const userIds = users.map((u) => u.id);
    const memberships =
        userIds.length > 0
            ? await prisma.membership.findMany({
                  where: { userId: { in: userIds } },
                  include: {
                      organization: { select: { name: true, slug: true } }
                  }
              })
            : [];

    const membershipsByUser = new Map<string, typeof memberships>();
    for (const m of memberships) {
        const existing = membershipsByUser.get(m.userId) || [];
        existing.push(m);
        membershipsByUser.set(m.userId, existing);
    }

    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
        statusMap[row.status] = row._count.id;
    }
    const totalUsers = Object.values(statusMap).reduce((a, b) => a + b, 0);

    const totalPages = Math.ceil(total / limit);
    const statuses = ["active", "frozen", "deleted"];

    function buildUrl(overrides: Record<string, string | undefined>) {
        const base: Record<string, string> = {};
        if (search) base.search = search;
        if (status) base.status = status;
        if (sort !== "created") base.sort = sort;
        if (dir !== "desc") base.dir = dir;
        const merged = { ...base, ...overrides };
        const qs = Object.entries(merged)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
            .join("&");
        return `/users${qs ? `?${qs}` : ""}`;
    }

    const tableUsers = users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        memberships: (membershipsByUser.get(user.id) || []).map((m) => ({
            id: m.id,
            role: m.role,
            organization: { name: m.organization.name, slug: m.organization.slug }
        }))
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">Users</h1>
                    <span className="text-muted-foreground text-sm">{total} total</span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                    title="Total Users"
                    value={totalUsers}
                    icon={<UsersIcon className="h-4 w-4" />}
                />
                <KpiCard
                    title="Active"
                    value={statusMap["active"] ?? 0}
                    accent="green"
                    icon={<Activity className="h-4 w-4" />}
                />
                <KpiCard
                    title="Frozen"
                    value={statusMap["frozen"] ?? 0}
                    accent={statusMap["frozen"] ? "yellow" : undefined}
                    icon={<Snowflake className="h-4 w-4" />}
                />
                <KpiCard
                    title="Deleted"
                    value={statusMap["deleted"] ?? 0}
                    accent={statusMap["deleted"] ? "red" : undefined}
                    icon={<Trash2 className="h-4 w-4" />}
                />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <form className="relative flex-1" action="/users">
                    <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <input
                        name="search"
                        defaultValue={search}
                        placeholder="Search by name or email..."
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-3 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                    {status && <input type="hidden" name="status" value={status} />}
                </form>
                <div className="flex gap-1">
                    <FilterLink href="/users" label="All" active={!status} />
                    {statuses.map((s) => (
                        <FilterLink
                            key={s}
                            href={`/users?status=${s}${search ? `&search=${search}` : ""}`}
                            label={s}
                            active={status === s}
                        />
                    ))}
                </div>
            </div>

            {/* Sortable Column Headers + Table */}
            <div className="space-y-0">
                {/* Sort header row */}
                <div className="flex items-center gap-2 pb-2">
                    <span className="text-muted-foreground text-xs">Sort by:</span>
                    {SORTABLE_COLUMNS.map((col) => {
                        const isActive = sort === col.key;
                        const nextDir = isActive && dir === "asc" ? "desc" : "asc";
                        const href = buildUrl({
                            sort: col.key,
                            dir: nextDir,
                            page: undefined
                        });
                        return (
                            <Link
                                key={col.key}
                                href={href}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                }`}
                            >
                                {col.label}
                                {isActive &&
                                    (dir === "asc" ? (
                                        <ArrowUp className="h-3 w-3" />
                                    ) : (
                                        <ArrowDown className="h-3 w-3" />
                                    ))}
                            </Link>
                        );
                    })}
                </div>

                <UsersTable users={tableUsers} tz={tz} />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {page > 1 && (
                        <Link
                            href={buildUrl({ page: String(page - 1) })}
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
                            href={buildUrl({ page: String(page + 1) })}
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
    title,
    value,
    accent,
    icon
}: {
    title: string;
    value: number;
    accent?: "green" | "red" | "yellow";
    icon?: React.ReactNode;
}) {
    const accentMap: Record<string, string> = {
        green: "text-green-500",
        red: "text-red-500",
        yellow: "text-yellow-500"
    };

    return (
        <div className="bg-card border-border rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">{title}</p>
                {icon && <span className="text-muted-foreground">{icon}</span>}
            </div>
            <p className={`mt-1 text-2xl font-bold ${accentMap[accent ?? ""] ?? ""}`}>
                {value.toLocaleString()}
            </p>
        </div>
    );
}

// ─── Filter Link ──────────────────────────────────────────────────────────────

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
        >
            {label}
        </Link>
    );
}
