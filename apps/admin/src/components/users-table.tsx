"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Snowflake, Play, Trash2, Loader2, X } from "lucide-react";
import { UserRowActions } from "./user-row-actions";
import { ImpersonateButton } from "./impersonate-button";

interface UserRow {
    id: string;
    name: string;
    email: string;
    status: string;
    createdAt: string;
    memberships: {
        id: string;
        role: string;
        organization: { name: string; slug: string };
    }[];
}

interface UsersTableProps {
    users: UserRow[];
    tz: string;
    formatDateFn: (date: string) => string;
}

type BulkAction = "freeze" | "activate" | "delete";

export function UsersTable({ users, formatDateFn }: UsersTableProps) {
    const router = useRouter();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [confirmBulkAction, setConfirmBulkAction] = useState<BulkAction | null>(null);

    const allIds = users.map((u) => u.id);
    const allSelected = users.length > 0 && selected.size === users.length;
    const someSelected = selected.size > 0 && !allSelected;

    const toggleAll = useCallback(() => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(allIds));
        }
    }, [allSelected, allIds]);

    const toggleOne = useCallback((id: string) => {
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

    const executeBulkAction = async (action: BulkAction) => {
        setBulkLoading(true);
        setConfirmBulkAction(null);
        try {
            const res = await fetch("/admin/api/users/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userIds: Array.from(selected),
                    action,
                    reason: `Bulk ${action} via admin users list`
                }),
                credentials: "include"
            });
            if (res.ok) {
                setSelected(new Set());
                router.refresh();
            }
        } finally {
            setBulkLoading(false);
        }
    };

    const statusColors: Record<string, string> = {
        active: "bg-green-500/10 text-green-500",
        frozen: "bg-yellow-500/10 text-yellow-500",
        deleted: "bg-red-500/10 text-red-500"
    };

    return (
        <>
            {/* Bulk Action Bar */}
            {selected.size > 0 && (
                <div className="bg-primary/5 border-primary/20 flex items-center justify-between rounded-lg border px-4 py-3">
                    <span className="text-sm font-medium">
                        {selected.size} user{selected.size !== 1 ? "s" : ""} selected
                    </span>
                    <div className="flex items-center gap-2">
                        {bulkLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : confirmBulkAction ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">
                                    Confirm {confirmBulkAction} {selected.size} user
                                    {selected.size !== 1 ? "s" : ""}?
                                </span>
                                <button
                                    onClick={() => executeBulkAction(confirmBulkAction)}
                                    className={`rounded px-3 py-1.5 text-xs font-medium text-white ${
                                        confirmBulkAction === "delete"
                                            ? "bg-red-600 hover:bg-red-700"
                                            : confirmBulkAction === "freeze"
                                              ? "bg-yellow-600 hover:bg-yellow-700"
                                              : "bg-green-600 hover:bg-green-700"
                                    }`}
                                >
                                    Yes, {confirmBulkAction}
                                </button>
                                <button
                                    onClick={() => setConfirmBulkAction(null)}
                                    className="hover:bg-accent rounded px-2 py-1.5 text-xs"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => setConfirmBulkAction("activate")}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 transition-colors hover:bg-green-500/20 dark:text-green-400"
                                >
                                    <Play className="h-3.5 w-3.5" />
                                    Activate
                                </button>
                                <button
                                    onClick={() => setConfirmBulkAction("freeze")}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-600 transition-colors hover:bg-yellow-500/20 dark:text-yellow-400"
                                >
                                    <Snowflake className="h-3.5 w-3.5" />
                                    Freeze
                                </button>
                                <button
                                    onClick={() => setConfirmBulkAction("delete")}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </button>
                                <button
                                    onClick={() => setSelected(new Set())}
                                    className="text-muted-foreground hover:text-foreground ml-2 rounded p-1 transition-colors"
                                    title="Clear selection"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="w-10 px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(el) => {
                                        if (el) el.indeterminate = someSelected;
                                    }}
                                    onChange={toggleAll}
                                    className="accent-primary h-4 w-4 rounded"
                                />
                            </th>
                            <th className="px-4 py-3 text-left font-medium">Name</th>
                            <th className="px-4 py-3 text-left font-medium">Email</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Organizations</th>
                            <th className="px-4 py-3 text-left font-medium">Joined</th>
                            <th className="w-24 px-4 py-3 text-right font-medium" />
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr
                                key={user.id}
                                className={`border-border hover:bg-accent/50 border-b transition-colors last:border-0 ${
                                    selected.has(user.id) ? "bg-primary/5" : ""
                                }`}
                            >
                                <td className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(user.id)}
                                        onChange={() => toggleOne(user.id)}
                                        className="accent-primary h-4 w-4 rounded"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/users/${user.id}`}
                                        className="font-medium hover:underline"
                                    >
                                        {user.name}
                                    </Link>
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {user.email}
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                            statusColors[user.status] ||
                                            "bg-gray-500/10 text-gray-500"
                                        }`}
                                    >
                                        {user.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {user.memberships.map((m) => (
                                            <Link
                                                key={m.id}
                                                href={`/tenants/${m.organization.slug}`}
                                                className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs hover:underline"
                                            >
                                                {m.organization.name} ({m.role})
                                            </Link>
                                        ))}
                                    </div>
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {formatDateFn(user.createdAt)}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <ImpersonateButton
                                            userId={user.id}
                                            userName={user.name || user.email}
                                        />
                                        <UserRowActions userId={user.id} status={user.status} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    No users found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
