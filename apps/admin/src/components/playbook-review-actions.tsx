"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, XIcon, PauseIcon, PlayIcon } from "lucide-react";

interface PlaybookReviewActionsProps {
    playbookId: string;
    currentStatus: string;
}

const TRANSITIONS: Record<string, Array<{ status: string; label: string; variant: string; icon: typeof CheckIcon }>> = {
    PENDING_REVIEW: [
        { status: "PUBLISHED", label: "Approve & Publish", variant: "success", icon: CheckIcon },
        { status: "DRAFT", label: "Reject", variant: "destructive", icon: XIcon }
    ],
    PUBLISHED: [
        { status: "SUSPENDED", label: "Suspend", variant: "destructive", icon: PauseIcon }
    ],
    SUSPENDED: [
        { status: "PUBLISHED", label: "Reinstate", variant: "success", icon: PlayIcon }
    ]
};

export function PlaybookReviewActions({ playbookId, currentStatus }: PlaybookReviewActionsProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [showReason, setShowReason] = useState<string | null>(null);

    const actions = TRANSITIONS[currentStatus];
    if (!actions || actions.length === 0) return null;

    async function handleAction(newStatus: string) {
        if ((newStatus === "DRAFT" || newStatus === "SUSPENDED") && !reason.trim()) {
            setShowReason(newStatus);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/admin/api/playbooks/${playbookId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus, reason: reason.trim() || undefined }),
                credentials: "include"
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Action failed");
            }
            setShowReason(null);
            setReason("");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Action failed");
        } finally {
            setLoading(false);
        }
    }

    const variantStyles: Record<string, string> = {
        success: "bg-green-600 hover:bg-green-700 text-white",
        destructive: "bg-red-600 hover:bg-red-700 text-white"
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                {actions.map((action) => (
                    <button
                        key={action.status}
                        onClick={() => handleAction(action.status)}
                        disabled={loading}
                        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${variantStyles[action.variant] ?? ""}`}
                    >
                        <action.icon className="h-4 w-4" />
                        {loading ? "Processing..." : action.label}
                    </button>
                ))}
            </div>

            {showReason && (
                <div className="space-y-2">
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={
                            showReason === "DRAFT"
                                ? "Reason for rejection (required)..."
                                : "Reason for suspension (required)..."
                        }
                        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleAction(showReason)}
                            disabled={loading || !reason.trim()}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                        >
                            {loading ? "Processing..." : "Confirm"}
                        </button>
                        <button
                            onClick={() => {
                                setShowReason(null);
                                setReason("");
                            }}
                            className="text-muted-foreground rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    {error}
                </div>
            )}
        </div>
    );
}
