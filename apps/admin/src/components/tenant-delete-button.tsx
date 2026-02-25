"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

interface TenantDeleteButtonProps {
    orgId: string;
    orgName: string;
    status: string;
}

export function TenantDeleteButton({ orgId, orgName, status }: TenantDeleteButtonProps) {
    const router = useRouter();
    const [showConfirm, setShowConfirm] = useState(false);
    const [reason, setReason] = useState("");
    const [confirmText, setConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");

    if (status === "deactivated") return null;

    const handleDelete = async () => {
        setError("");
        setDeleting(true);

        try {
            const res = await fetch(`/admin/api/tenants/${orgId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason.trim() || "Deleted by admin" })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to delete tenant");
                return;
            }

            setShowConfirm(false);
            router.push("/tenants");
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setDeleting(false);
        }
    };

    if (!showConfirm) {
        return (
            <button
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20"
            >
                <Trash2 className="h-3 w-3" />
                Delete Tenant
            </button>
        );
    }

    return (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-red-500">Confirm Tenant Deletion</h3>
            </div>
            <p className="text-muted-foreground mb-3 text-sm">
                This will deactivate <strong>{orgName}</strong> and mark it for deletion. The tenant
                data will be retained for 30 days before permanent purge.
            </p>
            <div className="space-y-3">
                <div>
                    <label htmlFor="delete-reason" className="mb-1 block text-xs font-medium">
                        Reason <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <input
                        id="delete-reason"
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why is this tenant being deleted?"
                        className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    />
                </div>
                <div>
                    <label htmlFor="delete-confirm" className="mb-1 block text-xs font-medium">
                        Type{" "}
                        <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                            {orgName}
                        </code>{" "}
                        to confirm
                    </label>
                    <input
                        id="delete-confirm"
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder={orgName}
                        className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    />
                </div>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setShowConfirm(false);
                            setConfirmText("");
                            setReason("");
                            setError("");
                        }}
                        className="border-border hover:bg-accent rounded-md border px-3 py-1.5 text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting || confirmText !== orgName}
                        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                        {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {deleting ? "Deleting..." : "Delete Tenant"}
                    </button>
                </div>
            </div>
        </div>
    );
}
