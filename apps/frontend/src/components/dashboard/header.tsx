"use client";

import { Button } from "@/components/ui";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

interface DashboardHeaderProps {
    user: User;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        router.push("/");
        router.refresh();
    };

    return (
        <header className="border-b">
            <div className="container mx-auto flex h-14 items-center justify-between px-6">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold">Dashboard</h1>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-sm">{user.name || user.email}</span>
                    <ThemeToggle />
                    <Button variant="outline" size="sm" onClick={handleSignOut}>
                        Sign Out
                    </Button>
                </div>
            </div>
        </header>
    );
}
