import Link from "next/link";
import { prisma, Prisma } from "@repo/database";
import { Search, Users as UsersIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage({
    searchParams
}: {
    searchParams: Promise<{ search?: string; page?: string }>;
}) {
    const params = await searchParams;
    const search = params.search || "";
    const page = parseInt(params.page || "1");
    const limit = 25;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
        ];
    }

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit
        }),
        prisma.user.count({ where })
    ]);

    // User has no memberships relation — look them up separately
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

    // Group memberships by userId
    const membershipsByUser = new Map<string, typeof memberships>();
    for (const m of memberships) {
        const existing = membershipsByUser.get(m.userId) || [];
        existing.push(m);
        membershipsByUser.set(m.userId, existing);
    }

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Users</h1>
                <span className="text-muted-foreground text-sm">{total} total</span>
            </div>

            {/* Search */}
            <form className="relative" action="/users">
                <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                <input
                    name="search"
                    defaultValue={search}
                    placeholder="Search by name or email..."
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-3 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
            </form>

            {/* Table */}
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-3 text-left font-medium">Name</th>
                            <th className="px-4 py-3 text-left font-medium">Email</th>
                            <th className="px-4 py-3 text-left font-medium">Organizations</th>
                            <th className="px-4 py-3 text-left font-medium">Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => {
                            const userMemberships = membershipsByUser.get(user.id) || [];
                            return (
                                <tr
                                    key={user.id}
                                    className="border-border hover:bg-accent/50 border-b transition-colors last:border-0"
                                >
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/users/${user.id}`}
                                            className="font-medium hover:underline"
                                        >
                                            {user.name}
                                        </Link>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {user.email}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {userMemberships.map((m) => (
                                                <Link
                                                    key={m.id}
                                                    href={`/tenants/${m.organization.slug}`}
                                                    className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs hover:underline"
                                                >
                                                    {m.organization.name} ({m.role})
                                                </Link>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {user.createdAt.toLocaleDateString()}
                                    </td>
                                </tr>
                            );
                        })}
                        {users.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    <UsersIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                    No users found
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
                            href={`/users?page=${page - 1}${search ? `&search=${search}` : ""}`}
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
                            href={`/users?page=${page + 1}${search ? `&search=${search}` : ""}`}
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
