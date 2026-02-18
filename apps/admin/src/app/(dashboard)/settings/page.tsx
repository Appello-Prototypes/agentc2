import { prisma } from "@repo/database";
import { cookies } from "next/headers";
import { validateAdminSession } from "@repo/admin-auth";
import { AdminUsersManager } from "./admin-users-manager";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-auth-token")?.value;
    const session = token ? await validateAdminSession(token) : null;

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

    const serialized = admins.map((a) => ({
        ...a,
        lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString()
    }));

    return (
        <AdminUsersManager initialAdmins={serialized} currentAdminId={session?.adminUserId ?? ""} />
    );
}
