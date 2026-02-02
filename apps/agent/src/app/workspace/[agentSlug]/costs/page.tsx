"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
    Switch
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface CostData {
    totalCost: number;
    monthlyBudget: number;
    dailyAverage: number;
    projectedMonthly: number;
    costPerRun: number;
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
    byDay: number[];
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

    const fetchCostsAndBudget = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch costs and budget in parallel
            const [costsRes, budgetRes] = await Promise.all([
                fetch(`${getApiBase()}/api/agents/${agentSlug}/costs`),
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

                // Get days remaining in month
                const now = new Date();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const dayOfMonth = now.getDate();
                const projectedMonthly = (totalCost / dayOfMonth) * daysInMonth;

                const transformedCostData: CostData = {
                    totalCost,
                    monthlyBudget: budgetResult.budgetPolicy?.monthlyLimitUsd || 100,
                    dailyAverage,
                    projectedMonthly,
                    costPerRun: runCount > 0 ? totalCost / runCount : 0,
                    tokenBreakdown: {
                        prompt: {
                            tokens: costsResult.tokenBreakdown?.prompt || 0,
                            cost:
                                totalCost *
                                ((costsResult.tokenBreakdown?.promptPercentage || 40) / 100)
                        },
                        completion: {
                            tokens: costsResult.tokenBreakdown?.completion || 0,
                            cost:
                                totalCost *
                                (1 - (costsResult.tokenBreakdown?.promptPercentage || 40) / 100)
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
                    byDay: dailyCosts
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
    }, [agentSlug]);

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
                <div className="grid grid-cols-4 gap-4">
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
        tokenBreakdown: {
            prompt: { tokens: 0, cost: 0 },
            completion: { tokens: 0, cost: 0 }
        },
        byModel: [],
        byDay: []
    };

    const budgetUsage =
        displayCostData.monthlyBudget > 0
            ? (displayCostData.totalCost / displayCostData.monthlyBudget) * 100
            : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Cost Management</h1>
                    <p className="text-muted-foreground">
                        Track spending, set budgets, and optimize costs
                    </p>
                </div>
                <Button variant="outline">Export Report</Button>
            </div>

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
                        <CardDescription>This Month</CardDescription>
                        <CardTitle className="text-2xl">
                            ${displayCostData.totalCost.toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
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
                        <p className="text-muted-foreground text-xs">Last 14 days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Projected Monthly</CardDescription>
                        <CardTitle
                            className={`text-2xl ${displayCostData.projectedMonthly > displayCostData.monthlyBudget ? "text-red-600" : ""}`}
                        >
                            ${displayCostData.projectedMonthly.toFixed(2)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-xs">Based on current usage</p>
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
                        <p className="text-muted-foreground text-xs">Average across all runs</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Cost Over Time */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Daily Costs</CardTitle>
                        <CardDescription>Last 14 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {displayCostData.byDay.length > 0 ? (
                            <>
                                <div className="flex h-[200px] items-end gap-1">
                                    {displayCostData.byDay.map((cost, i) => (
                                        <div
                                            key={i}
                                            className="bg-primary group relative flex-1 rounded-t opacity-80 transition-opacity hover:opacity-100"
                                            style={{
                                                height: `${(cost / Math.max(...displayCostData.byDay, 1)) * 100}%`
                                            }}
                                        >
                                            <div className="bg-foreground text-background absolute -top-8 left-1/2 -translate-x-1/2 rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                                                ${cost.toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-muted-foreground mt-2 flex justify-between text-xs">
                                    <span>14 days ago</span>
                                    <span>Today</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-muted-foreground flex h-[200px] items-center justify-center">
                                No cost data available
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
