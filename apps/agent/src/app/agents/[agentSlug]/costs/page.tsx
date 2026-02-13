"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Input,
    Label,
    Skeleton,
    Switch,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

// Date range presets
type DateRangePreset =
    | "all-time"
    | "today"
    | "last-7-days"
    | "last-30-days"
    | "last-90-days"
    | "this-month"
    | "last-month"
    | "this-year"
    | "custom";

interface DateRange {
    from: Date | null;
    to: Date | null;
    label: string;
}

function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
        case "all-time":
            return { from: null, to: null, label: "All Time" };
        case "today":
            return { from: today, to: now, label: "Today" };
        case "last-7-days":
            return {
                from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
                to: now,
                label: "Last 7 Days"
            };
        case "last-30-days":
            return {
                from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
                to: now,
                label: "Last 30 Days"
            };
        case "last-90-days":
            return {
                from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
                to: now,
                label: "Last 90 Days"
            };
        case "this-month":
            return {
                from: new Date(now.getFullYear(), now.getMonth(), 1),
                to: now,
                label: "This Month"
            };
        case "last-month": {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            return { from: lastMonth, to: lastMonthEnd, label: "Last Month" };
        }
        case "this-year":
            return {
                from: new Date(now.getFullYear(), 0, 1),
                to: now,
                label: "This Year"
            };
        case "custom":
            return { from: null, to: null, label: "Custom Range" };
        default:
            return {
                from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
                to: now,
                label: "Last 30 Days"
            };
    }
}

interface CostData {
    totalCost: number;
    monthlyBudget: number;
    dailyAverage: number;
    projectedMonthly: number;
    costPerRun: number;
    runCount: number;
    tokenBreakdown: {
        prompt: { tokens: number; cost: number };
        completion: { tokens: number; cost: number };
    };
    byModel: Array<{
        model: string;
        runs: number;
        tokens: number;
        cost: number;
    }>;
    byDay: Array<{ date: string; cost: number }>;
    byRun: Array<{ id: string; costUsd: number; createdAt: string }>;
    dateRange: { from: string; to: string };
}

