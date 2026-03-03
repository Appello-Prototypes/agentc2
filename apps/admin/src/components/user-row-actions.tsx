"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Snowflake, Play, Trash2, Loader2 } from "lucide-react";

interface UserRowActionsProps {
    userId: string;
    status: string;
}

export function UserRowActions({ userId, status }: UserRowActionsProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [confirmAction, setConfirmAction] = useState<string | null>(null);

    const canFreeze = status === "active";
    const canActivate = status === "frozen" || status === "deleted";
    const canDelete = status !== "deleted";

    const executeAction = async (endpoint: string) => {
        setOpen(false);
        setConfirmAction(null);
        setLoading(true);
        try {
            const res = await fetch(`/admin/api/users/${userId}/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "Via admin users list" }),
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
                            href={`/admin/users/${userId}`}
                            className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                        </a>

                        {canFreeze && (
                            <>
                                <div className="border-border my-1 border-t" />
                                <button
                                    onClick={() => executeAction("freeze")}
                                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400"
                                >
                                    <Snowflake className="h-3.5 w-3.5" />
                                    Freeze
                                </button>
                            </>
                        )}

                        {canActivate && (
                            <>
                                <div className="border-border my-1 border-t" />
                                <button
                                    onClick={() => executeAction("activate")}
                                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs text-green-600 dark:text-green-400"
                                >
                                    <Play className="h-3.5 w-3.5" />
                                    Activate
                                </button>
                            </>
                        )}

                        {canDelete && (
                            <>
                                <div className="border-border my-1 border-t" />
                                {confirmAction === "delete" ? (
                                    <div className="space-y-1 px-3 py-2">
                                        <p className="text-xs font-medium text-red-600 dark:text-red-400">
                                            Confirm deletion?
                                        </p>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => executeAction("delete")}
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
                                        onClick={() => setConfirmAction("delete")}
                                        className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
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
