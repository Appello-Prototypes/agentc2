"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X, Loader2 } from "lucide-react";

interface FlagData {
    id: string;
    key: string;
    name: string;
    defaultValue: string;
    override: {
        id: string;
        value: string;
        reason: string | null;
    } | null;
}

interface TenantFlagOverrideManagerProps {
    orgId: string;
    flags: FlagData[];
}

export function TenantFlagOverrideManager({ orgId, flags }: TenantFlagOverrideManagerProps) {
    const router = useRouter();
    const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [editReason, setEditReason] = useState("");
    const [addingFlagId, setAddingFlagId] = useState<string | null>(null);
    const [addValue, setAddValue] = useState("");
    const [addReason, setAddReason] = useState("");
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [error, setError] = useState("");

    const startEdit = (flag: FlagData) => {
        if (!flag.override) return;
        setEditingFlagId(flag.id);
        setEditValue(flag.override.value);
        setEditReason(flag.override.reason || "");
        setAddingFlagId(null);
        setError("");
    };

    const startAdd = (flag: FlagData) => {
        setAddingFlagId(flag.id);
        setAddValue(flag.defaultValue);
        setAddReason("");
        setEditingFlagId(null);
        setError("");
    };

    const cancelEdit = () => {
        setEditingFlagId(null);
        setAddingFlagId(null);
        setError("");
    };

    const saveOverride = async (flagId: string, overrideId: string | null) => {
        setError("");
        setLoadingId(flagId);

        try {
            if (overrideId) {
                const res = await fetch(`/admin/api/tenants/${orgId}/flags/${overrideId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        value: editValue,
                        reason: editReason || null
                    }),
                    credentials: "include"
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setError(data.error || "Failed to update override");
                    return;
                }
            } else {
                const res = await fetch(`/admin/api/tenants/${orgId}/flags`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        flagId,
                        value: addValue,
                        reason: addReason || null
                    }),
                    credentials: "include"
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setError(data.error || "Failed to create override");
                    return;
                }
            }

            setEditingFlagId(null);
            setAddingFlagId(null);
            router.refresh();
        } catch {
            setError("Network error");
        } finally {
            setLoadingId(null);
        }
    };

    const removeOverride = async (flag: FlagData) => {
        if (!flag.override) return;
        setError("");
        setLoadingId(flag.id);

        try {
            const res = await fetch(`/admin/api/tenants/${orgId}/flags/${flag.override.id}`, {
                method: "DELETE",
                credentials: "include"
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Failed to remove override");
                return;
            }
            router.refresh();
        } catch {
            setError("Network error");
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Feature Flag Overrides</h2>
                    <p className="text-muted-foreground text-sm">
                        Global flags with tenant-specific overrides for this organization.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-2 text-sm">
                    {error}
                </div>
            )}

            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-2 text-left font-medium">Flag</th>
                            <th className="px-4 py-2 text-left font-medium">Default</th>
                            <th className="px-4 py-2 text-left font-medium">Override</th>
                            <th className="px-4 py-2 text-left font-medium">Reason</th>
                            <th className="w-24 px-4 py-2 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {flags.map((flag) => {
                            const isEditing = editingFlagId === flag.id;
                            const isAdding = addingFlagId === flag.id;
                            const isLoading = loadingId === flag.id;

                            return (
                                <tr key={flag.id} className="border-border border-b last:border-0">
                                    <td className="px-4 py-2">
                                        <div className="font-medium">{flag.name}</div>
                                        <div className="text-muted-foreground font-mono text-xs">
                                            {flag.key}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs">
                                        {flag.defaultValue}
                                    </td>
                                    <td className="px-4 py-2">
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="border-input bg-background focus-visible:ring-ring h-7 w-full rounded border px-2 font-mono text-xs focus-visible:ring-1 focus-visible:outline-none"
                                                autoFocus
                                            />
                                        ) : isAdding ? (
                                            <input
                                                type="text"
                                                value={addValue}
                                                onChange={(e) => setAddValue(e.target.value)}
                                                className="border-input bg-background focus-visible:ring-ring h-7 w-full rounded border px-2 font-mono text-xs focus-visible:ring-1 focus-visible:outline-none"
                                                autoFocus
                                            />
                                        ) : flag.override ? (
                                            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-mono text-xs text-blue-500">
                                                {flag.override.value}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">
                                                (default)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editReason}
                                                onChange={(e) => setEditReason(e.target.value)}
                                                placeholder="Reason..."
                                                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-7 w-full rounded border px-2 text-xs focus-visible:ring-1 focus-visible:outline-none"
                                            />
                                        ) : isAdding ? (
                                            <input
                                                type="text"
                                                value={addReason}
                                                onChange={(e) => setAddReason(e.target.value)}
                                                placeholder="Reason..."
                                                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-7 w-full rounded border px-2 text-xs focus-visible:ring-1 focus-visible:outline-none"
                                            />
                                        ) : (
                                            <span className="text-muted-foreground text-xs">
                                                {flag.override?.reason || "—"}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        {isLoading ? (
                                            <Loader2 className="ml-auto h-4 w-4 animate-spin opacity-50" />
                                        ) : isEditing ? (
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() =>
                                                        saveOverride(flag.id, flag.override!.id)
                                                    }
                                                    className="hover:bg-accent rounded p-1 text-green-600 transition-colors"
                                                    title="Save"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="hover:bg-accent rounded p-1 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ) : isAdding ? (
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => saveOverride(flag.id, null)}
                                                    className="hover:bg-accent rounded p-1 text-green-600 transition-colors"
                                                    title="Save"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="hover:bg-accent rounded p-1 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ) : flag.override ? (
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => startEdit(flag)}
                                                    className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1 transition-colors"
                                                    title="Edit override"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => removeOverride(flag)}
                                                    className="hover:bg-accent rounded p-1 text-red-500 transition-colors hover:text-red-600"
                                                    title="Remove override"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startAdd(flag)}
                                                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1 transition-colors"
                                                title="Add override"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {flags.length === 0 && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    No feature flags defined
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
