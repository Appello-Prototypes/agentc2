"use client";

import { Card, CardContent, Badge } from "@repo/ui";
import { cn } from "@/lib/utils";
import { getHealthStyles, type HealthStatus } from "@repo/ui/lib/health";
import { getSeverity, getSeverityStyles } from "@repo/ui/lib/severity";
import type { SystemHealthData } from "../_hooks/use-system-health";

function HealthDot({ status }: { status: HealthStatus }) {
    const styles = getHealthStyles(status);
    return (
        <span className="relative flex h-3 w-3">
            {status !== "healthy" && (
                <span
                    className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                        styles.dot
                    )}
                />
            )}
            <span className={cn("relative inline-flex h-3 w-3 rounded-full", styles.dot)} />
        </span>
    );
}

function KindRow({
    label,
    total,
    completed,
    failed,
    running,
    successRate
}: {
    label: string;
    total: number;
    completed: number;
    failed: number;
    running: number;
    successRate: number;
}) {
    const health = getHealthStyles(
        successRate >= 95
            ? "healthy"
            : successRate >= 80
              ? "degrading"
              : successRate >= 60
                ? "unstable"
                : "failing"
    );

    return (
        <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-20 text-xs font-medium">{label}</span>
            <div className="flex-1">
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                        className={cn("h-full rounded-full transition-all", health.dot)}
                        style={{ width: `${Math.min(successRate, 100)}%` }}
                    />
                </div>
            </div>
            <span className="w-10 text-right text-xs font-semibold tabular-nums">
                {successRate}%
            </span>
            <div className="text-muted-foreground flex gap-2 text-[10px]">
                <span>{total} total</span>
                {running > 0 && <span className="text-blue-500">{running} running</span>}
                {failed > 0 && <span className="text-red-500">{failed} failed</span>}
            </div>
        </div>
    );
}

export function SystemHealthBar({ data }: { data: SystemHealthData }) {
    if (data.loading) return null;

    const healthStyles = getHealthStyles(data.overallHealth);
    const statusLabel =
        data.overallHealth === "healthy"
            ? "STABLE"
            : data.overallHealth === "degrading"
              ? "DEGRADED"
              : data.overallHealth === "unstable"
                ? "UNSTABLE"
                : "INCIDENT";

    const severityLevel = getSeverity(
        data.overallHealth === "healthy"
            ? "info"
            : data.overallHealth === "degrading"
              ? "medium"
              : data.overallHealth === "unstable"
                ? "high"
                : "critical"
    );
    const severityStyles = getSeverityStyles(severityLevel);

    return (
        <Card className={cn("border", healthStyles.border)}>
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <HealthDot status={data.overallHealth} />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">System Health</span>
                            <Badge
                                variant="outline"
                                className={cn("text-[10px]", severityStyles.badge)}
                            >
                                {statusLabel}
                            </Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                            <KindRow
                                label="Agents"
                                total={data.agents.totalRuns}
                                completed={data.agents.completedRuns}
                                failed={data.agents.failedRuns}
                                running={data.agents.runningRuns}
                                successRate={data.agents.successRate}
                            />
                            <KindRow
                                label="Workflows"
                                total={data.workflows.totalRuns}
                                completed={data.workflows.completedRuns}
                                failed={data.workflows.failedRuns}
                                running={data.workflows.runningRuns}
                                successRate={data.workflows.successRate}
                            />
                            <KindRow
                                label="Networks"
                                total={data.networks.totalRuns}
                                completed={data.networks.completedRuns}
                                failed={data.networks.failedRuns}
                                running={data.networks.runningRuns}
                                successRate={data.networks.successRate}
                            />
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums">
                            {data.grandTotal.allRuns.toLocaleString()}
                        </p>
                        <p className="text-muted-foreground text-[10px]">total runs</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
