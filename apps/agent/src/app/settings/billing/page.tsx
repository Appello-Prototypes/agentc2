"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Skeleton,
    Alert,
    AlertDescription,
    Input,
    Switch,
    Label,
    Badge,
    Separator,
    Slider,
    icons,
    HugeiconsIcon
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface PlanLimits {
    maxAgents: number | null;
    maxSeats: number | null;
    maxRunsPerMonth: number | null;
    maxWorkspaces: number | null;
    maxIntegrations: number | null;
}

interface SubscriptionData {
    id: string;
    planSlug: string;
    planName: string;
    status: string;
    billingCycle: string;
    monthlyPriceUsd: number;
    includedCreditsUsd: number;
    usedCreditsUsd: number;
    overageEnabled: boolean;
    overageSpendLimitUsd: number | null;
    overageAccruedUsd: number;
    markupMultiplier: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    seatCount: number;
    features: Record<string, boolean> | null;
    limits: PlanLimits;
}

interface OrgBudgetData {
    id: string;
    enabled: boolean;
    monthlyLimitUsd: number | null;
    alertAtPct: number | null;
    hardLimit: boolean;
    defaultUserBudgetUsd: number | null;
}

interface UserBudgetData {
    id: string;
    userId: string;
    enabled: boolean;
    monthlyLimitUsd: number | null;
    alertAtPct: number | null;
    hardLimit: boolean;
    currentSpendUsd: number;
}

interface UsageData {
    currentMonthBilledUsd: number;
    currentMonthPlatformCostUsd: number;
    margin: number;
    byAgent: Record<string, number>;
    byUser: Record<string, number>;
    period: { from: string; to: string };
}

interface BudgetAlertData {
    id: string;
    level: string;
    type: string;
    percentUsed: number;
    currentSpendUsd: number;
    limitUsd: number;
    message: string;
    acknowledged: boolean;
    createdAt: string;
}

interface PlanOption {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    monthlyPriceUsd: number;
    annualPriceUsd: number | null;
    includedCreditsUsd: number;
    maxAgents: number | null;
    maxSeats: number | null;
}

interface BudgetState {
    subscription: SubscriptionData | null;
    orgBudget: OrgBudgetData | null;
    userBudgets: UserBudgetData[];
    usage: UsageData | null;
    alerts: BudgetAlertData[];
}

interface MemberInfo {
    id: string;
    name: string;
    email: string;
    role: string;
}

