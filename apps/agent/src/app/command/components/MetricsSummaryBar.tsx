"use client";

import { Card, CardContent, Skeleton } from "@repo/ui";
import { type MetricsData, formatDuration } from "../types";

export function MetricsSummaryBar({ metrics }: { metrics: MetricsData | null }) {
    if (!metrics) {
        return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-[84px] rounded-xl" />
                ))}
            </div>
        );
    }

    const trendIcon = metrics.queueTrend > 0 ? "↑" : metrics.queueTrend < 0 ? "↓" : "→";
    const trendClass =
        metrics.queueTrend > 0
            ? "text-red-500"
            : metrics.queueTrend < 0
              ? "text-green-500"
              : "text-muted-foreground";

    const stats = [
        {
            label: "Pending",
            value: String(metrics.pendingCount),
            detail: (
                <span className={trendClass}>
                    {trendIcon} {Math.abs(metrics.queueTrend)} vs resolved/24h
                </span>
            )
        },
        {
            label: "Avg Wait",
            value: formatDuration(metrics.avgWaitMinutes),
            detail: <span className="text-muted-foreground">current pending</span>
        },
        {
            label: "Approval Rate",
            value: `${metrics.approvalRate7d}%`,
            detail: <span className="text-muted-foreground">last 7 days</span>
        },
        {
            label: "Decided Today",
            value: String(metrics.decisionsToday),
            detail: <span className="text-muted-foreground">decisions resolved</span>
        },
        {
            label: "Avg Decision Time",
            value: formatDuration(metrics.avgDecisionMinutes),
            detail: <span className="text-muted-foreground">last 7 days</span>
        }
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((stat) => (
                <Card key={stat.label}>
                    <CardContent className="p-4">
                        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            {stat.label}
                        </div>
                        <div className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</div>
                        <div className="mt-0.5 text-xs">{stat.detail}</div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
