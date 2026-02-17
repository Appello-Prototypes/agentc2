"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TriageTicket {
    id: string;
    ticketNumber: number;
    status: string;
    priority: string;
    assignedToId: string | null;
    tags: string[];
    triagedAt: string | null;
    resolvedAt: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface AdminUser {
    id: string;
    name: string;
    email: string;
}

export function TicketTriagePanel({
    ticket,
    adminUsers
}: {
    ticket: TriageTicket;
    adminUsers: AdminUser[];
}) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(ticket.status);
    const [priority, setPriority] = useState(ticket.priority);
    const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? "");

    async function handleUpdate(updates: Record<string, unknown>) {
        setSaving(true);
        try {
            const res = await fetch(`/admin/api/tickets/${ticket.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                router.refresh();
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleStatusChange(newStatus: string) {
        setStatus(newStatus);
        await handleUpdate({ status: newStatus });
    }

    async function handlePriorityChange(newPriority: string) {
        setPriority(newPriority);
        await handleUpdate({ priority: newPriority });
    }

    async function handleAssign(newAssigneeId: string) {
        setAssignedToId(newAssigneeId);
        await handleUpdate({ assignedToId: newAssigneeId || null });
    }

    const statuses = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"];
    const priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

    function formatLabel(s: string) {
        return s
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return (
        <div className="bg-card border-border rounded-lg border">
            <div className="border-border border-b px-4 py-3">
                <h3 className="text-sm font-semibold tracking-wide uppercase">Triage</h3>
            </div>

            <div className="space-y-4 p-4">
                {/* Status */}
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs font-medium">
                        Status
                    </label>
                    <select
                        value={status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={saving}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                        {statuses.map((s) => (
                            <option key={s} value={s}>
                                {formatLabel(s)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Priority */}
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs font-medium">
                        Priority
                    </label>
                    <select
                        value={priority}
                        onChange={(e) => handlePriorityChange(e.target.value)}
                        disabled={saving}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                        {priorities.map((p) => (
                            <option key={p} value={p}>
                                {formatLabel(p)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Assign To */}
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs font-medium">
                        Assigned To
                    </label>
                    <select
                        value={assignedToId}
                        onChange={(e) => handleAssign(e.target.value)}
                        disabled={saving}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                        <option value="">Unassigned</option>
                        {adminUsers.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Quick Actions */}
                <div className="border-border space-y-2 border-t pt-4">
                    <p className="text-muted-foreground text-xs font-medium">Quick Actions</p>
                    {status !== "TRIAGED" &&
                        status !== "IN_PROGRESS" &&
                        status !== "RESOLVED" &&
                        status !== "CLOSED" && (
                            <button
                                onClick={() => handleStatusChange("TRIAGED")}
                                disabled={saving}
                                className="w-full rounded-md bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-500 transition-colors hover:bg-indigo-500/20 disabled:opacity-50"
                            >
                                Mark as Triaged
                            </button>
                        )}
                    {status !== "RESOLVED" && status !== "CLOSED" && (
                        <button
                            onClick={() => handleStatusChange("RESOLVED")}
                            disabled={saving}
                            className="w-full rounded-md bg-green-500/10 px-3 py-2 text-sm font-medium text-green-500 transition-colors hover:bg-green-500/20 disabled:opacity-50"
                        >
                            Resolve
                        </button>
                    )}
                    {status !== "CLOSED" && (
                        <button
                            onClick={() => handleStatusChange("CLOSED")}
                            disabled={saving}
                            className="w-full rounded-md bg-gray-500/10 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-500/20 disabled:opacity-50"
                        >
                            Close
                        </button>
                    )}
                </div>

                {/* Lifecycle Timestamps */}
                <div className="border-border space-y-2 border-t pt-4">
                    <p className="text-muted-foreground text-xs font-medium">Timeline</p>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                        </div>
                        {ticket.triagedAt && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Triaged</span>
                                <span>{new Date(ticket.triagedAt).toLocaleString()}</span>
                            </div>
                        )}
                        {ticket.resolvedAt && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Resolved</span>
                                <span>{new Date(ticket.resolvedAt).toLocaleString()}</span>
                            </div>
                        )}
                        {ticket.closedAt && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Closed</span>
                                <span>{new Date(ticket.closedAt).toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Updated</span>
                            <span>{new Date(ticket.updatedAt).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Tags */}
                {ticket.tags.length > 0 && (
                    <div className="border-border space-y-2 border-t pt-4">
                        <p className="text-muted-foreground text-xs font-medium">Tags</p>
                        <div className="flex flex-wrap gap-1">
                            {ticket.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
