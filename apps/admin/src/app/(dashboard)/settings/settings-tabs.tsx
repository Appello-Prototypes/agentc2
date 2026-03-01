"use client";

import { useState } from "react";
import { AdminUsersManager } from "./admin-users-manager";
import { IntegrationsManager } from "./integrations-manager";
import { DispatchConfigManager } from "./dispatch-config";

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

type TabId = "admin-users" | "integrations" | "dispatch";

export function SettingsTabs({
    initialAdmins,
    currentAdminId
}: {
    initialAdmins: AdminUser[];
    currentAdminId: string;
}) {
    const [tab, setTab] = useState<TabId>("admin-users");

    const tabs: { id: TabId; label: string }[] = [
        { id: "admin-users", label: "Admin Users" },
        { id: "integrations", label: "Integrations" },
        { id: "dispatch", label: "Dispatch" }
    ];

    return (
        <div className="space-y-4">
            <div className="border-border flex items-center gap-2 border-b">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`rounded-t-md px-3 py-2 text-sm font-medium ${
                            tab === t.id
                                ? "border-border bg-card border-x border-t"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "admin-users" && (
                <AdminUsersManager initialAdmins={initialAdmins} currentAdminId={currentAdminId} />
            )}
            {tab === "integrations" && <IntegrationsManager />}
            {tab === "dispatch" && <DispatchConfigManager />}
        </div>
    );
}
