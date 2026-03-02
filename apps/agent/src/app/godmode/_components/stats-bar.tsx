"use client";

import { Card, CardContent } from "@repo/ui";
import { cn } from "@/lib/utils";
import type { FeedMetrics } from "../_lib/types";

function StatCard({
    label,
    value,
    accent,
    pulse
}: {
    label: string;
    value: string;
    accent?: string;
    pulse?: boolean;
}) {
    return (
        <Card className="relative overflow-hidden">
            <CardContent className="p-3">
                <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                    {label}
                </p>
                <p className={cn("mt-0.5 text-xl font-bold", accent || "text-foreground")}>
                    {pulse && (
                        <span className="relative mr-1.5">
                            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-blue-500 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                        </span>
                    )}
                    {value}
                </p>
            </CardContent>
        </Card>
    );
}

export function StatsBar({ metrics }: { metrics: FeedMetrics | null }) {
    if (!metrics) return null;

    const runTypes = metrics.byType;
    const started = runTypes["RUN_STARTED"] || 0;
    const completed = runTypes["RUN_COMPLETED"] || 0;
    const failed = runTypes["RUN_FAILED"] || 0;
    const networkRouted = runTypes["NETWORK_ROUTED"] || 0;
    const activeRuns = Math.max(0, started - completed - failed);

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <StatCard label="Total Events" value={metrics.totalEvents.toLocaleString()} />
            <StatCard
                label="Active Runs"
                value={activeRuns.toString()}
                accent="text-blue-600 dark:text-blue-400"
                pulse={activeRuns > 0}
            />
            <StatCard
                label="Completed"
                value={completed.toString()}
                accent="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
                label="Failed"
                value={failed.toString()}
                accent={failed > 0 ? "text-red-600 dark:text-red-400" : undefined}
            />
            <StatCard
                label="Network Routes"
                value={networkRouted.toString()}
                accent="text-violet-600 dark:text-violet-400"
            />
            <StatCard
                label="Total Cost"
                value={
                    metrics.totalCost > 0
                        ? metrics.totalCost < 1
                            ? `$${metrics.totalCost.toFixed(4)}`
                            : `$${metrics.totalCost.toFixed(2)}`
                        : "$0.00"
                }
            />
        </div>
    );
}
