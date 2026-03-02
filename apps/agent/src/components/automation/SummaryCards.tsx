"use client";

import { Card, CardDescription, CardHeader, CardTitle, Skeleton } from "@repo/ui";
import { getSuccessRateColor } from "./helpers";
import { getAutomationHealth } from "./health";
import type { AutomationSummary } from "./types";

interface SummaryCardsProps {
    summary: AutomationSummary | null;
    loading?: boolean;
}

export function SummaryCards({ summary, loading }: SummaryCardsProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                ))}
            </div>
        );
    }

    const needsAttention = summary?.needsAttention ?? 0;
    const healthStatus = getAutomationHealth(summary?.overallSuccessRate ?? 100);

    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Total</CardDescription>
                    <CardTitle className="text-2xl">{summary?.total ?? 0}</CardTitle>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Active</CardDescription>
                    <CardTitle className="text-2xl text-green-600">
                        {summary?.active ?? 0}
                    </CardTitle>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Needs Attention</CardDescription>
                    <CardTitle
                        className={`text-2xl ${needsAttention > 0 ? "text-orange-500" : "text-muted-foreground"}`}
                    >
                        {needsAttention}
                    </CardTitle>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Est. Cost/mo</CardDescription>
                    <CardTitle className="text-2xl">
                        {summary?.estimatedMonthlyCost != null
                            ? `$${summary.estimatedMonthlyCost.toFixed(2)}`
                            : "—"}
                    </CardTitle>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Success Rate</CardDescription>
                    <CardTitle
                        className={`text-2xl ${getSuccessRateColor(summary?.overallSuccessRate ?? 100)}`}
                    >
                        {summary?.overallSuccessRate != null
                            ? `${summary.overallSuccessRate.toFixed(0)}%`
                            : "—"}
                    </CardTitle>
                </CardHeader>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardDescription>Health</CardDescription>
                    <CardTitle
                        className={`text-2xl capitalize ${
                            healthStatus === "healthy"
                                ? "text-emerald-500"
                                : healthStatus === "degrading"
                                  ? "text-yellow-500"
                                  : healthStatus === "unstable"
                                    ? "text-orange-500"
                                    : "text-red-500"
                        }`}
                    >
                        {healthStatus}
                    </CardTitle>
                </CardHeader>
            </Card>
        </div>
    );
}
