"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    CheckSquare,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Trash2,
    TicketIcon,
    ChevronDown
} from "lucide-react";
import { useTimezone } from "@/lib/timezone-context";

interface TicketRow {
    id: string;
    ticketNumber: number;
    title: string;
    type: string;
    status: string;
    priority: string;
    assignedToId: string | null;
    createdAt: string;
    organization: { name: string; slug: string };
    submittedBy: { name: string; email: string };
    assignedTo: { name: string } | null;
    _count: { comments: number };
}

interface AdminUser {
    id: string;
    name: string;
}

interface BulkResult {
    type: "update" | "delete";
    message: string;
}

interface TicketsTableProps {
    tickets: TicketRow[];
    adminUsers: AdminUser[];
}

const STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"];
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function formatLabel(s: string) {
    return s
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TicketsTable({ tickets, adminUsers }: TicketsTableProps) {
    const router = useRouter();
    const { formatDate } = useTimezone();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [result, setResult] = useState<BulkResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const [showPriorityMenu, setShowPriorityMenu] = useState(false);
    const [showAssignMenu, setShowAssignMenu] = useState(false);

    const selectedCount = selected.size;

    const toggleSelect = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setSelected((prev) => {
            const allSelected = tickets.every((t) => prev.has(t.id));
            if (allSelected) return new Set();
            return new Set(tickets.map((t) => t.id));
        });
    }, [tickets]);

    const closeMenus = () => {
        setShowStatusMenu(false);
        setShowPriorityMenu(false);
        setShowAssignMenu(false);
    };

    async function handleBulkUpdate(updates: Record<string, string | null>) {
        if (selectedCount === 0) return;
        closeMenus();
        setLoading(true);
        setLoadingAction("update");
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/admin/api/tickets/bulk", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [...selected], ...updates })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to update tickets");
                return;
            }

            const field = Object.keys(updates)[0]!;
            const value = Object.values(updates)[0];
            const label =
                field === "assignedToId"
                    ? value
                        ? `Assigned to ${adminUsers.find((a) => a.id === value)?.name || "user"}`
                        : "Unassigned"
                    : `${formatLabel(field)}: ${formatLabel(String(value))}`;

            setResult({
                type: "update",
                message: `Updated ${data.updated} ticket${data.updated !== 1 ? "s" : ""} — ${label}`
            });
            setSelected(new Set());
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    }

    async function handleBulkDelete() {
        if (selectedCount === 0) return;
        if (
            !confirm(
                `Delete ${selectedCount} ticket${selectedCount !== 1 ? "s" : ""}? This cannot be undone.`
            )
        )
            return;

        setLoading(true);
        setLoadingAction("delete");
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/admin/api/tickets/bulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [...selected] })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to delete tickets");
                return;
            }
            setResult({
                type: "delete",
                message: `Deleted ${data.deleted} ticket${data.deleted !== 1 ? "s" : ""}`
            });
            setSelected(new Set());
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    }

    const dismissResult = () => {
        setResult(null);
        setError(null);
    };

    const allSelected = tickets.length > 0 && tickets.every((t) => selected.has(t.id));

    return (
        <div className="space-y-4">
            {/* Bulk action bar */}
            {selectedCount > 0 && (
                <div className="bg-primary/5 border-primary/20 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                    <div className="flex items-center gap-2">
                        <CheckSquare className="text-primary h-4 w-4" />
                        <span className="text-sm font-medium">
                            {selectedCount} ticket{selectedCount !== 1 ? "s" : ""} selected
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Status dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowStatusMenu(!showStatusMenu);
                                    setShowPriorityMenu(false);
                                    setShowAssignMenu(false);
                                }}
                                disabled={loading}
                                className="border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                Set Status
                                <ChevronDown className="h-3 w-3" />
                            </button>
                            {showStatusMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={closeMenus} />
                                    <div className="border-border bg-popover absolute top-full left-0 z-20 mt-1 w-48 rounded-md border py-1 shadow-lg">
                                        {STATUSES.map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => handleBulkUpdate({ status: s })}
                                                className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs"
                                            >
                                                <StatusDot status={s} />
                                                {formatLabel(s)}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Priority dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowPriorityMenu(!showPriorityMenu);
                                    setShowStatusMenu(false);
                                    setShowAssignMenu(false);
                                }}
                                disabled={loading}
                                className="border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                Set Priority
                                <ChevronDown className="h-3 w-3" />
                            </button>
                            {showPriorityMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={closeMenus} />
                                    <div className="border-border bg-popover absolute top-full left-0 z-20 mt-1 w-40 rounded-md border py-1 shadow-lg">
                                        {PRIORITIES.map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => handleBulkUpdate({ priority: p })}
                                                className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs"
                                            >
                                                <PriorityDot priority={p} />
                                                {formatLabel(p)}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Assign dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowAssignMenu(!showAssignMenu);
                                    setShowStatusMenu(false);
                                    setShowPriorityMenu(false);
                                }}
                                disabled={loading}
                                className="border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                Assign To
                                <ChevronDown className="h-3 w-3" />
                            </button>
                            {showAssignMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={closeMenus} />
                                    <div className="border-border bg-popover absolute top-full right-0 z-20 mt-1 w-48 rounded-md border py-1 shadow-lg">
                                        <button
                                            onClick={() => handleBulkUpdate({ assignedToId: null })}
                                            className="hover:bg-accent text-muted-foreground flex w-full items-center px-3 py-2 text-xs italic"
                                        >
                                            Unassigned
                                        </button>
                                        <div className="border-border my-1 border-t" />
                                        {adminUsers.map((a) => (
                                            <button
                                                key={a.id}
                                                onClick={() =>
                                                    handleBulkUpdate({ assignedToId: a.id })
                                                }
                                                className="hover:bg-accent flex w-full items-center px-3 py-2 text-xs"
                                            >
                                                {a.name}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Delete */}
                        <button
                            onClick={handleBulkDelete}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
                        >
                            {loadingAction === "delete" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete ({selectedCount})
                        </button>

                        {loading && loadingAction === "update" && (
                            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        )}
                    </div>
                </div>
            )}

            {/* Result banner */}
            {result && (
                <div
                    className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                        result.type === "delete"
                            ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
                            : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                    }`}
                >
                    <CheckCircle2
                        className={`mt-0.5 h-5 w-5 shrink-0 ${
                            result.type === "delete" ? "text-amber-600" : "text-emerald-600"
                        }`}
                    />
                    <p
                        className={`flex-1 text-sm font-medium ${
                            result.type === "delete"
                                ? "text-amber-800 dark:text-amber-300"
                                : "text-emerald-800 dark:text-emerald-300"
                        }`}
                    >
                        {result.message}
                    </p>
                    <button
                        onClick={dismissResult}
                        className={`text-xs ${
                            result.type === "delete"
                                ? "text-amber-600 hover:text-amber-800"
                                : "text-emerald-600 hover:text-emerald-800"
                        }`}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Error banner */}
            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <p className="flex-1 text-sm font-medium text-red-800 dark:text-red-300">
                        {error}
                    </p>
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
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleSelectAll}
                                    className="accent-primary h-4 w-4 cursor-pointer rounded"
                                    title="Select all"
                                />
                            </th>
                            <th className="px-4 py-3 text-left font-medium">#</th>
                            <th className="px-4 py-3 text-left font-medium">Type</th>
                            <th className="px-4 py-3 text-left font-medium">Title</th>
                            <th className="px-4 py-3 text-left font-medium">Organization</th>
                            <th className="px-4 py-3 text-left font-medium">Submitter</th>
                            <th className="px-4 py-3 text-left font-medium">Priority</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Assigned</th>
                            <th className="px-4 py-3 text-left font-medium">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.map((ticket) => {
                            const isSelected = selected.has(ticket.id);
                            return (
                                <tr
                                    key={ticket.id}
                                    className={`border-border hover:bg-accent/50 border-b transition-colors last:border-0 ${
                                        isSelected ? "bg-primary/5" : ""
                                    }`}
                                >
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelect(ticket.id)}
                                            className="accent-primary h-4 w-4 cursor-pointer rounded"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/tickets/${ticket.id}`}
                                            className="font-mono text-xs font-medium hover:underline"
                                        >
                                            #{ticket.ticketNumber}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3">
                                        <TypeBadge type={ticket.type} />
                                    </td>
                                    <td className="max-w-xs px-4 py-3">
                                        <Link
                                            href={`/tickets/${ticket.id}`}
                                            className="line-clamp-1 font-medium hover:underline"
                                        >
                                            {ticket.title}
                                        </Link>
                                        {ticket._count.comments > 0 && (
                                            <span className="text-muted-foreground ml-2 text-xs">
                                                ({ticket._count.comments} comments)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs">{ticket.organization.name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs">{ticket.submittedBy.name}</span>
                                        <div className="text-muted-foreground text-xs">
                                            {ticket.submittedBy.email}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <PriorityBadge priority={ticket.priority} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={ticket.status} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-muted-foreground text-xs">
                                            {ticket.assignedTo?.name ?? "Unassigned"}
                                        </span>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {formatDate(ticket.createdAt)}
                                    </td>
                                </tr>
                            );
                        })}
                        {tickets.length === 0 && (
                            <tr>
                                <td
                                    colSpan={10}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    <TicketIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                    No tickets found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusDot({ status }: { status: string }) {
    const colors: Record<string, string> = {
        NEW: "bg-blue-500",
        TRIAGED: "bg-indigo-500",
        IN_PROGRESS: "bg-yellow-500",
        WAITING_ON_CUSTOMER: "bg-orange-500",
        RESOLVED: "bg-green-500",
        CLOSED: "bg-gray-500"
    };
    return (
        <span className={`inline-block h-2 w-2 rounded-full ${colors[status] || "bg-gray-500"}`} />
    );
}

function PriorityDot({ priority }: { priority: string }) {
    const colors: Record<string, string> = {
        CRITICAL: "bg-red-500",
        HIGH: "bg-orange-500",
        MEDIUM: "bg-yellow-500",
        LOW: "bg-green-500"
    };
    return (
        <span
            className={`inline-block h-2 w-2 rounded-full ${colors[priority] || "bg-gray-500"}`}
        />
    );
}

function TypeBadge({ type }: { type: string }) {
    const colors: Record<string, string> = {
        BUG: "bg-red-500/10 text-red-500",
        FEATURE_REQUEST: "bg-purple-500/10 text-purple-500",
        IMPROVEMENT: "bg-blue-500/10 text-blue-500",
        QUESTION: "bg-gray-500/10 text-gray-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] || "bg-gray-500/10 text-gray-500"}`}
        >
            {formatLabel(type)}
        </span>
    );
}

function PriorityBadge({ priority }: { priority: string }) {
    const colors: Record<string, string> = {
        CRITICAL: "bg-red-500/10 text-red-500",
        HIGH: "bg-orange-500/10 text-orange-500",
        MEDIUM: "bg-yellow-500/10 text-yellow-500",
        LOW: "bg-green-500/10 text-green-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[priority] || "bg-gray-500/10 text-gray-500"}`}
        >
            {formatLabel(priority)}
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        NEW: "bg-blue-500/10 text-blue-500",
        TRIAGED: "bg-indigo-500/10 text-indigo-500",
        IN_PROGRESS: "bg-yellow-500/10 text-yellow-500",
        WAITING_ON_CUSTOMER: "bg-orange-500/10 text-orange-500",
        RESOLVED: "bg-green-500/10 text-green-500",
        CLOSED: "bg-gray-500/10 text-gray-500"
    };
    return (
        <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-500/10 text-gray-500"}`}
        >
            {formatLabel(status)}
        </span>
    );
}
