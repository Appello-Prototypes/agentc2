"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants, cn } from "@repo/ui";

const plans = {
    individual: [
        {
            name: "Starter",
            price: "$0",
            period: "forever",
            description: "For individuals exploring AI agents.",
            cta: "Get Started Free",
            ctaVariant: "outline" as const,
            href: "/signup",
            features: [
                "2 agents",
                "$10 included usage credits",
                "200 runs / month",
                "3 MCP integrations",
                "Community support",
                "Basic analytics"
            ]
        },
        {
            name: "Pro",
            price: "$79",
            period: "/ month",
            description: "For professionals building production agents.",
            cta: "Start Pro Trial",
            ctaVariant: "default" as const,
            href: "/signup?plan=pro",
            popular: true,
            features: [
                "$60 included usage credits",
                "10 agents",
                "5,000 runs / month",
                "3 seats included",
                "All MCP integrations",
                "Workflows & networks",
                "Voice agents",
                "Per-agent budget controls",
                "Priority email support",
                "On-demand overage at 2x rate"
            ]
        },
        {
            name: "Business",
            price: "$199",
            period: "/ month",
            description: "For teams deploying agents at scale.",
            cta: "Start Business Trial",
            ctaVariant: "outline" as const,
            href: "/signup?plan=business",
            features: [
                "$150 pooled usage credits",
                "Unlimited agents",
                "25,000 runs / month",
                "Unlimited seats",
                "Full budget hierarchy (org → user → agent)",
                "Role-based access control",
                "Advanced guardrails",
                "Usage analytics & margin tracking",
                "On-demand overage at 1.5x rate",
                "Priority support"
            ]
        }
    ],
    team: [
        {
            name: "Teams",
            price: "$49",
            period: "/ user / month",
            description: "For organizations deploying agents across departments.",
            cta: "Start Team Trial",
            ctaVariant: "outline" as const,
            href: "/signup?plan=team",
            features: [
                "Everything in Pro",
                "$60 credits per user",
                "Shared workspaces",
                "Centralized billing",
                "Role-based access control",
                "Team analytics & cost allocation",
                "Org-wide budget controls",
                "Per-user budget limits",
                "Full audit logs & traceability"
            ]
        },
        {
            name: "Enterprise",
            price: "Custom",
            period: "",
            description: "For organizations scaling AI agents across the business.",
            cta: "Book a Demo",
            ctaVariant: "default" as const,
            href: "mailto:sales@agentc2.com",
            popular: true,
            features: [
                "Everything in Teams",
                "Pooled usage credits",
                "Negotiated markup rates",
                "Unlimited runs & agents",
                "SSO / SAML authentication",
                "Custom MCP integrations",
                "Invoice / PO billing",
                "Dedicated infrastructure",
                "99.99% uptime SLA",
                "Dedicated account manager"
            ]
        },
        {
            name: "Enterprise+",
            price: "Custom",
            period: "",
            description: "White-glove deployment for regulated industries.",
            cta: "Contact Sales",
            ctaVariant: "outline" as const,
            href: "mailto:sales@agentc2.com",
            features: [
                "Everything in Enterprise",
                "Multi-region deployment",
                "Custom compliance (SOC 2, HIPAA)",
                "On-premise deployment option",
                "Professional services & integration",
                "Architecture review & optimization",
                "Priority engineering support"
            ]
        }
    ]
};

export function PricingSection() {
    const [tab, setTab] = useState<"individual" | "team">("team");

    return (
        <section id="pricing" className="bg-muted/30 scroll-mt-20 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="mb-4 text-center">
                    <span className="text-primary text-sm font-semibold tracking-wider uppercase">
                        Pricing
                    </span>
                </div>
                <h2 className="text-foreground mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
                    Plans that scale with your business
                </h2>
                <p className="text-muted-foreground mx-auto mb-4 max-w-2xl text-center text-lg">
                    Start free. Scale to enterprise with dedicated infrastructure, SSO, and custom
                    SLAs.
                </p>
                <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-center text-sm">
                    Every plan includes usage credits for AI model calls. Go beyond your credits
                    with on-demand usage at transparent rates.
                </p>

                {/* Toggle */}
                <div className="mb-12 flex justify-center">
                    <div className="bg-muted inline-flex rounded-full p-1">
                        <button
                            onClick={() => setTab("team")}
                            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                                tab === "team"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Team & Enterprise
                        </button>
                        <button
                            onClick={() => setTab("individual")}
                            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                                tab === "individual"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Individual
                        </button>
                    </div>
                </div>

                {/* Cards */}
                <div className="grid gap-6 md:grid-cols-3">
                    {plans[tab].map((plan) => (
                        <div
                            key={plan.name}
                            className={`bg-card relative flex flex-col rounded-2xl border p-8 ${
                                plan.popular
                                    ? "border-primary/40 shadow-primary/10 shadow-lg"
                                    : "border-border/60"
                            }`}
                        >
                            {plan.popular && (
                                <span className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold">
                                    Most popular
                                </span>
                            )}

                            <h3 className="text-foreground mb-1 text-lg font-bold">{plan.name}</h3>
                            <p className="text-muted-foreground mb-4 text-sm">{plan.description}</p>

                            <div className="mb-6 flex items-baseline gap-1">
                                <span className="text-foreground text-4xl font-bold tracking-tight">
                                    {plan.price}
                                </span>
                                {plan.period && (
                                    <span className="text-muted-foreground text-sm">
                                        {plan.period}
                                    </span>
                                )}
                            </div>

                            <Link
                                href={plan.href}
                                className={cn(
                                    buttonVariants({
                                        variant: plan.ctaVariant
                                    }),
                                    "mb-8 w-full"
                                )}
                            >
                                {plan.cta}
                            </Link>

                            <ul className="flex-1 space-y-3">
                                {plan.features.map((feature) => (
                                    <li
                                        key={feature}
                                        className="text-foreground flex items-start gap-2 text-sm"
                                    >
                                        <svg
                                            className="text-primary mt-0.5 h-4 w-4 shrink-0"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                        >
                                            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                                        </svg>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Usage note */}
                <div className="mt-8 text-center">
                    <p className="text-muted-foreground text-sm">
                        Annual billing: 17% discount (2 months free). All plans include transparent
                        usage-based pricing beyond included credits.
                    </p>
                </div>
            </div>
        </section>
    );
}
