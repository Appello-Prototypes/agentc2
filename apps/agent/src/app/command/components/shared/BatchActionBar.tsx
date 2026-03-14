"use client";

import { Button } from "@repo/ui";

interface BatchActionBarProps {
    selectedCount: number;
    gateItemCount?: number;
    onBatchApprove: () => void;
    onBatchReject?: () => void;
    onClearSelection: () => void;
    loading?: boolean;
}

export function BatchActionBar({
    selectedCount,
    gateItemCount,
    onBatchApprove,
    onBatchReject,
    onClearSelection,
    loading
}: BatchActionBarProps) {
    if (selectedCount === 0 && !gateItemCount) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-6 py-3 shadow-lg backdrop-blur-sm dark:bg-gray-950/95">
            <div className="container mx-auto flex max-w-6xl items-center justify-between">
                <div className="flex items-center gap-3">
                    {gateItemCount != null && gateItemCount > 0 && (
                        <span className="text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-400">
                            {gateItemCount} item{gateItemCount !== 1 ? "s" : ""} at gates
                        </span>
                    )}
                    {gateItemCount != null && gateItemCount > 0 && selectedCount > 0 && (
                        <span className="text-muted-foreground">·</span>
                    )}
                    {selectedCount > 0 && (
                        <>
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
                        </>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        className="bg-green-600 text-white hover:bg-green-700"
                        onClick={onBatchApprove}
                        disabled={loading || selectedCount === 0}
                    >
                        {loading ? (
                            <>
                                <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Approving…
                            </>
                        ) : (
                            <>
                                Approve All ({selectedCount}){" "}
                                <kbd className="ml-1.5 rounded border bg-green-700/30 px-1 font-mono text-[10px]">
                                    Shift+A
                                </kbd>
                            </>
                        )}
                    </Button>
                    {onBatchReject && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                            onClick={onBatchReject}
                            disabled={loading || selectedCount === 0}
                        >
                            Reject All
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
