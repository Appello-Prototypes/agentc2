"use client";

import { Card, CardContent } from "@repo/ui";
import { cn } from "@/lib/utils";
import type { SystemHealthData } from "../_hooks/use-system-health";

function MiniStat({
    label,
    value,
    subValue,
    accent
}: {
    label: string;
    value: string;
    subValue?: string;
    accent?: string;
}) {
    return (
        <div>
            <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                {label}
            </p>
            <p className={cn("text-lg font-bold tabular-nums", accent)}>{value}</p>
            {subValue && <p className="text-muted-foreground text-[10px]">{subValue}</p>}
        </div>
    );
}

function KindBreakdown({
    label,
    total,
    completed,
    failed,
    running,
    successRate,
    cost,
    latency
}: {
    label: string;
    total: number;
    completed: number;
    failed: number;
    running: number;
    successRate: number;
    cost: number;
    latency: number;
}) {
    return (
        <Card>
            <CardContent className="p-3">
                <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                    {label}
                </p>
                <div className="grid grid-cols-3 gap-3">
                    <MiniStat label="Runs" value={total.toLocaleString()} />
                    <MiniStat
                        label="Success"
                        value={`${successRate}%`}
                        accent={
                            successRate >= 95
                                ? "text-emerald-500"
                                : successRate >= 80
                                  ? "text-yellow-500"
                                  : "text-red-500"
                        }
                    />
                    <MiniStat
                        label="Failed"
                        value={failed.toString()}
                        accent={failed > 0 ? "text-red-500" : undefined}
                    />
                    <MiniStat
                        label="Running"
                        value={running.toString()}
                        accent={running > 0 ? "text-blue-500" : undefined}
                    />
                    <MiniStat
                        label="Cost"
                        value={
                            cost > 0
                                ? cost < 1
                                    ? `$${cost.toFixed(4)}`
                                    : `$${cost.toFixed(2)}`
                                : "$0"
                        }
                    />
                    <MiniStat
                        label="Avg Latency"
                        value={
                            latency > 0
                                ? latency < 1000
                                    ? `${latency}ms`
                                    : `${(latency / 1000).toFixed(1)}s`
                                : "-"
                        }
                    />
                </div>
            </CardContent>
        </Card>
    );
}

export function StatsGrid({ data }: { data: SystemHealthData }) {
    if (data.loading) return null;

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KindBreakdown
                label="Agents"
                total={data.agents.totalRuns}
                completed={data.agents.completedRuns}
                failed={data.agents.failedRuns}
                running={data.agents.runningRuns}
                successRate={data.agents.successRate}
                cost={data.agents.totalCostUsd}
                latency={data.agents.avgLatencyMs}
            />
            <KindBreakdown
                label="Workflows"
                total={data.workflows.totalRuns}
                completed={data.workflows.completedRuns}
                failed={data.workflows.failedRuns}
                running={data.workflows.runningRuns}
                successRate={data.workflows.successRate}
                cost={data.workflows.totalCostUsd}
                latency={data.workflows.avgLatencyMs}
            />
            <KindBreakdown
                label="Networks"
                total={data.networks.totalRuns}
                completed={data.networks.completedRuns}
                failed={data.networks.failedRuns}
                running={data.networks.runningRuns}
                successRate={data.networks.successRate}
                cost={data.networks.totalCostUsd}
                latency={data.networks.avgLatencyMs}
            />
        </div>
    );
}
