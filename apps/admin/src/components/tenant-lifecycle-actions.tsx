"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Power, RotateCcw, Loader2, AlertTriangle, X } from "lucide-react";

interface TenantLifecycleActionsProps {
    orgId: string;
    orgName: string;
    status: string;
    variant?: "full" | "compact";
}

type ActionType = "suspend" | "reactivate" | "deactivate" | "restore";

interface ActionConfig {
    type: ActionType;
    label: string;
    icon: typeof Pause;
    endpoint: string;
    confirmTitle: string;
    confirmMessage: string;
    buttonClass: string;
    requireNameConfirm: boolean;
    reasonRequired: boolean;
}

const ACTION_CONFIGS: Record<ActionType, Omit<ActionConfig, "endpoint">> = {
    suspend: {
        type: "suspend",
        label: "Suspend",
        icon: Pause,
        confirmTitle: "Suspend Tenant",
        confirmMessage:
            "Suspending will immediately block all API access and agent execution for this tenant. Members will see a suspension notice.",
        buttonClass: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 dark:text-yellow-400",
        requireNameConfirm: false,
        reasonRequired: false
    },
    reactivate: {
        type: "reactivate",
        label: "Reactivate",
        icon: Play,
        confirmTitle: "Reactivate Tenant",
        confirmMessage:
            "This will restore full access for all members. The tenant will return to active status.",
        buttonClass: "bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400",
        requireNameConfirm: false,
        reasonRequired: false
    },
    deactivate: {
        type: "deactivate",
        label: "Deactivate",
        icon: Power,
        confirmTitle: "Deactivate Tenant",
        confirmMessage:
            "This will soft-delete the tenant and mark it for permanent data purge after 30 days. All access will be revoked immediately.",
        buttonClass: "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400",
        requireNameConfirm: true,
        reasonRequired: false
    },
    restore: {
        type: "restore",
        label: "Restore",
        icon: RotateCcw,
        confirmTitle: "Restore Tenant",
        confirmMessage:
            "This will restore the tenant to active status, cancel the scheduled data purge, and re-enable all access.",
        buttonClass: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400",
        requireNameConfirm: false,
        reasonRequired: false
    }
};

function getAvailableActions(status: string): ActionType[] {
    switch (status) {
        case "active":
        case "trial":
            return ["suspend", "deactivate"];
        case "suspended":
            return ["reactivate", "deactivate"];
        case "past_due":
            return ["suspend", "deactivate"];
        case "deactivated":
            return ["restore"];
        default:
            return [];
    }
}

export function TenantLifecycleActions({
    orgId,
    orgName,
    status,
    variant = "full"
}: TenantLifecycleActionsProps) {
    const router = useRouter();
    const [activeAction, setActiveAction] = useState<ActionType | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [reason, setReason] = useState("");
    const [confirmText, setConfirmText] = useState("");

    const actions = getAvailableActions(status);

    if (actions.length === 0) return null;

    const handleAction = async (actionType: ActionType) => {
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`/admin/api/tenants/${orgId}/${actionType}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason.trim() || undefined }),
                credentials: "include"
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || `Failed to ${actionType} tenant`);
                return;
            }

            setActiveAction(null);
            setReason("");
            setConfirmText("");
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const closeDialog = () => {
        setActiveAction(null);
        setReason("");
        setConfirmText("");
        setError("");
    };

    const config = activeAction ? ACTION_CONFIGS[activeAction] : null;

    return (
        <>
            <div className={`flex ${variant === "compact" ? "gap-2" : "flex-wrap gap-3"}`}>
                {actions.map((actionType) => {
                    const ac = ACTION_CONFIGS[actionType];
                    const Icon = ac.icon;
                    return (
                        <button
                            key={actionType}
                            onClick={() => setActiveAction(actionType)}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${ac.buttonClass}`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {ac.label}
                        </button>
                    );
                })}
            </div>

            {activeAction && config && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/10 backdrop-blur-xs"
                        onClick={closeDialog}
                    />
                    <div className="relative z-10">
                        <div className="bg-background ring-foreground/10 w-full max-w-md rounded-xl p-5 ring-1">
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle
                                        className={`h-5 w-5 ${
                                            activeAction === "deactivate"
                                                ? "text-red-500"
                                                : activeAction === "suspend"
                                                  ? "text-yellow-500"
                                                  : activeAction === "restore"
                                                    ? "text-blue-500"
                                                    : "text-green-500"
                                        }`}
                                    />
                                    <h2 className="text-base font-semibold">
                                        {config.confirmTitle}
                                    </h2>
                                </div>
                                <button
                                    onClick={closeDialog}
                                    className="hover:bg-accent rounded-md p-1"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <p className="text-muted-foreground mb-4 text-sm">
                                {config.confirmMessage}
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label
                                        htmlFor="action-reason"
                                        className="mb-1 block text-xs font-medium"
                                    >
                                        Reason{" "}
                                        <span className="text-muted-foreground font-normal">
                                            (optional)
                                        </span>
                                    </label>
                                    <input
                                        id="action-reason"
                                        type="text"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder={`Why is this tenant being ${activeAction === "deactivate" ? "deactivated" : activeAction === "restore" ? "restored" : activeAction === "suspend" ? "suspended" : "reactivated"}?`}
                                        className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                                    />
                                </div>

                                {config.requireNameConfirm && (
                                    <div>
                                        <label
                                            htmlFor="action-confirm"
                                            className="mb-1 block text-xs font-medium"
                                        >
                                            Type{" "}
                                            <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                                                {orgName}
                                            </code>{" "}
                                            to confirm
                                        </label>
                                        <input
                                            id="action-confirm"
                                            type="text"
                                            value={confirmText}
                                            onChange={(e) => setConfirmText(e.target.value)}
                                            placeholder={orgName}
                                            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                                        />
                                    </div>
                                )}

                                {error && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {error}
                                    </p>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={closeDialog}
                                        className="border-border hover:bg-accent rounded-md border px-3 py-1.5 text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleAction(activeAction)}
                                        disabled={
                                            loading ||
                                            (config.requireNameConfirm && confirmText !== orgName)
                                        }
                                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                                            activeAction === "deactivate"
                                                ? "bg-red-600 text-white hover:bg-red-700"
                                                : activeAction === "suspend"
                                                  ? "bg-yellow-600 text-white hover:bg-yellow-700"
                                                  : activeAction === "restore"
                                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                                    : "bg-green-600 text-white hover:bg-green-700"
                                        }`}
                                    >
                                        {loading && (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        )}
                                        {loading ? "Processing..." : config.label}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
