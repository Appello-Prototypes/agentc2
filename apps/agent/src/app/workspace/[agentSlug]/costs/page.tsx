"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
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

const mockCostData: CostData = {
    totalCost: 45.67,
    monthlyBudget: 100,
    dailyAverage: 3.26,
    projectedMonthly: 97.8,
    costPerRun: 0.037,
    tokenBreakdown: {
        prompt: { tokens: 892340, cost: 17.85 },
        completion: { tokens: 1243210, cost: 27.82 }
    },
    byModel: [
        { model: "claude-sonnet-4", runs: 847, tokens: 1856230, cost: 38.45 },
        { model: "gpt-4o", runs: 312, tokens: 245890, cost: 6.12 },
        { model: "claude-haiku", runs: 88, tokens: 33430, cost: 1.1 }
    ],
    byDay: [2.8, 3.2, 2.9, 3.5, 4.1, 3.2, 2.8, 3.6, 4.2, 3.8, 3.1, 2.9, 3.4, 3.7]
};

export default function CostsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [costData, setCostData] = useState<CostData | null>(null);
    const [budgetSettings, setBudgetSettings] = useState({
        enabled: true,
        monthlyLimit: 100,
        alertAt: 80,
        hardLimit: false
    });

    useEffect(() => {
        setTimeout(() => {
            setCostData(mockCostData);
            setLoading(false);
        }, 500);
    }, [agentSlug]);

    if (loading || !costData) {
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

    const budgetUsage = (costData.totalCost / costData.monthlyBudget) * 100;

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
                        <CardTitle className="text-2xl">${costData.totalCost.toFixed(2)}</CardTitle>
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
                            ${costData.dailyAverage.toFixed(2)}
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
                            className={`text-2xl ${costData.projectedMonthly > costData.monthlyBudget ? "text-red-600" : ""}`}
                        >
                            ${costData.projectedMonthly.toFixed(2)}
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
                            ${costData.costPerRun.toFixed(4)}
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
                        <div className="flex h-[200px] items-end gap-1">
                            {costData.byDay.map((cost, i) => (
                                <div
                                    key={i}
                                    className="bg-primary group relative flex-1 rounded-t opacity-80 transition-opacity hover:opacity-100"
                                    style={{
                                        height: `${(cost / Math.max(...costData.byDay)) * 100}%`
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
                                    ${costData.tokenBreakdown.prompt.cost.toFixed(2)}
                                </span>
                            </div>
                            <div className="bg-muted h-3 overflow-hidden rounded-full">
                                <div
                                    className="h-full bg-blue-500"
                                    style={{
                                        width: `${(costData.tokenBreakdown.prompt.cost / costData.totalCost) * 100}%`
                                    }}
                                />
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {costData.tokenBreakdown.prompt.tokens.toLocaleString()} tokens
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Completion Tokens</span>
                                <span className="font-mono">
                                    ${costData.tokenBreakdown.completion.cost.toFixed(2)}
                                </span>
                            </div>
                            <div className="bg-muted h-3 overflow-hidden rounded-full">
                                <div
                                    className="h-full bg-green-500"
                                    style={{
                                        width: `${(costData.tokenBreakdown.completion.cost / costData.totalCost) * 100}%`
                                    }}
                                />
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {costData.tokenBreakdown.completion.tokens.toLocaleString()} tokens
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
                        <div className="space-y-4">
                            {costData.byModel.map((model) => (
                                <div key={model.model} className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="font-mono text-sm">{model.model}</span>
                                            <span className="font-mono">
                                                ${model.cost.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="bg-muted h-2 overflow-hidden rounded-full">
                                            <div
                                                className="bg-primary h-full"
                                                style={{
                                                    width: `${(model.cost / costData.totalCost) * 100}%`
                                                }}
                                            />
                                        </div>
                                        <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                                            <span>{model.runs} runs</span>
                                            <span>{(model.tokens / 1000).toFixed(0)}K tokens</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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

                                <Button className="w-full">Save Budget Settings</Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Optimization Tips */}
            <Card>
                <CardHeader>
                    <CardTitle>Cost Optimization Recommendations</CardTitle>
                    <CardDescription>AI-generated suggestions to reduce costs</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-green-600">💡</span>
                                <span className="font-medium">Switch to Haiku</span>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                34% of your queries are simple lookups. Using Claude Haiku could
                                save ~$8/month.
                            </p>
                            <p className="mt-2 text-xs text-green-600">
                                Potential savings: $8.20/month
                            </p>
                        </div>
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-blue-600">📦</span>
                                <span className="font-medium">Enable Caching</span>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                18% of web-search queries are repeated. Caching could reduce API
                                calls.
                            </p>
                            <p className="mt-2 text-xs text-blue-600">
                                Potential savings: $5.40/month
                            </p>
                        </div>
                        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <span className="text-purple-600">✂️</span>
                                <span className="font-medium">Reduce Max Tokens</span>
                            </div>
                            <p className="text-muted-foreground text-sm">
                                Average response uses 45% of max tokens. Reducing limit could save
                                costs.
                            </p>
                            <p className="mt-2 text-xs text-purple-600">
                                Potential savings: $3.10/month
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
