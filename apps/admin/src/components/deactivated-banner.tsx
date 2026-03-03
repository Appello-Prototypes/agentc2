"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Loader2 } from "lucide-react";

interface DeactivatedBannerProps {
    orgId: string;
    orgName: string;
    deletedAt: string | null;
    purgeDate: string | null;
}

export function DeactivatedBanner({
    orgId,
    orgName,
    deletedAt,
    purgeDate
}: DeactivatedBannerProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleRestore = async () => {
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`/admin/api/tenants/${orgId}/restore`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: `Restored via banner for ${orgName}` }),
                credentials: "include"
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Failed to restore tenant");
                return;
            }

            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const deactivatedDate = deletedAt ? new Date(deletedAt).toLocaleDateString() : "unknown date";
    const purgeByDate = purgeDate ? new Date(purgeDate).toLocaleDateString() : "unknown date";

    return (
        <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                <div>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        This tenant has been deactivated
                    </p>
                    <p className="text-muted-foreground text-xs">
                        Deactivated on {deactivatedDate}. Data will be permanently purged after{" "}
                        {purgeByDate}.
                    </p>
                    {error && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
                    )}
                </div>
            </div>
            <button
                onClick={handleRestore}
                disabled={loading}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                )}
                {loading ? "Restoring..." : "Restore Tenant"}
            </button>
        </div>
    );
}
