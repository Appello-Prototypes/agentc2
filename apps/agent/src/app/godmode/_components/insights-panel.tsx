"use client";

import { Card, CardContent } from "@repo/ui";
import { cn } from "@/lib/utils";
import { getHealthStyles } from "@repo/ui/lib/health";
import type { FeedMetrics } from "../_lib/types";
import type { SystemHealthData, AgentHealth } from "../_hooks/use-system-health";
import { getAgentColor, getAgentInitials, formatCost } from "../_lib/helpers";

function ActiveCampaigns({ metrics }: { metrics: FeedMetrics | null }) {
    if (!metrics) return null;
    const campaignStarted = metrics.byType["CAMPAIGN_STARTED"] || 0;
    const campaignCompleted = metrics.byType["CAMPAIGN_COMPLETED"] || 0;
    const active = Math.max(0, campaignStarted - campaignCompleted);

    return (
        <Card>
            <CardContent className="p-3">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Campaigns
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p className="text-lg font-bold text-orange-500 tabular-nums">{active}</p>
                        <p className="text-muted-foreground text-[10px]">Active</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-emerald-500 tabular-nums">
                            {campaignCompleted}
                        </p>
                        <p className="text-muted-foreground text-[10px]">Done</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold tabular-nums">{campaignStarted}</p>
                        <p className="text-muted-foreground text-[10px]">Total</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ErrorBreakdown({ metrics }: { metrics: FeedMetrics | null }) {
    if (!metrics) return null;

    const errorTypes = Object.entries(metrics.byType)
        .filter(([type]) => type.includes("FAILED"))
        .sort((a, b) => b[1] - a[1]);

    const totalErrors = errorTypes.reduce((sum, [, count]) => sum + count, 0);

    return (
        <Card>
            <CardContent className="p-3">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Errors
                </p>
                {totalErrors === 0 ? (
                    <p className="text-muted-foreground mt-2 text-xs">No errors in window</p>
                ) : (
                    <div className="mt-2 space-y-1.5">
                        {errorTypes.map(([type, count]) => {
                            const label = type
                                .replace("_FAILED", "")
                                .replace(/_/g, " ")
                                .toLowerCase();
                            return (
                                <div key={type} className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                    <span className="text-foreground/70 flex-1 truncate text-xs capitalize">
                                        {label}
                                    </span>
                                    <span className="text-xs font-semibold text-red-500 tabular-nums">
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function CostBreakdown({ data }: { data: SystemHealthData }) {
    const agentCost = data.agents.totalCostUsd;
    const workflowCost = data.workflows.totalCostUsd;
    const networkCost = data.networks.totalCostUsd;
    const total = agentCost + workflowCost + networkCost;

    return (
        <Card>
            <CardContent className="p-3">
                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                        Cost Breakdown
                    </p>
                    <span className="text-sm font-bold tabular-nums">
                        {total > 0 ? formatCost(total) || "$0" : "$0"}
                    </span>
                </div>
                {total > 0 && (
                    <div className="mt-2 space-y-1.5">
                        {agentCost > 0 && (
                            <CostRow
                                label="Agents"
                                value={agentCost}
                                total={total}
                                color="bg-blue-500"
                            />
                        )}
                        {workflowCost > 0 && (
                            <CostRow
                                label="Workflows"
                                value={workflowCost}
                                total={total}
                                color="bg-indigo-500"
                            />
                        )}
                        {networkCost > 0 && (
                            <CostRow
                                label="Networks"
                                value={networkCost}
                                total={total}
                                color="bg-violet-500"
                            />
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function CostRow({
    label,
    value,
    total,
    color
}: {
    label: string;
    value: number;
    total: number;
    color: string;
}) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-16 text-xs">{label}</span>
            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-muted-foreground w-14 text-right text-[10px] tabular-nums">
                {formatCost(value)}
            </span>
        </div>
    );
}

function AgentHealthList({ agents }: { agents: AgentHealth[] }) {
    if (agents.length === 0) return null;

    const sorted = [...agents].sort((a, b) => {
        const order = { failing: 0, unstable: 1, degrading: 2, healthy: 3 } as const;
        return order[a.health] - order[b.health];
    });

    return (
        <Card>
            <CardContent className="p-3">
                <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                    Agent Health
                </p>
                <div className="space-y-1.5">
                    {sorted.slice(0, 8).map((agent) => {
                        const styles = getHealthStyles(agent.health);
                        return (
                            <div key={agent.agentId} className="flex items-center gap-2">
                                <div
                                    className={cn(
                                        "flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br text-[8px] font-bold text-white",
                                        getAgentColor(agent.agentSlug)
                                    )}
                                >
                                    {getAgentInitials(agent.agentName, agent.agentSlug)}
                                </div>
                                <span className={cn("h-2 w-2 rounded-full", styles.dot)} />
                                <span className="flex-1 truncate text-xs">{agent.agentName}</span>
                                <span className="text-muted-foreground text-[10px] tabular-nums">
                                    {agent.successRate}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

export function InsightsPanel({
    metrics,
    systemHealth
}: {
    metrics: FeedMetrics | null;
    systemHealth: SystemHealthData;
}) {
    return (
        <div className="space-y-3">
            <ActiveCampaigns metrics={metrics} />
            <ErrorBreakdown metrics={metrics} />
            <CostBreakdown data={systemHealth} />
            <AgentHealthList agents={systemHealth.agents.perAgent} />
        </div>
    );
}