function CostPerRunChart({
    runs,
    averageCost
}: {
    runs: Array<{ id: string; costUsd: number; createdAt: string }>;
    averageCost: number;
}) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    if (runs.length === 0) return null;

    const chartHeight = 250;
    const chartWidth = 800;
    const padding = { top: 20, right: 60, bottom: 40, left: 60 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const maxCost = Math.max(...runs.map((r) => r.costUsd), averageCost * 1.2, 0.001);
    const minCost = 0;

    const xScale = (index: number) =>
        padding.left +
        (runs.length > 1 ? (index / (runs.length - 1)) * innerWidth : innerWidth / 2);
    const yScale = (cost: number) =>
        padding.top + innerHeight - ((cost - minCost) / (maxCost - minCost)) * innerHeight;

    // Build polyline points
    const linePoints = runs.map((r, i) => `${xScale(i)},${yScale(r.costUsd)}`).join(" ");

    // Average line Y position
    const avgY = yScale(averageCost);

    // Y-axis ticks (5 ticks)
    const yTicks = Array.from({ length: 5 }, (_, i) => {
        const value = minCost + ((maxCost - minCost) * i) / 4;
        return { value, y: yScale(value) };
    });

    // X-axis labels (show a few timestamps)
    const xLabelCount = Math.min(runs.length, 6);
    const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
        const idx = runs.length <= 1 ? 0 : Math.round((i / (xLabelCount - 1)) * (runs.length - 1));
        return {
            x: xScale(idx),
            label: new Date(runs[idx].createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            })
        };
    });

    return (
        <div className="relative">
            <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="h-[250px] w-full"
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Y-axis grid lines and labels */}
                {yTicks.map((tick, i) => (
                    <g key={i}>
                        <line
                            x1={padding.left}
                            y1={tick.y}
                            x2={chartWidth - padding.right}
                            y2={tick.y}
                            stroke="currentColor"
                            strokeOpacity={0.1}
                            strokeDasharray="4 4"
                        />
                        <text
                            x={padding.left - 8}
                            y={tick.y + 4}
                            textAnchor="end"
                            className="fill-muted-foreground"
                            fontSize={10}
                        >
                            ${tick.value.toFixed(4)}
                        </text>
                    </g>
                ))}

                {/* X-axis labels */}
                {xLabels.map((label, i) => (
                    <text
                        key={i}
                        x={label.x}
                        y={chartHeight - 5}
                        textAnchor="middle"
                        className="fill-muted-foreground"
                        fontSize={9}
                    >
                        {label.label}
                    </text>
                ))}

                {/* Average cost dashed line */}
                <line
                    x1={padding.left}
                    y1={avgY}
                    x2={chartWidth - padding.right}
                    y2={avgY}
                    stroke="hsl(var(--destructive))"
                    strokeWidth={1.5}
                    strokeDasharray="8 4"
                    strokeOpacity={0.7}
                />
                <text
                    x={chartWidth - padding.right + 4}
                    y={avgY + 4}
                    className="fill-destructive"
                    fontSize={10}
                    fontWeight={600}
                >
                    avg ${averageCost.toFixed(4)}
                </text>

                {/* Cost line */}
                {runs.length > 1 && (
                    <polyline
                        points={linePoints}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                )}

                {/* Data points */}
                {runs.map((run, i) => (
                    <g key={run.id}>
                        {/* Invisible larger hit area */}
                        <circle
                            cx={xScale(i)}
                            cy={yScale(run.costUsd)}
                            r={12}
                            fill="transparent"
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        />
                        {/* Visible dot */}
                        <circle
                            cx={xScale(i)}
                            cy={yScale(run.costUsd)}
                            r={hoveredIndex === i ? 5 : 3}
                            fill={run.costUsd > averageCost ? "#ef4444" : "#3b82f6"}
                            stroke="none"
                            className="transition-all duration-150"
                        />
                    </g>
                ))}
            </svg>

            {/* Tooltip */}
            {hoveredIndex !== null && runs[hoveredIndex] && (
                <div
                    className="bg-popover text-popover-foreground pointer-events-none absolute z-10 rounded-lg border px-3 py-2 shadow-lg"
                    style={{
                        left: `${(xScale(hoveredIndex) / chartWidth) * 100}%`,
                        top: `${(yScale(runs[hoveredIndex].costUsd) / chartHeight) * 100 - 15}%`,
                        transform: "translate(-50%, -100%)"
                    }}
                >
                    <p className="font-mono text-sm font-semibold">
                        ${runs[hoveredIndex].costUsd.toFixed(6)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                        {new Date(runs[hoveredIndex].createdAt).toLocaleString()}
                    </p>
                    <p className="text-muted-foreground font-mono text-[10px]">
                        Run: {runs[hoveredIndex].id.slice(0, 12)}...
                    </p>
                    {runs[hoveredIndex].costUsd > averageCost ? (
                        <p className="text-destructive text-xs">Above average</p>
                    ) : (
                        <p className="text-xs text-green-600">Below average</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function CostsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [costData, setCostData] = useState<CostData | null>(null);
    const [budgetSettings, setBudgetSettings] = useState({
        enabled: false,
        monthlyLimit: 100,
        alertAt: 80,
        hardLimit: false
    });

    // Date range state
    const [datePreset, setDatePreset] = useState<DateRangePreset>("last-30-days");
    const [customFromDate, setCustomFromDate] = useState<string>("");
    const [customToDate, setCustomToDate] = useState<string>("");
    const [sourceFilter, setSourceFilter] = useState<"all" | "production" | "simulation">("all");

    // Compute effective date range
    const effectiveDateRange = useMemo(() => {
        if (datePreset === "custom" && customFromDate && customToDate) {
            return {
                from: new Date(customFromDate),
                to: new Date(customToDate + "T23:59:59"),
                label: `${customFromDate} to ${customToDate}`
            };
        }
        return getDateRangeFromPreset(datePreset);
    }, [datePreset, customFromDate, customToDate]);

    const fetchCostsAndBudget = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Build query params for date range and source
            const params = new URLSearchParams();
            if (effectiveDateRange.from) {
                params.set("from", effectiveDateRange.from.toISOString());
            }
            if (effectiveDateRange.to) {
                params.set("to", effectiveDateRange.to.toISOString());
            }
            params.set("source", sourceFilter);

            const queryString = params.toString();
            const costsUrl = `${getApiBase()}/api/agents/${agentSlug}/costs${queryString ? `?${queryString}` : ""}`;

            // Fetch costs and budget in parallel
            const [costsRes, budgetRes] = await Promise.all([
                fetch(costsUrl),
                fetch(`${getApiBase()}/api/agents/${agentSlug}/budget`)
            ]);

            const [costsResult, budgetResult] = await Promise.all([
                costsRes.json(),
                budgetRes.json()
            ]);

            if (costsResult.success) {
                // Calculate derived values
                const totalCost = costsResult.summary?.totalCostUsd || 0;
                const runCount = costsResult.summary?.runCount || 0;
                const byDayData = costsResult.byDay || [];
                const dailyCosts = byDayData.map((d: { costUsd: number }) => d.costUsd);
                const dailyAverage =
                    dailyCosts.length > 0
                        ? dailyCosts.reduce((a: number, b: number) => a + b, 0) / dailyCosts.length
                        : 0;

                // Get days remaining in month (for projected monthly)
                const now = new Date();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const dayOfMonth = now.getDate();

                // Only show projected if we're looking at current month data
                const isCurrentMonth =
                    datePreset === "this-month" ||
                    (effectiveDateRange.from &&
                        effectiveDateRange.from.getMonth() === now.getMonth() &&
                        effectiveDateRange.from.getFullYear() === now.getFullYear());
                const projectedMonthly = isCurrentMonth
                    ? dayOfMonth > 0
                        ? (totalCost / dayOfMonth) * daysInMonth
                        : 0
                    : totalCost;

                const transformedCostData: CostData = {
                    totalCost,
                    monthlyBudget: budgetResult.budgetPolicy?.monthlyLimitUsd || 100,
                    dailyAverage,
                    projectedMonthly,
                    costPerRun: runCount > 0 ? totalCost / runCount : 0,
                    runCount,
                    tokenBreakdown: {
                        prompt: {
                            tokens: costsResult.tokenBreakdown?.prompt || 0,
                            cost: costsResult.tokenBreakdown?.promptCostUsd || 0
                        },
                        completion: {
                            tokens: costsResult.tokenBreakdown?.completion || 0,
                            cost: costsResult.tokenBreakdown?.completionCostUsd || 0
                        }
                    },
                    byModel: (costsResult.byModel || []).map(
                        (m: { model: string; runs: number; tokens: number; costUsd: number }) => ({
                            model: m.model,
                            runs: m.runs,
                            tokens: m.tokens,
                            cost: m.costUsd
                        })
                    ),
                    byDay: byDayData.map((d: { date: string; costUsd: number }) => ({
                        date: d.date,
                        cost: d.costUsd
                    })),
                    byRun: costsResult.byRun || [],
                    dateRange: costsResult.dateRange || { from: "", to: "" }
                };

                setCostData(transformedCostData);
            }

            if (budgetResult.success && budgetResult.budgetPolicy) {
                setBudgetSettings({
                    enabled: budgetResult.budgetPolicy.enabled,
                    monthlyLimit: budgetResult.budgetPolicy.monthlyLimitUsd || 100,
                    alertAt: budgetResult.budgetPolicy.alertAtPct || 80,
                    hardLimit: budgetResult.budgetPolicy.hardLimit || false
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load costs");
        } finally {
            setLoading(false);
        }
    }, [agentSlug, effectiveDateRange, sourceFilter, datePreset]);

    const saveBudgetSettings = async () => {
        try {
            setSaving(true);
            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/budget`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enabled: budgetSettings.enabled,
                    monthlyLimitUsd: budgetSettings.monthlyLimit,
                    alertAtPct: budgetSettings.alertAt,
                    hardLimit: budgetSettings.hardLimit
                })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || "Failed to save budget");
            }

            // Update cost data with new budget
            if (costData) {
                setCostData({
                    ...costData,
                    monthlyBudget: budgetSettings.monthlyLimit
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save budget");
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchCostsAndBudget();
    }, [fetchCostsAndBudget]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error && !costData) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Cost Management</h1>
                    <p className="text-muted-foreground">
                        Track spending, set budgets, and optimize costs
                    </p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={fetchCostsAndBudget}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Use defaults if no cost data
    const displayCostData = costData || {
        totalCost: 0,
        monthlyBudget: budgetSettings.monthlyLimit,
        dailyAverage: 0,
        projectedMonthly: 0,
        costPerRun: 0,
        runCount: 0,
        tokenBreakdown: {
            prompt: { tokens: 0, cost: 0 },
            completion: { tokens: 0, cost: 0 }
        },
        byModel: [],
        byDay: [] as Array<{ date: string; cost: number }>,
        byRun: [] as Array<{ id: string; costUsd: number; createdAt: string }>,
        dateRange: { from: "", to: "" }
    };

    const budgetUsage =
        displayCostData.monthlyBudget > 0
            ? (displayCostData.totalCost / displayCostData.monthlyBudget) * 100
            : 0;

    // Format date for display
    const formatDateRange = () => {
        if (datePreset === "all-time") return "All Time";
        if (costData?.dateRange) {
            const from = new Date(costData.dateRange.from).toLocaleDateString();
            const to = new Date(costData.dateRange.to).toLocaleDateString();
            return `${from} - ${to}`;
        }
        return effectiveDateRange.label;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Cost Management</h1>
                    <p className="text-muted-foreground">
                        Track spending, set budgets, and optimize costs
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={sourceFilter}
                        onValueChange={(value) =>
                            setSourceFilter(value as "all" | "production" | "simulation")
                        }
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sources</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="simulation">Simulation</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={datePreset}
                        onValueChange={(value) => setDatePreset(value as DateRangePreset)}
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all-time">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                            <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                            <SelectItem value="last-90-days">Last 90 Days</SelectItem>
                            <SelectItem value="this-month">This Month</SelectItem>
                            <SelectItem value="last-month">Last Month</SelectItem>
                            <SelectItem value="this-year">This Year</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                    </Select>

                    {datePreset === "custom" && (
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={customFromDate}
                                onChange={(e) => setCustomFromDate(e.target.value)}
                                className="w-[140px]"
                            />
                            <span className="text-muted-foreground">to</span>
                            <Input
                                type="date"
                                value={customToDate}
                                onChange={(e) => setCustomToDate(e.target.value)}
                                className="w-[140px]"
                            />
                        </div>
                    )}

                    <Button variant="outline" size="sm">
                        Export
                    </Button>
                </div>
            </div>

            {/* Date Range Display */}
            {costData && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <span>Showing data for:</span>
                    <span className="text-foreground font-medium">{formatDateRange()}</span>
                    <span>•</span>
                    <span>{costData.runCount} runs</span>
                </div>
            )}

            {/* Budget Alert */}
            {budgetUsage >= budgetSettings.alertAt && (
                <div className="flex items-center justify-between rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                    <div className="flex items-center gap-3">
                        <span className="text-xl text-yellow-600">⚠️</span>
                        <div>
                            <p className="font-medium text-yellow-600">Budget Alert</p>
                            <p className="text-muted-foreground text-sm">
                                You&apos;ve used {budgetUsage.toFixed(0)}% of your monthly budget
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm">
                        Adjust Budget
                    </Button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>
                            {datePreset === "all-time"
                                ? "Total Cost"
                                : datePreset === "this-month"
                                  ? "This Month"
                                  : datePreset === "last-month"
                                    ? "Last Month"
                                    : "Period Total"}
                        </CardDescription>
                        <CardTitle className="text-2xl">
                            ${displayCostData.totalCost.toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {budgetSettings.enabled && datePreset === "this-month" ? (
                            <div className="flex items-center gap-2">
                                <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                                    <div
                                        className={`h-full ${budgetUsage >= 80 ? "bg-yellow-500" : "bg-primary"}`}
                                        style={{ width: `${Math.min(budgetUsage, 100)}%` }}
                                    />
                                </div>
                                <span className="text-muted-foreground text-xs">
                                    {budgetUsage.toFixed(0)}%
                                </span>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-xs">
                                {displayCostData.runCount || 0} runs
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Daily Average</CardDescription>
                        <CardTitle className="text-2xl">
                            ${displayCostData.dailyAverage.toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">
                            {displayCostData.byDay?.length || 0} days with activity
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>
                            {datePreset === "this-month" ? "Projected Monthly" : "Total Tokens"}
                        </CardDescription>
                        <CardTitle
                            className={`text-2xl ${datePreset === "this-month" && displayCostData.projectedMonthly > displayCostData.monthlyBudget ? "text-red-600" : ""}`}
                        >
                            {datePreset === "this-month" ? (
                                `$${displayCostData.projectedMonthly.toFixed(2)}`
                            ) : (
                                <>
                                    {(
                                        (displayCostData.tokenBreakdown?.prompt?.tokens || 0) +
                                        (displayCostData.tokenBreakdown?.completion?.tokens || 0)
                                    ).toLocaleString()}
                                </>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">
                            {datePreset === "this-month"
                                ? "Based on current usage"
                                : "Input + Output tokens"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Cost per Run</CardDescription>
                        <CardTitle className="text-2xl">
                            ${displayCostData.costPerRun.toFixed(4)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Average for selected period</p>
                    </CardContent>
                </Card>
            </div>

            {/* Cost Per Run Line Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Cost Per Run</CardTitle>
                    <CardDescription>
                        Individual run costs over time with average baseline
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {displayCostData.byRun.length > 0 ? (
                        <CostPerRunChart
                            runs={displayCostData.byRun}
                            averageCost={displayCostData.costPerRun}
                        />
                    ) : (
                        <div className="text-muted-foreground flex h-[250px] items-center justify-center">
                            No per-run cost data available for this period
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Cost Over Time */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Daily Costs</CardTitle>
                        <CardDescription>{effectiveDateRange.label}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {displayCostData.byDay && displayCostData.byDay.length > 0 ? (
                            <>
                                <div className="flex h-[200px] items-end gap-1">
                                    {displayCostData.byDay.map((day, i) => {
                                        const cost = typeof day === "object" ? day.cost : day;
                                        const date =
                                            typeof day === "object" ? day.date : `Day ${i + 1}`;
                                        const maxCost = Math.max(
                                            ...displayCostData.byDay.map((d) =>
                                                typeof d === "object" ? d.cost : d
                                            ),
                                            0.01
                                        );
                                        return (
                                            <div
                                                key={i}
                                                className="bg-primary group relative flex-1 rounded-t opacity-80 transition-opacity hover:opacity-100"
                                                style={{
                                                    height: `${Math.max((cost / maxCost) * 100, 2)}%`,
                                                    minHeight: cost > 0 ? "4px" : "0"
                                                }}
                                            >
                                                <div className="bg-foreground text-background absolute -top-10 left-1/2 z-10 -translate-x-1/2 rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                                                    <div className="font-medium">
                                                        ${cost.toFixed(4)}
                                                    </div>
                                                    <div className="text-muted-foreground text-[10px]">
                                                        {date}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="text-muted-foreground mt-2 flex justify-between text-xs">
                                    <span>
                                        {displayCostData.byDay[0] &&
                                        typeof displayCostData.byDay[0] === "object"
                                            ? new Date(
                                                  displayCostData.byDay[0].date
                                              ).toLocaleDateString()
                                            : "Start"}
                                    </span>
                                    <span>
                                        {displayCostData.byDay.length > 0 &&
                                        typeof displayCostData.byDay[
                                            displayCostData.byDay.length - 1
                                        ] === "object"
                                            ? new Date(
                                                  (
                                                      displayCostData.byDay[
                                                          displayCostData.byDay.length - 1
                                                      ] as { date: string }
                                                  ).date
                                              ).toLocaleDateString()
                                            : "End"}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="text-muted-foreground flex h-[200px] items-center justify-center">
                                No cost data available for this period
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Token Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle>Token Breakdown</CardTitle>
                        <CardDescription>Cost by token type</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Prompt Tokens</span>
                                <span className="font-mono">
                                    ${displayCostData.tokenBreakdown.prompt.cost.toFixed(2)}
                                </span>
                            </div>
                            <div className="bg-muted h-3 overflow-hidden rounded-full">
                                <div
                                    className="h-full bg-blue-500"
                                    style={{
                                        width: `${displayCostData.totalCost > 0 ? (displayCostData.tokenBreakdown.prompt.cost / displayCostData.totalCost) * 100 : 0}%`
                                    }}
                                />
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {displayCostData.tokenBreakdown.prompt.tokens.toLocaleString()}{" "}
                                tokens
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Completion Tokens</span>
                                <span className="font-mono">
                                    ${displayCostData.tokenBreakdown.completion.cost.toFixed(2)}
                                </span>
                            </div>
                            <div className="bg-muted h-3 overflow-hidden rounded-full">
                                <div
                                    className="h-full bg-green-500"
                                    style={{
                                        width: `${displayCostData.totalCost > 0 ? (displayCostData.tokenBreakdown.completion.cost / displayCostData.totalCost) * 100 : 0}%`
                                    }}
                                />
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {displayCostData.tokenBreakdown.completion.tokens.toLocaleString()}{" "}
                                tokens
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Cost by Model */}
                <Card>
                    <CardHeader>
                        <CardTitle>Cost by Model</CardTitle>
                        <CardDescription>Breakdown by LLM</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {displayCostData.byModel.length > 0 ? (
                            <div className="space-y-4">
                                {displayCostData.byModel.map((model) => (
                                    <div key={model.model} className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="font-mono text-sm">
                                                    {model.model}
                                                </span>
                                                <span className="font-mono">
                                                    ${model.cost.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="bg-muted h-2 overflow-hidden rounded-full">
                                                <div
                                                    className="bg-primary h-full"
                                                    style={{
                                                        width: `${displayCostData.totalCost > 0 ? (model.cost / displayCostData.totalCost) * 100 : 0}%`
                                                    }}
                                                />
                                            </div>
                                            <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                                                <span>{model.runs} runs</span>
                                                <span>
                                                    {(model.tokens / 1000).toFixed(0)}K tokens
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground py-4 text-center text-sm">
                                No model usage data available
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Budget Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Budget Settings</CardTitle>
                        <CardDescription>Configure spending limits</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Enable Budget Limits</Label>
                                <p className="text-muted-foreground text-xs">
                                    Get alerts when approaching limits
                                </p>
                            </div>
                            <Switch
                                checked={budgetSettings.enabled}
                                onCheckedChange={(checked) =>
                                    setBudgetSettings((p) => ({ ...p, enabled: checked }))
                                }
                            />
                        </div>

                        {budgetSettings.enabled && (
                            <>
                                <div className="space-y-2">
                                    <Label>Monthly Budget ($)</Label>
                                    <Input
                                        type="number"
                                        value={budgetSettings.monthlyLimit}
                                        onChange={(e) =>
                                            setBudgetSettings((p) => ({
                                                ...p,
                                                monthlyLimit: parseInt(e.target.value) || 0
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Alert at (%)</Label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min="50"
                                            max="100"
                                            value={budgetSettings.alertAt}
                                            onChange={(e) =>
                                                setBudgetSettings((p) => ({
                                                    ...p,
                                                    alertAt: parseInt(e.target.value)
                                                }))
                                            }
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-right">
                                            {budgetSettings.alertAt}%
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-muted flex items-center justify-between rounded-lg p-4">
                                    <div>
                                        <Label>Hard Limit</Label>
                                        <p className="text-muted-foreground text-xs">
                                            Stop agent when budget exceeded
                                        </p>
                                    </div>
                                    <Switch
                                        checked={budgetSettings.hardLimit}
                                        onCheckedChange={(checked) =>
                                            setBudgetSettings((p) => ({ ...p, hardLimit: checked }))
                                        }
                                    />
                                </div>

                                <Button
                                    className="w-full"
                                    onClick={saveBudgetSettings}
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "Save Budget Settings"}
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
