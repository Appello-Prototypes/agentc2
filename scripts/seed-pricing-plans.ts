/**
 * Seed Pricing Plans & Platform Markup Rates
 *
 * Run: bun run scripts/seed-pricing-plans.ts
 *
 * Seeds:
 * - 4 pricing plans (Starter, Pro, Business, Enterprise)
 * - Platform markup rates for common models
 */

import { prisma } from "../packages/database/src";

const PLANS = [
    {
        slug: "starter",
        name: "Starter",
        description:
            "For individuals exploring AI agents. Limited usage with no credit card required.",
        monthlyPriceUsd: 0,
        annualPriceUsd: null,
        perSeatPricing: false,
        includedCreditsUsd: 10,
        markupMultiplier: 3.0,
        overageEnabled: false,
        overageMarkup: null,
        maxAgents: 2,
        maxSeats: 1,
        maxRunsPerMonth: 200,
        maxWorkspaces: 1,
        maxIntegrations: 3,
        features: {
            voice: false,
            budgetControls: false,
            workflows: false,
            networks: false,
            guardrails: false,
            learning: false
        },
        sortOrder: 0
    },
    {
        slug: "pro",
        name: "Pro",
        description:
            "For professionals building production agents. Extended limits with on-demand overage.",
        monthlyPriceUsd: 79,
        annualPriceUsd: 790,
        perSeatPricing: false,
        includedCreditsUsd: 60,
        markupMultiplier: 2.0,
        overageEnabled: true,
        overageMarkup: 2.0,
        maxAgents: 10,
        maxSeats: 3,
        maxRunsPerMonth: 5000,
        maxWorkspaces: 3,
        maxIntegrations: null,
        features: {
            voice: true,
            budgetControls: true,
            workflows: true,
            networks: true,
            guardrails: true,
            learning: true,
            darkFactory: false
        },
        sortOrder: 1
    },
    {
        slug: "business",
        name: "Business",
        description:
            "For teams deploying agents at scale. Full budget hierarchy and advanced controls.",
        monthlyPriceUsd: 199,
        annualPriceUsd: 1990,
        perSeatPricing: false,
        includedCreditsUsd: 150,
        markupMultiplier: 1.5,
        overageEnabled: true,
        overageMarkup: 1.5,
        maxAgents: null,
        maxSeats: null,
        maxRunsPerMonth: 25000,
        maxWorkspaces: null,
        maxIntegrations: null,
        features: {
            voice: true,
            budgetControls: true,
            budgetHierarchy: true,
            workflows: true,
            networks: true,
            guardrails: true,
            learning: true,
            darkFactory: true,
            rbac: true,
            federation: true,
            marginTracking: true
        },
        sortOrder: 2
    },
    {
        slug: "enterprise",
        name: "Enterprise",
        description:
            "Custom pricing for organizations scaling AI agents across the business. SSO, SLA, dedicated support.",
        monthlyPriceUsd: 999,
        annualPriceUsd: 9990,
        perSeatPricing: false,
        includedCreditsUsd: 500,
        markupMultiplier: 1.2,
        overageEnabled: true,
        overageMarkup: 1.2,
        maxAgents: null,
        maxSeats: null,
        maxRunsPerMonth: null,
        maxWorkspaces: null,
        maxIntegrations: null,
        features: {
            voice: true,
            budgetControls: true,
            budgetHierarchy: true,
            workflows: true,
            networks: true,
            guardrails: true,
            learning: true,
            darkFactory: true,
            rbac: true,
            federation: true,
            marginTracking: true,
            sso: true,
            sla: true,
            dedicatedSupport: true,
            invoiceBilling: true,
            scim: true
        },
        sortOrder: 3
    }
];

