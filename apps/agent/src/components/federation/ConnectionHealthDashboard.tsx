"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Metrics {
    messageCount: { sent: number; received: number };
    avgLatencyMs: number;
    errorRate: number;
    totalCostUsd: number;
    rateLimitUtilization: { hourly: number; daily: number };
    dailyVolume: { date: string; count: number }[];
}

interface ConnectionHealthDashboardProps {
    connectionId: string;
}

export function ConnectionHealthDashboard({ connectionId }: ConnectionHealthDashboardProps) {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${getApiBase()}/api/federation/metrics?connectionId=${connectionId}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    setMetrics({
                        messageCount: data.messageCount,
                        avgLatencyMs: data.avgLatencyMs,
                        errorRate: data.errorRate,
                        totalCostUsd: data.totalCostUsd,
                        rateLimitUtilization: data.rateLimitUtilization,
                        dailyVolume: data.dailyVolume
                    });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [connectionId]);

    if (loading) {
        return (
            <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
        );
    }

    if (!metrics) {
        return <p className="text-muted-foreground text-sm">Unable to load health metrics.</p>;
    }

    const errorPct = (metrics.errorRate * 100).toFixed(1);
    const errorColor =
        metrics.errorRate >= 0.1
            ? "text-red-600"
            : metrics.errorRate >= 0.05
              ? "text-yellow-600"
              : "text-green-600";

    const maxVolume = Math.max(...metrics.dailyVolume.map((d) => d.count), 1);

    return (
        <div className="space-y-4">
            {/* Key Metrics Row */}
            <div className="grid gap-3 md:grid-cols-5">
                <MetricCard
                    label="Sent"
                    value={String(metrics.messageCount.sent)}
                    sub="Last 30 days"
                />
                <MetricCard
                    label="Received"
                    value={String(metrics.messageCount.received)}
                    sub="Last 30 days"
                />
                <MetricCard
                    label="Avg Latency"
                    value={`${metrics.avgLatencyMs}ms`}
                    sub="All messages"
                />
                <MetricCard
                    label="Error Rate"
                    value={`${errorPct}%`}
                    sub="Last 30 days"
                    valueClassName={errorColor}
                />
                <MetricCard
                    label="Cost"
                    value={`$${metrics.totalCostUsd.toFixed(2)}`}
                    sub="Last 30 days"
                />
            </div>

            {/* Rate Limit Utilization */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Rate Limit Utilization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs">Hourly</span>
                            <span className="text-muted-foreground text-xs">
                                {(metrics.rateLimitUtilization.hourly * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="bg-muted h-2 overflow-hidden rounded-full">
                            <div
                                className="bg-primary h-full rounded-full transition-all"
                                style={{
                                    width: `${Math.min(metrics.rateLimitUtilization.hourly * 100, 100)}%`
                                }}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs">Daily</span>
                            <span className="text-muted-foreground text-xs">
                                {(metrics.rateLimitUtilization.daily * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="bg-muted h-2 overflow-hidden rounded-full">
                            <div
                                className="bg-primary h-full rounded-full transition-all"
                                style={{
                                    width: `${Math.min(metrics.rateLimitUtilization.daily * 100, 100)}%`
                                }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sparkline-style Volume Chart */}
            {metrics.dailyVolume.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Daily Volume (Last 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-1" style={{ height: 60 }}>
                            {metrics.dailyVolume.map((d) => {
                                const pct = (d.count / maxVolume) * 100;
                                return (
                                    <div
                                        key={d.date}
                                        className="group relative flex-1"
                                        style={{ height: "100%" }}
                                    >
                                        <div
                                            className="bg-primary/70 hover:bg-primary absolute bottom-0 w-full rounded-t transition-colors"
                                            style={{
                                                height: `${Math.max(pct, 4)}%`
                                            }}
                                        />
                                        <div className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 rounded bg-black px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white group-hover:block">
                                            {d.date.slice(5)}: {d.count}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                            <span>{metrics.dailyVolume[0]?.date.slice(5)}</span>
                            <span>
                                {metrics.dailyVolume[metrics.dailyVolume.length - 1]?.date.slice(5)}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function MetricCard({
    label,
    value,
    sub,
    valueClassName = ""
}: {
    label: string;
    value: string;
    sub: string;
    valueClassName?: string;
}) {
    return (
        <Card>
            <CardContent className="py-3">
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className={`text-xl font-semibold ${valueClassName}`}>{value}</p>
                <p className="text-muted-foreground text-[10px]">{sub}</p>
            </CardContent>
        </Card>
    );
}