export default function BillingBudgetPage() {
    const searchParams = useSearchParams();
    const checkoutResult = searchParams?.get("checkout");
    const [state, setState] = useState<BudgetState>({
        subscription: null,
        orgBudget: null,
        userBudgets: [],
        usage: null,
        alerts: []
    });
    const [members, setMembers] = useState<MemberInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [plans, setPlans] = useState<PlanOption[]>([]);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);

    // Org budget form
    const [budgetEnabled, setBudgetEnabled] = useState(false);
    const [monthlyLimit, setMonthlyLimit] = useState("");
    const [alertPct, setAlertPct] = useState(80);
    const [hardLimit, setHardLimit] = useState(true);
    const [defaultUserBudget, setDefaultUserBudget] = useState("");

    // Overage form
    const [overageLimit, setOverageLimit] = useState("");

    const fetchData = useCallback(async () => {
        try {
            const orgRes = await fetch(`${getApiBase()}/api/organizations`);
            const orgData = await orgRes.json();
            if (!orgData.success || !orgData.organizations?.length) {
                setLoading(false);
                return;
            }
            const org = orgData.organizations[0];
            setOrgId(org.id);

            const [budgetRes, membersRes, plansRes] = await Promise.all([
                fetch(`${getApiBase()}/api/organizations/${org.id}/budget`),
                fetch(`${getApiBase()}/api/organizations/${org.id}/members`),
                fetch(`${getApiBase()}/api/plans`)
            ]);

            const budgetData = await budgetRes.json();
            const membersData = await membersRes.json();
            const plansData = await plansRes.json();
            if (plansData.success) {
                setPlans(plansData.plans ?? []);
            }

            if (budgetData.success) {
                setState({
                    subscription: budgetData.subscription,
                    orgBudget: budgetData.orgBudget,
                    userBudgets: budgetData.userBudgets ?? [],
                    usage: budgetData.usage,
                    alerts: budgetData.alerts ?? []
                });

                if (budgetData.orgBudget) {
                    setBudgetEnabled(budgetData.orgBudget.enabled);
                    setMonthlyLimit(budgetData.orgBudget.monthlyLimitUsd?.toString() ?? "");
                    setAlertPct(budgetData.orgBudget.alertAtPct ?? 80);
                    setHardLimit(budgetData.orgBudget.hardLimit);
                    setDefaultUserBudget(
                        budgetData.orgBudget.defaultUserBudgetUsd?.toString() ?? ""
                    );
                }

                if (budgetData.subscription?.overageSpendLimitUsd != null) {
                    setOverageLimit(budgetData.subscription.overageSpendLimitUsd.toString());
                }
            }

            if (membersData.success) {
                setMembers(
                    (membersData.members || []).map(
                        (m: {
                            userId: string;
                            user: { name: string; email: string };
                            role: string;
                        }) => ({
                            id: m.userId,
                            name: m.user?.name ?? "Unknown",
                            email: m.user?.email ?? "",
                            role: m.role
                        })
                    )
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load budget data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const saveOrgBudget = async () => {
        if (!orgId) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${getApiBase()}/api/organizations/${orgId}/budget`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enabled: budgetEnabled,
                    monthlyLimitUsd: monthlyLimit ? parseFloat(monthlyLimit) : null,
                    alertAtPct: alertPct,
                    hardLimit,
                    defaultUserBudgetUsd: defaultUserBudget ? parseFloat(defaultUserBudget) : null
                })
            });
            const data = await res.json();
            if (data.success) {
                setSuccess("Organization budget policy saved.");
                fetchData();
            } else {
                setError(data.error || "Failed to save");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const saveOverageLimit = async () => {
        if (!orgId) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${getApiBase()}/api/organizations/${orgId}/subscription`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    overageSpendLimitUsd: overageLimit ? parseFloat(overageLimit) : null
                })
            });
            const data = await res.json();
            if (data.success) {
                setSuccess("Overage spend limit updated.");
                fetchData();
            } else {
                setError(data.error || "Failed to save");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const saveUserBudget = async (
        userId: string,
        updates: { enabled?: boolean; monthlyLimitUsd?: number | null; hardLimit?: boolean }
    ) => {
        if (!orgId) return;

        try {
            const res = await fetch(`${getApiBase()}/api/organizations/${orgId}/budget/users`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, ...updates })
            });
            const data = await res.json();
            if (data.success) {
                fetchData();
            }
        } catch {
            // Silent fail for inline edits
        }
    };

    const handleUpgrade = async (planSlug: string, billingCycle: string = "monthly") => {
        setCheckoutLoading(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/stripe/checkout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planSlug, billingCycle })
            });
            const data = await res.json();
            if (data.success && data.url) {
                window.location.href = data.url;
            } else {
                setError(data.error || "Failed to start checkout");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Checkout failed");
        } finally {
            setCheckoutLoading(false);
        }
    };

    const handleManageBilling = async () => {
        setPortalLoading(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/stripe/portal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (data.success && data.url) {
                window.location.href = data.url;
            } else {
                setError(data.error || "Failed to open billing portal");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Portal failed");
        } finally {
            setPortalLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Billing & Budget</h2>
                    <p className="text-muted-foreground">
                        Manage your plan, usage credits, and budget controls.
                    </p>
                </div>
                <div className="grid gap-6">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-64" />
                    <Skeleton className="h-48" />
                </div>
            </div>
        );
    }

    const sub = state.subscription;
    const creditPct = sub
        ? Math.min(100, (sub.usedCreditsUsd / Math.max(sub.includedCreditsUsd, 0.01)) * 100)
        : 0;
    const creditsRemaining = sub ? Math.max(0, sub.includedCreditsUsd - sub.usedCreditsUsd) : 0;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Billing & Budget</h2>
                <p className="text-muted-foreground">
                    Manage your plan, usage credits, and budget controls.
                </p>
            </div>

            {checkoutResult === "success" && (
                <Alert>
                    <AlertDescription>
                        Subscription activated successfully! Your plan is now active.
                    </AlertDescription>
                </Alert>
            )}
            {checkoutResult === "canceled" && (
                <Alert variant="destructive">
                    <AlertDescription>
                        Checkout was canceled. You can try again anytime.
                    </AlertDescription>
                </Alert>
            )}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {success && (
                <Alert>
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            {/* Subscription / Plan Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Current Plan</CardTitle>
                            <CardDescription>
                                {sub
                                    ? `${sub.planName} — $${sub.monthlyPriceUsd}/mo`
                                    : "No active subscription"}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            {sub && (
                                <Badge
                                    variant={sub.status === "active" ? "default" : "secondary"}
                                    className="capitalize"
                                >
                                    {sub.status}
                                </Badge>
                            )}
                            {sub && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleManageBilling}
                                    disabled={portalLoading}
                                >
                                    {portalLoading ? "Opening…" : "Manage Billing"}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                {sub && (
                    <CardContent className="space-y-6">
                        {/* Usage Credits Meter */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">Usage Credits</span>
                                <span className="text-muted-foreground">
                                    ${sub.usedCreditsUsd.toFixed(2)} / $
                                    {sub.includedCreditsUsd.toFixed(2)}
                                </span>
                            </div>
                            <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
                                <div
                                    className="bg-primary h-full rounded-full transition-all"
                                    style={{ width: `${Math.min(creditPct, 100)}%` }}
                                />
                            </div>
                            <div className="text-muted-foreground flex items-center justify-between text-xs">
                                <span>${creditsRemaining.toFixed(2)} remaining</span>
                                <span>{Math.round(creditPct)}% used</span>
                            </div>
                        </div>

                        <Separator />

                        {/* Plan Limits Grid */}
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div className="rounded-lg border p-3 text-center">
                                <div className="text-2xl font-bold">
                                    {sub.limits.maxAgents ?? "∞"}
                                </div>
                                <div className="text-muted-foreground text-xs">Agents</div>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                                <div className="text-2xl font-bold">
                                    {sub.limits.maxSeats ?? "∞"}
                                </div>
                                <div className="text-muted-foreground text-xs">Seats</div>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                                <div className="text-2xl font-bold">
                                    {sub.limits.maxRunsPerMonth
                                        ? sub.limits.maxRunsPerMonth.toLocaleString()
                                        : "∞"}
                                </div>
                                <div className="text-muted-foreground text-xs">Runs / mo</div>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                                <div className="text-2xl font-bold">{sub.markupMultiplier}x</div>
                                <div className="text-muted-foreground text-xs">Usage Rate</div>
                            </div>
                        </div>

                        {/* Overage Controls */}
                        {sub.overageEnabled && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium">Overage Spend Limit</h4>
                                    <p className="text-muted-foreground text-xs">
                                        Set a maximum amount for overage charges beyond included
                                        credits. When reached, agent runs will be paused until next
                                        billing cycle.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                                                $
                                            </span>
                                            <Input
                                                type="number"
                                                value={overageLimit}
                                                onChange={(e) => setOverageLimit(e.target.value)}
                                                className="pl-7"
                                                placeholder="No limit"
                                                min={0}
                                                step={10}
                                            />
                                        </div>
                                        <Button
                                            onClick={saveOverageLimit}
                                            disabled={saving}
                                            size="sm"
                                        >
                                            Save
                                        </Button>
                                    </div>
                                    {sub.overageAccruedUsd > 0 && (
                                        <p className="text-xs text-amber-600">
                                            Current overage: ${sub.overageAccruedUsd.toFixed(2)}
                                            {sub.overageSpendLimitUsd
                                                ? ` / $${sub.overageSpendLimitUsd.toFixed(2)}`
                                                : ""}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}

                        <Separator />

                        {/* Period Info */}
                        <div className="text-muted-foreground flex items-center justify-between text-xs">
                            <span>
                                Billing period:{" "}
                                {new Date(sub.currentPeriodStart).toLocaleDateString()} –{" "}
                                {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                            </span>
                            <span>{sub.billingCycle}</span>
                        </div>

                        {/* Upgrade Options */}
                        {plans.filter((p) => p.monthlyPriceUsd > sub.monthlyPriceUsd).length >
                            0 && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium">Upgrade Plan</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {plans
                                            .filter((p) => p.monthlyPriceUsd > sub.monthlyPriceUsd)
                                            .map((plan) => (
                                                <Button
                                                    key={plan.id}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleUpgrade(plan.slug)}
                                                    disabled={checkoutLoading}
                                                >
                                                    {plan.name} — ${plan.monthlyPriceUsd}
                                                    /mo
                                                </Button>
                                            ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                )}
                {!sub && (
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            No subscription is active for this organization. Choose a plan to get
                            started.
                        </p>
                        {plans.length > 0 && (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {plans
                                    .filter((p) => p.monthlyPriceUsd > 0)
                                    .map((plan) => (
                                        <div
                                            key={plan.id}
                                            className="flex flex-col justify-between rounded-lg border p-4"
                                        >
                                            <div>
                                                <h4 className="font-semibold">{plan.name}</h4>
                                                <p className="text-muted-foreground mt-1 text-sm">
                                                    {plan.description}
                                                </p>
                                                <div className="mt-3">
                                                    <span className="text-2xl font-bold">
                                                        ${plan.monthlyPriceUsd}
                                                    </span>
                                                    <span className="text-muted-foreground text-sm">
                                                        /mo
                                                    </span>
                                                </div>
                                                <p className="text-muted-foreground mt-1 text-xs">
                                                    ${plan.includedCreditsUsd} credits included
                                                </p>
                                            </div>
                                            <Button
                                                className="mt-4 w-full"
                                                onClick={() => handleUpgrade(plan.slug)}
                                                disabled={checkoutLoading}
                                            >
                                                {checkoutLoading ? "Processing…" : "Subscribe"}
                                            </Button>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* Current Month Usage */}
            {state.usage && (
                <Card>
                    <CardHeader>
                        <CardTitle>Current Month Usage</CardTitle>
                        <CardDescription>
                            {new Date(state.usage.period.from).toLocaleDateString()} –{" "}
                            {new Date(state.usage.period.to).toLocaleDateString()}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-lg border p-4">
                                <div className="text-muted-foreground text-xs font-medium uppercase">
                                    Total Billed
                                </div>
                                <div className="mt-1 text-2xl font-bold">
                                    ${state.usage.currentMonthBilledUsd.toFixed(2)}
                                </div>
                            </div>
                            <div className="rounded-lg border p-4">
                                <div className="text-muted-foreground text-xs font-medium uppercase">
                                    Platform Cost
                                </div>
                                <div className="mt-1 text-2xl font-bold">
                                    ${state.usage.currentMonthPlatformCostUsd.toFixed(2)}
                                </div>
                            </div>
                            <div className="rounded-lg border p-4">
                                <div className="text-muted-foreground text-xs font-medium uppercase">
                                    Margin
                                </div>
                                <div className="mt-1 text-2xl font-bold text-green-600">
                                    ${state.usage.margin.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* Top agents by spend */}
                        {Object.keys(state.usage.byAgent).length > 0 && (
                            <div className="mt-4">
                                <h4 className="mb-2 text-sm font-medium">Spend by Agent</h4>
                                <div className="space-y-1">
                                    {Object.entries(state.usage.byAgent)
                                        .sort(([, a], [, b]) => b - a)
                                        .slice(0, 5)
                                        .map(([agentId, cost]) => (
                                            <div
                                                key={agentId}
                                                className="hover:bg-muted/50 flex items-center justify-between rounded px-2 py-1 text-sm"
                                            >
                                                <span className="text-muted-foreground font-mono text-xs">
                                                    {agentId.slice(0, 12)}…
                                                </span>
                                                <span className="font-medium">
                                                    ${cost.toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Organization Budget Policy */}
            <Card>
                <CardHeader>
                    <CardTitle>Organization Budget Policy</CardTitle>
                    <CardDescription>
                        Set a hard monthly spending cap for the entire organization. When enabled,
                        agent runs will be blocked once the limit is reached.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="budget-enabled" className="text-sm font-medium">
                            Enable Organization Budget
                        </Label>
                        <Switch
                            id="budget-enabled"
                            checked={budgetEnabled}
                            onCheckedChange={setBudgetEnabled}
                        />
                    </div>

                    {budgetEnabled && (
                        <>
                            <div className="space-y-2">
                                <Label className="text-sm">Monthly Budget Limit</Label>
                                <div className="relative">
                                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                                        $
                                    </span>
                                    <Input
                                        type="number"
                                        value={monthlyLimit}
                                        onChange={(e) => setMonthlyLimit(e.target.value)}
                                        className="pl-7"
                                        placeholder="e.g. 500"
                                        min={0}
                                        step={50}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm">Alert Threshold: {alertPct}%</Label>
                                <Slider
                                    value={[alertPct]}
                                    onValueChange={(v) => {
                                        const val = Array.isArray(v) ? v[0] : v;
                                        setAlertPct(val ?? 80);
                                    }}
                                    min={50}
                                    max={100}
                                    step={5}
                                />
                                <p className="text-muted-foreground text-xs">
                                    Send an alert when usage reaches this percentage of the budget.
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm">Hard Limit (Block Runs)</Label>
                                    <p className="text-muted-foreground text-xs">
                                        When enabled, agent runs are blocked once the budget is
                                        exceeded. When disabled, only alerts are sent.
                                    </p>
                                </div>
                                <Switch checked={hardLimit} onCheckedChange={setHardLimit} />
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label className="text-sm">Default Per-User Budget</Label>
                                <div className="relative">
                                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                                        $
                                    </span>
                                    <Input
                                        type="number"
                                        value={defaultUserBudget}
                                        onChange={(e) => setDefaultUserBudget(e.target.value)}
                                        className="pl-7"
                                        placeholder="No default"
                                        min={0}
                                        step={25}
                                    />
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    Automatically apply this monthly budget to new members. Leave
                                    empty for no per-user limit.
                                </p>
                            </div>
                        </>
                    )}

                    <Button onClick={saveOrgBudget} disabled={saving}>
                        {saving ? "Saving…" : "Save Budget Policy"}
                    </Button>
                </CardContent>
            </Card>

            {/* Per-User Budgets */}
            {members.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Per-User Budgets</CardTitle>
                        <CardDescription>
                            Control how much each team member can spend on agent runs per month.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {members.map((member) => {
                                const ub = state.userBudgets.find((u) => u.userId === member.id);
                                return (
                                    <UserBudgetRow
                                        key={member.id}
                                        member={member}
                                        budget={ub ?? null}
                                        onSave={(updates) => saveUserBudget(member.id, updates)}
                                    />
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Budget Alerts */}
            {state.alerts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Budget Alerts</CardTitle>
                        <CardDescription>
                            Alerts triggered when budgets approach or exceed their limits.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {state.alerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                                        alert.type === "limit_reached"
                                            ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                                            : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
                                    }`}
                                >
                                    <HugeiconsIcon
                                        icon={
                                            alert.type === "limit_reached"
                                                ? icons["alert-triangle"]!
                                                : icons["alert-diamond"]!
                                        }
                                        className={`mt-0.5 size-4 shrink-0 ${
                                            alert.type === "limit_reached"
                                                ? "text-red-600"
                                                : "text-amber-600"
                                        }`}
                                        strokeWidth={1.5}
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {alert.level}
                                            </Badge>
                                            <span className="text-muted-foreground text-xs">
                                                {new Date(alert.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm">{alert.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function UserBudgetRow({
    member,
    budget,
    onSave
}: {
    member: MemberInfo;
    budget: UserBudgetData | null;
    onSave: (updates: {
        enabled?: boolean;
        monthlyLimitUsd?: number | null;
        hardLimit?: boolean;
    }) => void;
}) {
    const [enabled, setEnabled] = useState(budget?.enabled ?? false);
    const [limit, setLimit] = useState(budget?.monthlyLimitUsd?.toString() ?? "");
    const [editing, setEditing] = useState(false);

    return (
        <div className="flex items-center gap-4 rounded-lg border p-3">
            <div className="flex-1">
                <div className="text-sm font-medium">{member.name}</div>
                <div className="text-muted-foreground text-xs">{member.email}</div>
            </div>

            <div className="flex items-center gap-3">
                {budget?.currentSpendUsd != null && (
                    <span className="text-muted-foreground text-xs">
                        ${budget.currentSpendUsd.toFixed(2)} spent
                    </span>
                )}

                {editing ? (
                    <div className="flex items-center gap-2">
                        <div className="relative w-24">
                            <span className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-xs">
                                $
                            </span>
                            <Input
                                type="number"
                                value={limit}
                                onChange={(e) => setLimit(e.target.value)}
                                className="h-8 pl-5 text-xs"
                                placeholder="Limit"
                                min={0}
                            />
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => {
                                onSave({
                                    enabled: true,
                                    monthlyLimitUsd: limit ? parseFloat(limit) : null,
                                    hardLimit: true
                                });
                                setEnabled(true);
                                setEditing(false);
                            }}
                        >
                            Save
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => setEditing(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <>
                        {enabled && budget?.monthlyLimitUsd ? (
                            <Badge variant="outline" className="text-xs">
                                ${budget.monthlyLimitUsd}/mo
                            </Badge>
                        ) : (
                            <span className="text-muted-foreground text-xs">No limit</span>
                        )}
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => setEditing(true)}
                        >
                            Edit
                        </Button>
                        {enabled && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-red-500"
                                onClick={() => {
                                    onSave({ enabled: false });
                                    setEnabled(false);
                                }}
                            >
                                Remove
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
