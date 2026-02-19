import { prisma } from "@repo/database";

export const dynamic = "force-dynamic";

export default async function PlansManagementPage() {
    const plans = await prisma.pricingPlan.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
            _count: { select: { subscriptions: true } }
        }
    });

    const markups = await prisma.platformMarkup.findMany({
        where: { isActive: true },
        orderBy: [{ provider: "asc" }, { modelName: "asc" }]
    });

    return (
        <div className="space-y-8 p-6">
            <div>
                <h1 className="text-2xl font-bold">Plans & Pricing</h1>
                <p className="text-muted-foreground text-sm">
                    Manage pricing plans, included credits, markup rates, and resource limits.
                </p>
            </div>

            {/* Pricing Plans */}
            <section>
                <h2 className="mb-4 text-lg font-semibold">Pricing Plans</h2>
                {plans.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                        <p className="text-muted-foreground text-sm">
                            No pricing plans defined. Seed plans using the seed script.
                        </p>
                        <code className="mt-2 block text-xs">
                            bun run scripts/seed-pricing-plans.ts
                        </code>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Plan</th>
                                    <th className="px-4 py-3 text-left font-medium">Price</th>
                                    <th className="px-4 py-3 text-left font-medium">Credits</th>
                                    <th className="px-4 py-3 text-left font-medium">Markup</th>
                                    <th className="px-4 py-3 text-left font-medium">Agents</th>
                                    <th className="px-4 py-3 text-left font-medium">Seats</th>
                                    <th className="px-4 py-3 text-left font-medium">Runs/mo</th>
                                    <th className="px-4 py-3 text-left font-medium">Overage</th>
                                    <th className="px-4 py-3 text-left font-medium">Subs</th>
                                    <th className="px-4 py-3 text-left font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {plans.map((plan) => (
                                    <tr key={plan.id} className="hover:bg-muted/30">
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{plan.name}</div>
                                            <div className="text-muted-foreground text-xs">
                                                {plan.slug}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            ${plan.monthlyPriceUsd}/mo
                                            {plan.perSeatPricing && (
                                                <span className="text-muted-foreground text-xs">
                                                    {" "}
                                                    /seat
                                                </span>
                                            )}
                                            {plan.annualPriceUsd && (
                                                <div className="text-muted-foreground text-xs">
                                                    ${plan.annualPriceUsd}/yr
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">${plan.includedCreditsUsd}</td>
                                        <td className="px-4 py-3">{plan.markupMultiplier}x</td>
                                        <td className="px-4 py-3">{plan.maxAgents ?? "∞"}</td>
                                        <td className="px-4 py-3">{plan.maxSeats ?? "∞"}</td>
                                        <td className="px-4 py-3">
                                            {plan.maxRunsPerMonth?.toLocaleString() ?? "∞"}
                                        </td>
                                        <td className="px-4 py-3">
                                            {plan.overageEnabled ? (
                                                <span className="text-green-600">
                                                    {plan.overageMarkup
                                                        ? `${plan.overageMarkup}x`
                                                        : `${plan.markupMultiplier}x`}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    Blocked
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {plan._count.subscriptions}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    plan.isActive
                                                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                                }`}
                                            >
                                                {plan.isActive ? "Active" : "Disabled"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Margin Summary */}
            <section>
                <h2 className="mb-4 text-lg font-semibold">Margin Analysis</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {plans
                        .filter((p) => p.isActive && p.monthlyPriceUsd > 0)
                        .map((plan) => {
                            const realCost = plan.includedCreditsUsd / plan.markupMultiplier;
                            const margin = plan.monthlyPriceUsd - realCost;
                            const marginPct =
                                plan.monthlyPriceUsd > 0
                                    ? (margin / plan.monthlyPriceUsd) * 100
                                    : 0;
                            return (
                                <div key={plan.id} className="rounded-lg border p-4">
                                    <div className="mb-2 font-medium">{plan.name}</div>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                                Monthly fee
                                            </span>
                                            <span>${plan.monthlyPriceUsd}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                                Real API cost of credits
                                            </span>
                                            <span>${realCost.toFixed(2)}</span>
                                        </div>
                                        <div className="border-t pt-1">
                                            <div className="flex justify-between font-medium">
                                                <span>Gross margin</span>
                                                <span className="text-green-600">
                                                    ${margin.toFixed(2)} ({marginPct.toFixed(0)}%)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </section>

            {/* Platform Markup Rates */}
            <section>
                <h2 className="mb-4 text-lg font-semibold">Platform Markup Rates</h2>
                {markups.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                        <p className="text-muted-foreground text-sm">
                            No custom markup rates defined. The plan&apos;s default markup
                            multiplier is used for all models.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium">Provider</th>
                                    <th className="px-4 py-3 text-left font-medium">Model</th>
                                    <th className="px-4 py-3 text-left font-medium">Input / 1M</th>
                                    <th className="px-4 py-3 text-left font-medium">Output / 1M</th>
                                    <th className="px-4 py-3 text-left font-medium">
                                        Default Markup
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {markups.map((m) => (
                                    <tr key={m.id} className="hover:bg-muted/30">
                                        <td className="px-4 py-3 capitalize">{m.provider}</td>
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {m.modelName}
                                        </td>
                                        <td className="px-4 py-3">${m.inputCostPer1M}</td>
                                        <td className="px-4 py-3">${m.outputCostPer1M}</td>
                                        <td className="px-4 py-3">{m.defaultMarkup}x</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
