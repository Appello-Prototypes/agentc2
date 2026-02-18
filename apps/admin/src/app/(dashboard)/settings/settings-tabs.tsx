"use client";

import { useState } from "react";
import { AdminUsersManager } from "./admin-users-manager";
import { IntegrationsManager } from "./integrations-manager";

type AdminUser = {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    mfaEnabled: boolean;
    lastLoginAt: string | null;
    createdAt: string;
};

type TabId = "admin-users" | "integrations";

export function SettingsTabs({
    initialAdmins,
    currentAdminId
}: {
    initialAdmins: AdminUser[];
    currentAdminId: string;
}) {
    const [tab, setTab] = useState<TabId>("admin-users");

    return (
        <div className="space-y-4">
            <div className="border-border flex items-center gap-2 border-b">
                <button
                    onClick={() => setTab("admin-users")}
                    className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                        tab === "admin-users"
                            ? "border-border bg-card border-x border-t"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Admin Users
                </button>
                <button
                    onClick={() => setTab("integrations")}
                    className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                        tab === "integrations"
                            ? "border-border bg-card border-x border-t"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Integrations
                </button>
            </div>

            {tab === "admin-users" ? (
                <AdminUsersManager initialAdmins={initialAdmins} currentAdminId={currentAdminId} />
            ) : (
                <IntegrationsManager />
            )}
        </div>
    );
}
