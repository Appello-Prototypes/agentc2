"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Pause, Play, Power, RotateCcw, Loader2 } from "lucide-react";

interface TenantRowActionsProps {
    orgId: string;
    orgSlug: string;
    status: string;
}

export function TenantRowActions({ orgId, orgSlug, status }: TenantRowActionsProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [confirmAction, setConfirmAction] = useState<string | null>(null);

    const canSuspend = status === "active" || status === "trial" || status === "past_due";
    const canReactivate = status === "suspended";
    const canDeactivate = status !== "deactivated";
    const canRestore = status === "deactivated";

    const executeAction = async (endpoint: string) => {
        setOpen(false);
        setConfirmAction(null);
        setLoading(true);
        try {
            const res = await fetch(`/admin/api/tenants/${orgId}/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: `Via admin tenants list` }),
                credentials: "include"
            });
            if (res.ok) router.refresh();
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <Loader2 className="ml-auto h-4 w-4 animate-spin opacity-50" />;
    }

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setOpen(!open)}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1 transition-colors"
                title="Actions"
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="border-border bg-popover absolute top-full right-0 z-20 mt-1 w-44 rounded-md border py-1 shadow-lg">
                        <a
                            href={`/admin/tenants/${orgSlug}`}
                            className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                        </a>

                        {canSuspend && (
                            <>
                                <div className="border-border my-1 border-t" />
                                <button
                                    onClick={() => executeAction("suspend")}
                                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400"
                                >
                                    <Pause className="h-3.5 w-3.5" />
                                    Suspend
                                </button>
                            </>
                        )}

                        {canReactivate && (
                            <>
                                <div className="border-border my-1 border-t" />
                                <button
                                    onClick={() => executeAction("reactivate")}
                                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs text-green-600 dark:text-green-400"
                                >
                                    <Play className="h-3.5 w-3.5" />
                                    Reactivate
                                </button>
                            </>
                        )}

                        {canRestore && (
                            <>
                                <div className="border-border my-1 border-t" />
                                <button
                                    onClick={() => executeAction("restore")}
                                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs text-blue-600 dark:text-blue-400"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Restore
                                </button>
                            </>
                        )}

                        {canDeactivate && (
                            <>
                                <div className="border-border my-1 border-t" />
                                {confirmAction === "deactivate" ? (
                                    <div className="space-y-1 px-3 py-2">
                                        <p className="text-xs font-medium text-red-600 dark:text-red-400">
                                            Confirm deactivation?
                                        </p>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => executeAction("deactivate")}
                                                className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                                            >
                                                Yes
                                            </button>
                                            <button
                                                onClick={() => setConfirmAction(null)}
                                                className="hover:bg-accent rounded px-2 py-1 text-xs"
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmAction("deactivate")}
                                        className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400"
                                    >
                                        <Power className="h-3.5 w-3.5" />
                                        Deactivate
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
