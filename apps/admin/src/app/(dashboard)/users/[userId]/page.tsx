import { notFound } from "next/navigation";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = await params;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            sessions: {
                orderBy: { createdAt: "desc" },
                take: 5
            }
        }
    });

    if (!user) notFound();

    // User has no memberships relation — look them up separately
    const userMemberships = await prisma.membership.findMany({
        where: { userId: user.id },
        include: {
            organization: { select: { name: true, slug: true, status: true } }
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{user.name}</h1>
                <div className="flex gap-2">
                    <form action={`/admin/api/users/${user.id}/reset-password`} method="POST">
                        <button
                            type="submit"
                            className="rounded-md bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-600 hover:bg-yellow-500/20"
                        >
                            Reset Password
                        </button>
                    </form>
                    <form action={`/admin/api/users/${user.id}/force-logout`} method="POST">
                        <button
                            type="submit"
                            className="rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20"
                        >
                            Force Logout
                        </button>
                    </form>
                </div>
            </div>

            {/* User details */}
            <div className="bg-card border-border rounded-lg border p-4">
                <h2 className="mb-3 text-sm font-semibold">Details</h2>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">ID</dt>
                    <dd className="font-mono text-xs">{user.id}</dd>

                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{user.email}</dd>

                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{user.createdAt.toISOString()}</dd>

                    <dt className="text-muted-foreground">Updated</dt>
                    <dd>{user.updatedAt.toISOString()}</dd>

                    <dt className="text-muted-foreground">Email Verified</dt>
                    <dd>{user.emailVerified ? "Yes" : "No"}</dd>
                </dl>
            </div>

            {/* Memberships */}
            <div>
                <h2 className="mb-3 text-sm font-semibold">
                    Organization Memberships ({userMemberships.length})
                </h2>
                <div className="bg-card border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-2 text-left font-medium">Organization</th>
                                <th className="px-4 py-2 text-left font-medium">Role</th>
                                <th className="px-4 py-2 text-left font-medium">Org Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userMemberships.map((m) => (
                                <tr key={m.id} className="border-border border-b last:border-0">
                                    <td className="px-4 py-2">{m.organization.name}</td>
                                    <td className="px-4 py-2">
                                        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                                            {m.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-xs">{m.organization.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Active sessions */}
            <div>
                <h2 className="mb-3 text-sm font-semibold">
                    Recent Sessions ({user.sessions.length})
                </h2>
                <div className="bg-card border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-border border-b">
                                <th className="px-4 py-2 text-left font-medium">Token</th>
                                <th className="px-4 py-2 text-left font-medium">IP</th>
                                <th className="px-4 py-2 text-left font-medium">Expires</th>
                                <th className="px-4 py-2 text-left font-medium">Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {user.sessions.map((s) => (
                                <tr key={s.id} className="border-border border-b last:border-0">
                                    <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                                        {s.token.substring(0, 16)}...
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-xs">
                                        {s.ipAddress || "—"}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-xs">
                                        {s.expiresAt.toISOString()}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-2 text-xs">
                                        {s.createdAt.toISOString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
