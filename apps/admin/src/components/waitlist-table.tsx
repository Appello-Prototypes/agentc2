"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, CheckCircle2, AlertCircle, Mail, CheckSquare } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface WaitlistEntry {
    id: string;
    email: string;
    name: string | null;
    source: string | null;
    status: string;
    inviteId: string | null;
    createdAt: string;
}

interface ApproveResult {
    success: boolean;
    approved: number;
    emailsSent: number;
    emailsFailed: number;
    inviteCode: string;
    signupUrl: string;
    results: { email: string; sent: boolean; error?: string }[];
}

interface WaitlistTableProps {
    entries: WaitlistEntry[];
    statusStyles: Record<string, string>;
}

// ── Component ────────────────────────────────────────────────────────────

export function WaitlistTable({ entries, statusStyles }: WaitlistTableProps) {
    const router = useRouter();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [approving, setApproving] = useState(false);
    const [result, setResult] = useState<ApproveResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const pendingEntries = entries.filter((e) => e.status === "pending");
    const pendingIds = new Set(pendingEntries.map((e) => e.id));
    const selectedPendingCount = [...selected].filter((id) => pendingIds.has(id)).length;

    const toggleSelect = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setSelected((prev) => {
            if (pendingEntries.every((e) => prev.has(e.id))) {
                // Deselect all pending on this page
                const next = new Set(prev);
                for (const e of pendingEntries) next.delete(e.id);
                return next;
            }
            // Select all pending on this page
            const next = new Set(prev);
            for (const e of pendingEntries) next.add(e.id);
            return next;
        });
    }, [pendingEntries]);

    const handleBulkApprove = async () => {
        const ids = [...selected].filter((id) => pendingIds.has(id));
        if (ids.length === 0) return;

        setApproving(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/admin/api/waitlist/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to approve entries");
                return;
            }

            setResult(data);
            setSelected(new Set());
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setApproving(false);
        }
    };

    const dismissResult = () => {
        setResult(null);
        setError(null);
    };

    const allPendingSelected =
        pendingEntries.length > 0 && pendingEntries.every((e) => selected.has(e.id));

    return (
        <div className="space-y-4">
            {/* Bulk action bar */}
            {selectedPendingCount > 0 && (
                <div className="bg-primary/5 border-primary/20 flex items-center justify-between rounded-lg border px-4 py-3">
                    <div className="flex items-center gap-2">
                        <CheckSquare className="text-primary h-4 w-4" />
                        <span className="text-sm font-medium">
                            {selectedPendingCount} pending{" "}
                            {selectedPendingCount === 1 ? "entry" : "entries"} selected
                        </span>
                    </div>
                    <button
                        onClick={handleBulkApprove}
                        disabled={approving}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {approving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Mail className="h-4 w-4" />
                        )}
                        {approving
                            ? "Approving & sending..."
                            : `Approve & Send Invite (${selectedPendingCount})`}
                    </button>
                </div>
            )}

            {/* Success / error banners */}
            {result && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                            Approved {result.approved} {result.approved === 1 ? "entry" : "entries"}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                            {result.emailsSent} email{result.emailsSent !== 1 ? "s" : ""} sent
                            {result.emailsFailed > 0 && (
                                <span className="text-amber-600">
                                    {" "}
                                    &middot; {result.emailsFailed} failed
                                </span>
                            )}{" "}
                            &middot; Invite code:{" "}
                            <code className="rounded bg-emerald-100 px-1 py-0.5 font-mono text-xs dark:bg-emerald-900/50">
                                {result.inviteCode}
                            </code>
                        </p>
                    </div>
                    <button
                        onClick={dismissResult}
                        className="text-xs text-emerald-600 hover:text-emerald-800"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">
                            {error}
                        </p>
                    </div>
                    <button
                        onClick={dismissResult}
                        className="text-xs text-red-600 hover:text-red-800"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="w-10 px-4 py-3 text-left">
                                {pendingEntries.length > 0 && (
                                    <input
                                        type="checkbox"
                                        checked={allPendingSelected}
                                        onChange={toggleSelectAll}
                                        className="accent-primary h-4 w-4 cursor-pointer rounded"
                                        title="Select all pending"
                                    />
                                )}
                            </th>
                            <th className="px-4 py-3 text-left font-medium">Email</th>
                            <th className="px-4 py-3 text-left font-medium">Name</th>
                            <th className="px-4 py-3 text-left font-medium">Source</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Signed up</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry) => {
                            const isPending = entry.status === "pending";
                            const isSelected = selected.has(entry.id);

                            return (
                                <tr
                                    key={entry.id}
                                    className={`border-border hover:bg-accent/50 border-b transition-colors last:border-0 ${
                                        isSelected ? "bg-primary/5" : ""
                                    }`}
                                >
                                    <td className="px-4 py-3">
                                        {isPending && (
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(entry.id)}
                                                className="accent-primary h-4 w-4 cursor-pointer rounded"
                                            />
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-medium">{entry.email}</td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {entry.name || "—"}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {entry.source || "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                statusStyles[entry.status] ||
                                                "bg-secondary text-secondary-foreground"
                                            }`}
                                        >
                                            {entry.status}
                                        </span>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {new Date(entry.createdAt).toLocaleDateString()}{" "}
                                        {new Date(entry.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })}
                                    </td>
                                </tr>
                            );
                        })}
                        {entries.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                    No waitlist entries found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
