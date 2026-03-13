"use client";

import { Button } from "@repo/ui";

interface BatchActionBarProps {
    selectedCount: number;
    onBatchApprove: () => void;
    onBatchReject?: () => void;
    onClearSelection: () => void;
    loading?: boolean;
}

export function BatchActionBar({
    selectedCount,
    onBatchApprove,
    onBatchReject,
    onClearSelection,
    loading
}: BatchActionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-6 py-3 shadow-lg backdrop-blur-sm dark:bg-gray-950/95">
            <div className="container mx-auto flex max-w-6xl items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                        {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={onClearSelection}
                    >
                        Clear
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" onClick={onBatchApprove} disabled={loading}>
                        {loading ? (
                            <>
                                <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Approving…
                            </>
                        ) : (
                            <>
                                Approve All ({selectedCount}){" "}
                                <kbd className="ml-1.5 rounded border bg-gray-100 px-1 font-mono text-[10px] dark:bg-gray-800">
                                    Shift+A
                                </kbd>
                            </>
                        )}
                    </Button>
                    {onBatchReject && (
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={onBatchReject}
                            disabled={loading}
                        >
                            Reject All
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
