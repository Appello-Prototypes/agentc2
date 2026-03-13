"use client";

import {
    Button,
    Badge,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem
} from "@repo/ui";
import type { ViewMode, MetricsData } from "../types";
import { VIEW_MODE_LABELS } from "../types";
import { MetricsSummaryBar } from "./MetricsSummaryBar";

const VIEW_ICONS: Record<ViewMode, string> = {
    pipeline: "⫼",
    grid: "▦",
    timeline: "▬",
    inbox: "☰",
    topology: "◈",
    legacy: "◻"
};

const ACTIVE_VIEWS: ViewMode[] = ["pipeline", "grid", "timeline", "inbox", "topology"];

interface CommandCenterHeaderProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    metrics: MetricsData | null;
    onShowShortcuts: () => void;
    connectionError?: boolean;
    newReviewCount?: number;
    onDismissNewReviews?: () => void;
}

export function CommandCenterHeader({
    viewMode,
    onViewModeChange,
    metrics,
    onShowShortcuts,
    connectionError,
    newReviewCount,
    onDismissNewReviews
}: CommandCenterHeaderProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Command Center</h1>
                    <p className="text-muted-foreground">
                        Unified workflow monitoring & decision hub
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View switcher */}
                    <div className="flex items-center rounded-lg border bg-gray-50/50 p-0.5 dark:bg-gray-900/50">
                        {ACTIVE_VIEWS.map((mode) => (
                            <Button
                                key={mode}
                                variant={viewMode === mode ? "default" : "ghost"}
                                size="sm"
                                className="h-7 gap-1 px-2.5 text-xs"
                                onClick={() => onViewModeChange(mode)}
                            >
                                <span className="text-sm">{VIEW_ICONS[mode]}</span>
                                <span className="hidden sm:inline">{VIEW_MODE_LABELS[mode]}</span>
                            </Button>
                        ))}
                    </div>

                    {/* Archive dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                                    <span>Archive</span>
                                    <span className="text-[10px]">▾</span>
                                </Button>
                            }
                        />
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => onViewModeChange("legacy")}>
                                <span className="mr-2">{VIEW_ICONS.legacy}</span>
                                Legacy View
                                {viewMode === "legacy" && (
                                    <Badge variant="secondary" className="ml-auto text-[10px]">
                                        active
                                    </Badge>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onShowShortcuts}>
                                <span className="mr-2">⌨</span>
                                Keyboard Shortcuts
                                <kbd className="text-muted-foreground ml-auto font-mono text-[10px]">
                                    ?
                                </kbd>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <MetricsSummaryBar metrics={metrics} />

            {connectionError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    Connection lost — retrying automatically
                </div>
            )}

            {newReviewCount != null && newReviewCount > 0 && onDismissNewReviews && (
                <button
                    onClick={onDismissNewReviews}
                    className="w-full rounded-lg bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                >
                    {newReviewCount} new decision{newReviewCount > 1 ? "s" : ""} awaiting your
                    authority
                </button>
            )}
        </div>
    );
}
