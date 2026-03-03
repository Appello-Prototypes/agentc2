"use client";

import { useRouter } from "next/navigation";
import { LogOut, Globe } from "lucide-react";
import { useTimezone } from "@/lib/timezone-context";
import { TIMEZONE_OPTIONS } from "@/lib/timezone";
import { ThemeToggle } from "./theme-toggle";

export function AdminHeader({ adminName, adminRole }: { adminName?: string; adminRole?: string }) {
    const router = useRouter();
    const { timezone, setTimezone } = useTimezone();

    async function handleLogout() {
        await fetch("/admin/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });
        router.push("/login");
    }

    return (
        <header className="bg-card border-border flex h-14 items-center justify-between border-b px-6">
            <div className="text-muted-foreground text-sm">AgentC2 Admin Portal</div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <Globe className="text-muted-foreground h-3.5 w-3.5" />
                    <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer bg-transparent text-xs transition-colors outline-none"
                    >
                        {TIMEZONE_OPTIONS.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                                {tz.label}
                            </option>
                        ))}
                    </select>
                </div>
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
                <ThemeToggle />
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
