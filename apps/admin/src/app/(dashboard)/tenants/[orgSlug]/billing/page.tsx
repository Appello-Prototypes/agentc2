import { notFound } from "next/navigation";
import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function TenantBillingPage({
    params
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, name: true, slug: true, status: true, stripeCustomerId: true }
    });
    if (!org) notFound();

    const [subscription, orgBudget, userBudgets, alerts] = await Promise.all([
        prisma.orgSubscription.findUnique({
            where: { organizationId: org.id },
            include: { plan: true }
        }),
        prisma.orgBudgetPolicy.findUnique({
            where: { organizationId: org.id }
        }),
        prisma.userBudgetPolicy.findMany({
            where: { organizationId: org.id }
        }),
        prisma.budgetAlert.findMany({
            where: { organizationId: org.id },
            orderBy: { createdAt: "desc" },
            take: 10
        })
    ]);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const costEvents = await prisma.costEvent.findMany({
        where: { tenantId: org.id, createdAt: { gte: startOfMonth } },
        select: { costUsd: true, billedCostUsd: true, platformCostUsd: true }
    });

    const totalBilled = costEvents.reduce((s, e) => s + (e.billedCostUsd ?? e.costUsd ?? 0), 0);
    const totalPlatformCost = costEvents.reduce(
        (s, e) => s + (e.platformCostUsd ?? e.costUsd ?? 0),
        0
    );
    const margin = totalBilled - totalPlatformCost;

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold">Billing — {org.name}</h1>
                <p className="text-muted-foreground text-sm">
                    Subscription, budget policies, and financial controls for this tenant.
                </p>
            </div>

            {/* Subscription */}
            <section className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Subscription</h2>
                    {org.stripeCustomerId && (
                        <a
                            href={`https://dashboard.stripe.com/customers/${org.stripeCustomerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
                        >
                            View in Stripe →
                        </a>
                    )}
                </div>
                {subscription ? (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div>
                            <div className="text-muted-foreground text-xs">Plan</div>
                            <div className="font-medium">{subscription.plan.name}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Status</div>
                            <div className="capitalize">
                                <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                        subscription.status === "active"
                                            ? "bg-green-100 text-green-700"
                                            : subscription.status === "past_due"
                                              ? "bg-red-100 text-red-700"
                                              : "bg-amber-100 text-amber-700"
                                    }`}
                                >
                                    {subscription.status}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Credits</div>
                            <div className="font-medium">
                                ${subscription.usedCreditsUsd.toFixed(2)} / $
                                {subscription.includedCreditsUsd.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Seats</div>
                            <div className="font-medium">{subscription.seatCount}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Billing Cycle</div>
                            <div className="capitalize">{subscription.billingCycle}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Markup</div>
                            <div>{subscription.plan.markupMultiplier}x</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Overage</div>
                            <div>
                                {subscription.plan.overageEnabled ? (
                                    <>
                                        Enabled — ${subscription.overageAccruedUsd.toFixed(2)}
                                        {subscription.overageSpendLimitUsd != null
                                            ? ` / $${subscription.overageSpendLimitUsd}`
                                            : " (no limit)"}
                                    </>
                                ) : (
                                    "Blocked"
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Stripe Sub</div>
                            <div className="font-mono text-xs">
                                {subscription.stripeSubscriptionId ? (
                                    <a
                                        href={`https://dashboard.stripe.com/subscriptions/${subscription.stripeSubscriptionId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:underline"
                                    >
                                        {subscription.stripeSubscriptionId.slice(0, 20)}…
                                    </a>
                                ) : (
                                    "N/A"
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Period</div>
                            <div className="text-xs">
                                {subscription.currentPeriodStart
                                    ? new Date(subscription.currentPeriodStart).toLocaleDateString()
                                    : "—"}{" "}
                                –{" "}
                                {subscription.currentPeriodEnd
                                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                                    : "—"}
                            </div>
                        </div>
                        {subscription.canceledAt && (
                            <div>
                                <div className="text-muted-foreground text-xs">Canceled At</div>
                                <div className="text-xs text-red-600">
                                    {new Date(subscription.canceledAt).toLocaleDateString()}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        No active subscription for this tenant.
                        {org.stripeCustomerId && (
                            <span className="ml-1">
                                Stripe customer:{" "}
                                <span className="font-mono text-xs">{org.stripeCustomerId}</span>
                            </span>
                        )}
                    </p>
                )}
            </section>

            {/* Current Month Financials */}
            <section className="rounded-lg border p-4">
                <h2 className="mb-3 text-lg font-semibold">Current Month</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
                        <div className="text-xs font-medium text-blue-600">Billed</div>
                        <div className="text-xl font-bold">${totalBilled.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                        <div className="text-xs font-medium text-slate-600">API Cost</div>
                        <div className="text-xl font-bold">${totalPlatformCost.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950">
                        <div className="text-xs font-medium text-green-600">Margin</div>
                        <div className="text-xl font-bold text-green-600">${margin.toFixed(2)}</div>
                    </div>
                </div>
            </section>

            {/* Budget Policies */}
            <section className="rounded-lg border p-4">
                <h2 className="mb-3 text-lg font-semibold">Budget Policies</h2>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium">Organization Budget</h3>
                        {orgBudget ? (
                            <div className="mt-1 grid grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Enabled:</span>{" "}
                                    {orgBudget.enabled ? "Yes" : "No"}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Limit:</span>{" "}
                                    {orgBudget.monthlyLimitUsd
                                        ? `$${orgBudget.monthlyLimitUsd}`
                                        : "None"}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Alert:</span>{" "}
                                    {orgBudget.alertAtPct}%
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Hard Limit:</span>{" "}
                                    {orgBudget.hardLimit ? "Yes" : "No"}
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground mt-1 text-sm">Not configured</p>
                        )}
                    </div>

                    <div>
                        <h3 className="text-sm font-medium">User Budgets ({userBudgets.length})</h3>
                        {userBudgets.length > 0 ? (
                            <div className="mt-1 space-y-1">
                                {userBudgets.map((ub) => (
                                    <div key={ub.id} className="flex items-center gap-4 text-sm">
                                        <span className="text-muted-foreground font-mono text-xs">
                                            {ub.userId.slice(0, 12)}…
                                        </span>
                                        <span>
                                            {ub.enabled
                                                ? `$${ub.monthlyLimitUsd ?? "∞"}/mo`
                                                : "Disabled"}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {ub.hardLimit ? "Hard" : "Soft"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground mt-1 text-sm">
                                No per-user budgets configured
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* Recent Alerts */}
            {alerts.length > 0 && (
                <section className="rounded-lg border p-4">
                    <h2 className="mb-3 text-lg font-semibold">Recent Alerts</h2>
                    <div className="space-y-2">
                        {alerts.map((alert) => (
                            <div
                                key={alert.id}
                                className={`rounded-lg p-3 text-sm ${
                                    alert.type === "limit_reached"
                                        ? "bg-red-50 dark:bg-red-950"
                                        : "bg-amber-50 dark:bg-amber-950"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium capitalize dark:bg-black/20">
                                        {alert.level}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {new Date(alert.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <p className="mt-1">{alert.message}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