const MARKUPS = [
    // OpenAI
    {
        provider: "openai",
        modelName: "gpt-4.1",
        inputCostPer1M: 2.0,
        outputCostPer1M: 8.0,
        defaultMarkup: 2.0
    },
    {
        provider: "openai",
        modelName: "gpt-4.1-mini",
        inputCostPer1M: 0.4,
        outputCostPer1M: 1.6,
        defaultMarkup: 2.0
    },
    {
        provider: "openai",
        modelName: "gpt-4.1-nano",
        inputCostPer1M: 0.1,
        outputCostPer1M: 0.4,
        defaultMarkup: 2.0
    },
    {
        provider: "openai",
        modelName: "gpt-4o",
        inputCostPer1M: 2.5,
        outputCostPer1M: 10.0,
        defaultMarkup: 2.0
    },
    {
        provider: "openai",
        modelName: "gpt-4o-mini",
        inputCostPer1M: 0.15,
        outputCostPer1M: 0.6,
        defaultMarkup: 2.0
    },
    {
        provider: "openai",
        modelName: "o4-mini",
        inputCostPer1M: 1.1,
        outputCostPer1M: 4.4,
        defaultMarkup: 2.0
    },
    {
        provider: "openai",
        modelName: "o3",
        inputCostPer1M: 2.0,
        outputCostPer1M: 8.0,
        defaultMarkup: 2.0
    },

    // Anthropic
    {
        provider: "anthropic",
        modelName: "claude-opus-4-5-20251101",
        inputCostPer1M: 15.0,
        outputCostPer1M: 75.0,
        defaultMarkup: 2.0
    },
    {
        provider: "anthropic",
        modelName: "claude-sonnet-4-5-20250929",
        inputCostPer1M: 3.0,
        outputCostPer1M: 15.0,
        defaultMarkup: 2.0
    },
    {
        provider: "anthropic",
        modelName: "claude-opus-4-20250514",
        inputCostPer1M: 15.0,
        outputCostPer1M: 75.0,
        defaultMarkup: 2.0
    },
    {
        provider: "anthropic",
        modelName: "claude-sonnet-4-20250514",
        inputCostPer1M: 3.0,
        outputCostPer1M: 15.0,
        defaultMarkup: 2.0
    },
    {
        provider: "anthropic",
        modelName: "claude-3-5-haiku-20241022",
        inputCostPer1M: 1.0,
        outputCostPer1M: 5.0,
        defaultMarkup: 2.0
    },

    // Google
    {
        provider: "google",
        modelName: "gemini-2.0-flash",
        inputCostPer1M: 0.1,
        outputCostPer1M: 0.4,
        defaultMarkup: 2.0
    },
    {
        provider: "google",
        modelName: "gemini-1.5-pro",
        inputCostPer1M: 3.5,
        outputCostPer1M: 10.5,
        defaultMarkup: 2.0
    },
    {
        provider: "google",
        modelName: "gemini-1.5-flash",
        inputCostPer1M: 0.35,
        outputCostPer1M: 1.05,
        defaultMarkup: 2.0
    }
];

async function main() {
    console.log("Seeding pricing plans...");

    for (const plan of PLANS) {
        const existing = await prisma.pricingPlan.findUnique({
            where: { slug: plan.slug }
        });

        if (existing) {
            await prisma.pricingPlan.update({
                where: { slug: plan.slug },
                data: plan
            });
            console.log(`  Updated plan: ${plan.name}`);
        } else {
            await prisma.pricingPlan.create({ data: plan });
            console.log(`  Created plan: ${plan.name}`);
        }
    }

    console.log("\nSeeding platform markup rates...");

    for (const markup of MARKUPS) {
        const existing = await prisma.platformMarkup.findUnique({
            where: {
                provider_modelName: {
                    provider: markup.provider,
                    modelName: markup.modelName
                }
            }
        });

        if (existing) {
            await prisma.platformMarkup.update({
                where: { id: existing.id },
                data: markup
            });
            console.log(`  Updated: ${markup.provider}/${markup.modelName}`);
        } else {
            await prisma.platformMarkup.create({ data: markup });
            console.log(`  Created: ${markup.provider}/${markup.modelName}`);
        }
    }

    console.log("\nDone! Seeded:");
    console.log(`  ${PLANS.length} pricing plans`);
    console.log(`  ${MARKUPS.length} platform markup rates`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
