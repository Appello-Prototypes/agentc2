import { prisma } from "@repo/database";
import { Settings } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
    const admins = await prisma.adminUser.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            mfaEnabled: true,
            lastLoginAt: true,
            createdAt: true
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Admin Users</h1>
                <span className="text-muted-foreground text-sm">{admins.length} admin users</span>
            </div>

            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-3 text-left font-medium">Name</th>
                            <th className="px-4 py-3 text-left font-medium">Email</th>
                            <th className="px-4 py-3 text-left font-medium">Role</th>
                            <th className="px-4 py-3 text-left font-medium">Active</th>
                            <th className="px-4 py-3 text-left font-medium">MFA</th>
                            <th className="px-4 py-3 text-left font-medium">Last Login</th>
                        </tr>
                    </thead>
                    <tbody>
                        {admins.map((admin) => (
                            <tr key={admin.id} className="border-border border-b last:border-0">
                                <td className="px-4 py-3 font-medium">{admin.name}</td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {admin.email}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                                        {admin.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex h-2 w-2 rounded-full ${admin.isActive ? "bg-green-500" : "bg-gray-400"}`}
                                    />
                                </td>
                                <td className="px-4 py-3 text-xs">
                                    {admin.mfaEnabled ? "Enabled" : "—"}
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {admin.lastLoginAt ? admin.lastLoginAt.toISOString() : "Never"}
                                </td>
                            </tr>
                        ))}
                        {admins.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    <Settings className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                    No admin users. Run the seed script.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
