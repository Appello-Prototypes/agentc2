"use client";

import { useState } from "react";
import { LogIn, Loader2 } from "lucide-react";

interface ImpersonateButtonProps {
    userId: string;
    userName: string;
}

export function ImpersonateButton({ userId, userName }: ImpersonateButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleImpersonate = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`/admin/api/users/${userId}/impersonate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to impersonate");
                return;
            }

            window.open(data.redirectUrl, "_blank");
        } catch {
            setError("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleImpersonate}
                disabled={loading}
                title={`Login as ${userName}`}
                className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/20 disabled:opacity-50 dark:text-blue-400"
            >
                {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <LogIn className="h-3 w-3" />
                )}
                Login as
            </button>
            {error && (
                <span className="absolute top-full left-0 z-10 mt-1 rounded bg-red-500/10 px-2 py-0.5 text-xs whitespace-nowrap text-red-500">
                    {error}
                </span>
            )}
        </div>
    );
}
