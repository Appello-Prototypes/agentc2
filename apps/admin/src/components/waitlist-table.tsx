"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    ClipboardList,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Mail,
    CheckSquare,
    Copy,
    Check,
    Link as LinkIcon,
    Trash2,
    RotateCcw,
    MoreHorizontal,
    UserCheck
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface WaitlistEntry {
    id: string;
    email: string;
    name: string | null;
    source: string | null;
    status: string;
    inviteId: string | null;
    inviteCode: string | null;
    registeredAt: string | null;
    createdAt: string;
}

interface ActionResult {
    type: "approve" | "resend" | "delete";
    message: string;
    detail?: string;
}

interface WaitlistTableProps {
    entries: WaitlistEntry[];
    statusStyles: Record<string, string>;
    signupBaseUrl: string;
}

// ── Component ────────────────────────────────────────────────────────────

export function WaitlistTable({ entries, statusStyles, signupBaseUrl }: WaitlistTableProps) {
    const router = useRouter();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [result, setResult] = useState<ActionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const pendingEntries = entries.filter((e) => e.status === "pending");
    const invitedEntries = entries.filter((e) => e.status === "invited");

    const selectedCount = selected.size;
    const selectedPendingIds = [...selected].filter((id) =>
        pendingEntries.some((e) => e.id === id)
    );
    const selectedInvitedIds = [...selected].filter((id) =>
        invitedEntries.some((e) => e.id === id)
    );

    // ── Selection ────────────────────────────────────────────────────

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
            const allSelected = entries.every((e) => prev.has(e.id));
            if (allSelected) return new Set();
            return new Set(entries.map((e) => e.id));
        });
    }, [entries]);

    // ── Clipboard ────────────────────────────────────────────────────

    const copyToClipboard = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // ── API calls ────────────────────────────────────────────────────

    const handleBulkApprove = async () => {
        if (selectedPendingIds.length === 0) return;
        setLoading(true);
        setLoadingAction("approve");
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/admin/api/waitlist/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedPendingIds })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to approve entries");
                return;
            }
            setResult({
                type: "approve",
                message: `Approved ${data.approved} ${data.approved === 1 ? "entry" : "entries"}`,
                detail: `${data.emailsSent} email${data.emailsSent !== 1 ? "s" : ""} sent${data.emailsFailed > 0 ? `, ${data.emailsFailed} failed` : ""} · Invite: ${data.inviteCode} · Link: ${data.signupUrl}`
            });
            setSelected(new Set());
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    };

    const handleBulkResend = async () => {
        if (selectedInvitedIds.length === 0) return;
        setLoading(true);
        setLoadingAction("resend");
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/admin/api/waitlist/resend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedInvitedIds })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to resend invites");
                return;
            }
            setResult({
                type: "resend",
                message: `Resent invites to ${data.resent} ${data.resent === 1 ? "entry" : "entries"}`,
                detail: `${data.emailsSent} email${data.emailsSent !== 1 ? "s" : ""} sent${data.emailsFailed > 0 ? `, ${data.emailsFailed} failed` : ""}`
            });
            setSelected(new Set());
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    };

    const handleResendSingle = async (id: string) => {
        setOpenMenu(null);
        setLoading(true);
        setLoadingAction(`resend-${id}`);
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/admin/api/waitlist/resend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id] })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to resend invite");
                return;
            }
            const entry = entries.find((e) => e.id === id);
            setResult({
                type: "resend",
                message: `Invite resent to ${entry?.email || "user"}`,
                detail:
                    data.emailsSent > 0
                        ? "Email sent successfully"
                        : `Failed: ${data.results?.[0]?.error || "Unknown error"}`
            });
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedCount === 0) return;
        if (
            !confirm(
                `Delete ${selectedCount} waitlist ${selectedCount === 1 ? "entry" : "entries"}? This cannot be undone.`
            )
        )
            return;

        setLoading(true);
        setLoadingAction("delete");
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/admin/api/waitlist", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [...selected] })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to delete entries");
                return;
            }
            setResult({
                type: "delete",
                message: `Deleted ${data.deleted} ${data.deleted === 1 ? "entry" : "entries"}`
            });
            setSelected(new Set());
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    };

    const handleDeleteSingle = async (id: string) => {
        setOpenMenu(null);
        setConfirmDelete(null);
        setLoading(true);
        setLoadingAction(`delete-${id}`);
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/admin/api/waitlist", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [id] })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to delete entry");
                return;
            }
            const entry = entries.find((e) => e.id === id);
            setResult({
                type: "delete",
                message: `Deleted ${entry?.email || "entry"}`
            });
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    };

    const dismissResult = () => {
        setResult(null);
        setError(null);
    };

    const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.id));

    return (
        <div className="space-y-4">
            {/* ── Bulk action bar ─────────────────────────────────── */}
            {selectedCount > 0 && (
                <div className="bg-primary/5 border-primary/20 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                    <div className="flex items-center gap-2">
                        <CheckSquare className="text-primary h-4 w-4" />
                        <span className="text-sm font-medium">
                            {selectedCount} {selectedCount === 1 ? "entry" : "entries"} selected
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedPendingIds.length > 0 && (
                            <button
                                onClick={handleBulkApprove}
                                disabled={loading}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                {loadingAction === "approve" ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Mail className="h-3.5 w-3.5" />
                                )}
                                Approve & Invite ({selectedPendingIds.length})
                            </button>
                        )}
                        {selectedInvitedIds.length > 0 && (
                            <button
                                onClick={handleBulkResend}
                                disabled={loading}
                                className="border-border hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                {loadingAction === "resend" ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Resend Invite ({selectedInvitedIds.length})
                            </button>
                        )}
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
                    </div>
                </div>
            )}

            {/* ── Result / error banners ──────────────────────────── */}
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
                    <div className="flex-1 space-y-1">
                        <p
                            className={`text-sm font-medium ${
                                result.type === "delete"
                                    ? "text-amber-800 dark:text-amber-300"
                                    : "text-emerald-800 dark:text-emerald-300"
                            }`}
                        >
                            {result.message}
                        </p>
                        {result.detail && (
                            <p
                                className={`text-xs ${
                                    result.type === "delete"
                                        ? "text-amber-700 dark:text-amber-400"
                                        : "text-emerald-700 dark:text-emerald-400"
                                }`}
                            >
                                {result.detail}
                            </p>
                        )}
                    </div>
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

            {/* ── Table ──────────────────────────────────────────── */}
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
                            <th className="px-4 py-3 text-left font-medium">Email</th>
                            <th className="px-4 py-3 text-left font-medium">Name</th>
                            <th className="px-4 py-3 text-left font-medium">Source</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Signed up</th>
                            <th className="w-24 px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry) => {
                            const isInvited = entry.status === "invited";
                            const isSelected = selected.has(entry.id);
                            const inviteUrl = entry.inviteCode
                                ? `${signupBaseUrl}/signup?invite=${entry.inviteCode}`
                                : null;
                            const hasRegistered = !!entry.registeredAt;
                            const isMenuOpen = openMenu === entry.id;
                            const isDeleting = confirmDelete === entry.id;
                            const isRowLoading =
                                loadingAction === `delete-${entry.id}` ||
                                loadingAction === `resend-${entry.id}`;

                            return (
                                <tr
                                    key={entry.id}
                                    className={`border-border hover:bg-accent/50 border-b transition-colors last:border-0 ${
                                        isSelected ? "bg-primary/5" : ""
                                    }`}
                                >
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelect(entry.id)}
                                            className="accent-primary h-4 w-4 cursor-pointer rounded"
                                        />
                                    </td>
                                    <td className="px-4 py-3 font-medium">{entry.email}</td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {entry.name || "—"}
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {entry.source || "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    statusStyles[entry.status] ||
                                                    "bg-secondary text-secondary-foreground"
                                                }`}
                                            >
                                                {entry.status}
                                            </span>
                                            {hasRegistered && (
                                                <span
                                                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                    title={`Signed up on ${new Date(entry.registeredAt!).toLocaleDateString()}`}
                                                >
                                                    <UserCheck className="h-3 w-3" />
                                                    signed up
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-muted-foreground px-4 py-3 text-xs">
                                        {new Date(entry.createdAt).toLocaleDateString()}{" "}
                                        {new Date(entry.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {isRowLoading ? (
                                            <Loader2 className="ml-auto h-4 w-4 animate-spin opacity-50" />
                                        ) : (
                                            <div className="relative inline-block">
                                                <button
                                                    onClick={() =>
                                                        setOpenMenu(isMenuOpen ? null : entry.id)
                                                    }
                                                    className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1 transition-colors"
                                                    title="Actions"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>

                                                {isMenuOpen && (
                                                    <>
                                                        {/* Backdrop to close menu */}
                                                        <div
                                                            className="fixed inset-0 z-10"
                                                            onClick={() => {
                                                                setOpenMenu(null);
                                                                setConfirmDelete(null);
                                                            }}
                                                        />
                                                        <div className="border-border bg-popover absolute top-full right-0 z-20 mt-1 w-48 rounded-md border py-1 shadow-lg">
                                                            {isInvited && inviteUrl && (
                                                                <button
                                                                    onClick={() =>
                                                                        copyToClipboard(
                                                                            inviteUrl,
                                                                            `link-${entry.id}`
                                                                        )
                                                                    }
                                                                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs"
                                                                >
                                                                    {copiedId ===
                                                                    `link-${entry.id}` ? (
                                                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                                    ) : (
                                                                        <LinkIcon className="h-3.5 w-3.5" />
                                                                    )}
                                                                    {copiedId === `link-${entry.id}`
                                                                        ? "Copied!"
                                                                        : "Copy invite link"}
                                                                </button>
                                                            )}
                                                            {isInvited && inviteUrl && (
                                                                <button
                                                                    onClick={() =>
                                                                        copyToClipboard(
                                                                            entry.inviteCode!,
                                                                            `code-${entry.id}`
                                                                        )
                                                                    }
                                                                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs"
                                                                >
                                                                    {copiedId ===
                                                                    `code-${entry.id}` ? (
                                                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                                    ) : (
                                                                        <Copy className="h-3.5 w-3.5" />
                                                                    )}
                                                                    {copiedId === `code-${entry.id}`
                                                                        ? "Copied!"
                                                                        : "Copy invite code"}
                                                                </button>
                                                            )}
                                                            {isInvited && (
                                                                <button
                                                                    onClick={() =>
                                                                        handleResendSingle(entry.id)
                                                                    }
                                                                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs"
                                                                >
                                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                                    Resend invite email
                                                                </button>
                                                            )}
                                                            <div className="border-border my-1 border-t" />
                                                            {isDeleting ? (
                                                                <div className="px-3 py-2">
                                                                    <p className="mb-2 text-xs text-red-600">
                                                                        Are you sure?
                                                                    </p>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() =>
                                                                                handleDeleteSingle(
                                                                                    entry.id
                                                                                )
                                                                            }
                                                                            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                        <button
                                                                            onClick={() =>
                                                                                setConfirmDelete(
                                                                                    null
                                                                                )
                                                                            }
                                                                            className="hover:bg-accent rounded border px-2 py-1 text-xs"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() =>
                                                                        setConfirmDelete(entry.id)
                                                                    }
                                                                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    Delete entry
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {entries.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
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
