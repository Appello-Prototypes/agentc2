"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface VerifyEmailButtonProps {
    userId: string;
    emailVerified: boolean;
}

export function VerifyEmailButton({ userId, emailVerified }: VerifyEmailButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const toggle = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/admin/api/users/${userId}/verify-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });
            if (res.ok) router.refresh();
        } finally {
            setLoading(false);
        }
    };

    return (
        <span className="inline-flex items-center gap-2">
            <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    emailVerified ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                }`}
            >
                {emailVerified ? "Yes" : "No"}
            </span>
            <button
                onClick={toggle}
                disabled={loading}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    emailVerified
                        ? "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 dark:text-orange-400"
                        : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400"
                } disabled:opacity-50`}
            >
                {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : emailVerified ? (
                    "Unverify"
                ) : (
                    "Verify"
                )}
            </button>
        </span>
    );
}
