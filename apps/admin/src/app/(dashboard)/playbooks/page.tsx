import Link from "next/link";
import { prisma, Prisma } from "@repo/database";
import { Search, PackageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "bg-zinc-500/10 text-zinc-400",
    PENDING_REVIEW: "bg-yellow-500/10 text-yellow-400",
    PUBLISHED: "bg-green-500/10 text-green-400",
    SUSPENDED: "bg-red-500/10 text-red-400",
    ARCHIVED: "bg-zinc-500/10 text-zinc-500"
};

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_REVIEW: "Pending Review",
    PUBLISHED: "Published",
    SUSPENDED: "Suspended",
    ARCHIVED: "Archived"
};

export default async function PlaybooksPage({
    searchParams
}: {
    searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
    const params = await searchParams;
    const search = params.search || "";
    const status = params.status || "";
    const page = parseInt(params.page || "1");
    const limit = 25;
    const skip = (page - 1) * limit;

    const where: Prisma.PlaybookWhereInput = {};
    if (status) where.status = status as Prisma.EnumPlaybookStatusFilter;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } }
        ];
    }

    const [playbooks, total, pendingCount] = await Promise.all([
        prisma.playbook.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip,
            take: limit,
            include: {
                publisherOrg: {
                    select: { name: true, slug: true }
                },
                _count: {
                    select: { components: true, installations: true }
                }
            }
        }),
        prisma.playbook.count({ where }),
        prisma.playbook.count({ where: { status: "PENDING_REVIEW" } })
    ]);

    const totalPages = Math.ceil(total / limit);
    const allStatuses = ["", "PENDING_REVIEW", "DRAFT", "PUBLISHED", "SUSPENDED", "ARCHIVED"];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">Playbooks</h1>
                    {pendingCount > 0 && (
                        <span className="rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                            {pendingCount} pending review
                        </span>
                    )}
                </div>
                <span className="text-muted-foreground text-sm">{total} total</span>
            </div>

            <div className="flex items-center gap-3">
                <form className="relative flex-1" action="/playbooks">
                    <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    {status && <input type="hidden" name="status" value={status} />}
                    <input
                        name="search"
                        defaultValue={search}
                        placeholder="Search by name or slug..."
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-3 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                </form>
                <div className="flex gap-1">
                    {allStatuses.map((s) => {
                        const isActive = status === s;
                        const label = s === "" ? "All" : (STATUS_LABELS[s] ?? s);
                        const href = s
                            ? `/playbooks?status=${s}${search ? `&search=${search}` : ""}`
                            : `/playbooks${search ? `?search=${search}` : ""}`;
                        return (
                            <Link
                                key={s || "all"}
                                href={href}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                    isActive
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent/50"
                                }`}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-3 text-left font-medium">Playbook</th>
                            <th className="px-4 py-3 text-left font-medium">Publisher</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Category</th>
                            <th className="px-4 py-3 text-right font-medium">Components</th>
                            <th className="px-4 py-3 text-right font-medium">Installs</th>
                            <th className="px-4 py-3 text-right font-medium">Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {playbooks.map((pb) => (
                            <tr
                                key={pb.id}
                                className="border-border hover:bg-accent/50 border-b transition-colors last:border-0"
                            >
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/playbooks/${pb.id}`}
                                        className="font-medium hover:underline"
                                    >
                                        {pb.name}
                                    </Link>
                                    <div className="text-muted-foreground text-xs">{pb.slug}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/tenants/${pb.publisherOrg.slug}`}
                                        className="text-xs hover:underline"
                                    >
                                        {pb.publisherOrg.name}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[pb.status] ?? ""}`}
                                    >
                                        {STATUS_LABELS[pb.status] ?? pb.status}
                                    </span>
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {pb.category}
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-right text-xs">
                                    {pb._count.components}
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-right text-xs">
                                    {pb._count.installations}
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-right text-xs">
                                    {pb.updatedAt.toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {playbooks.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    <PackageIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                    No playbooks found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex flex-1 justify-center gap-2">
                    {page > 1 && (
                        <Link
                            href={`/playbooks?page=${page - 1}${status ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
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
                            href={`/playbooks?page=${page + 1}${status ? `&status=${status}` : ""}${search ? `&search=${search}` : ""}`}
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
