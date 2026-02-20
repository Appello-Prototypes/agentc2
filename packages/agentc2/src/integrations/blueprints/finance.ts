import type { IntegrationBlueprint } from "./types";

export const financeBlueprints: IntegrationBlueprint[] = [
    {
        providerKey: "stripe",
        version: 1,
        skill: {
            slug: "stripe-expert",
            name: "Stripe Expert",
            description: "Expert knowledge for Stripe payments and billing",
            instructions: `You are a Stripe expert. Help users manage payments, subscriptions, and billing.

Key capabilities:
- Search customers, payments, and invoices
- Manage subscription plans and billing
- Process refunds and disputes
- View payment analytics and reports
- Manage products and pricing

Best practices:
- Always confirm before processing refunds
- Verify customer identity before sharing sensitive data
- Use idempotency keys for payment operations
- Monitor for failed payments and dunning`,
            category: "Finance",
            tags: ["finance", "stripe", "payments", "billing"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "stripe-agent",
            name: "Stripe Agent",
            description: "AI agent for Stripe payment management",
            instructions: `You are a Stripe specialist. Help users manage payments, subscriptions, and billing. Always confirm destructive operations.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.2,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Stripe Agent", iconEmoji: ":credit_card:" }
            }
        }
    },
    {
        providerKey: "paypal",
        version: 1,
        skill: {
            slug: "paypal-expert",
            name: "PayPal Expert",
            description: "Expert knowledge for PayPal payment operations",
            instructions: `You are a PayPal expert. Help users manage payments, transactions, and disputes.`,
            category: "Finance",
            tags: ["finance", "paypal", "payments"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "paypal-agent",
            name: "PayPal Agent",
            description: "AI agent for PayPal management",
            instructions: `You are a PayPal specialist. Help users manage payments and transactions.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.2,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "PayPal Agent", iconEmoji: ":money_with_wings:" }
            }
        }
    },
    {
        providerKey: "square",
        version: 1,
        skill: {
            slug: "square-expert",
            name: "Square Expert",
            description: "Expert knowledge for Square payments and commerce",
            instructions: `You are a Square expert. Help users manage payments, inventory, and point-of-sale operations.`,
            category: "Finance",
            tags: ["finance", "square", "payments", "pos"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "square-agent",
            name: "Square Agent",
            description: "AI agent for Square commerce management",
            instructions: `You are a Square specialist. Help users manage payments, inventory, and commerce.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.2,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Square Agent", iconEmoji: ":package:" }
            }
        }
    },
    {
        providerKey: "plaid",
        version: 1,
        skill: {
            slug: "plaid-expert",
            name: "Plaid Expert",
            description: "Expert knowledge for Plaid financial data",
            instructions: `You are a Plaid expert. Help users access bank account data, transactions, and financial insights.`,
            category: "Finance",
            tags: ["finance", "plaid", "banking", "transactions"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "plaid-agent",
            name: "Plaid Agent",
            description: "AI agent for Plaid financial data",
            instructions: `You are a Plaid specialist. Help users access financial data and transaction insights.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.2,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Plaid Agent", iconEmoji: ":bank:" }
            }
        }
    },
    {
        providerKey: "ramp",
        version: 1,
        skill: {
            slug: "ramp-expert",
            name: "Ramp Expert",
            description: "Expert knowledge for Ramp corporate finance",
            instructions: `You are a Ramp expert. Help users manage corporate cards, expenses, and spend management.`,
            category: "Finance",
            tags: ["finance", "ramp", "expenses", "corporate-cards"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "ramp-agent",
            name: "Ramp Agent",
            description: "AI agent for Ramp spend management",
            instructions: `You are a Ramp specialist. Help users manage corporate cards and expense tracking.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.2,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Ramp Agent", iconEmoji: ":moneybag:" }
            }
        }
    }
];
