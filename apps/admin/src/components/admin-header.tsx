"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function AdminHeader({ adminName, adminRole }: { adminName?: string; adminRole?: string }) {
    const router = useRouter();

    async function handleLogout() {
        await fetch("/admin/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });
        router.push("/login");
    }

    return (
        <header className="bg-card border-border flex h-14 items-center justify-between border-b px-6">
            <div className="text-muted-foreground text-sm">Admin Console</div>
            <div className="flex items-center gap-4">
                {adminName && (
                    <span className="text-muted-foreground text-sm">
                        {adminName}
                        {adminRole && (
                            <span className="bg-secondary text-secondary-foreground ml-2 rounded-full px-2 py-0.5 text-xs">
                                {adminRole}
                            </span>
                        )}
                    </span>
                )}
                <button
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </button>
            </div>
        </header>
    );
}
