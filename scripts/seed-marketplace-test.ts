/**
 * Seed script for Playbook Marketplace end-to-end testing (Phase 8)
 *
 * Creates:
 * 1. Org A (Publisher) — builds and publishes the Customer Support multi-agent playbook
 * 2. Org B (Buyer) — purchases and deploys the playbook
 *
 * Usage: bun run scripts/seed-marketplace-test.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🏗️  Seeding marketplace test data...\n");

    // ─── Org A: Publisher ───────────────────────────────────────────────

    let orgA = await prisma.organization.findUnique({ where: { slug: "publisher-org-a" } });
    if (!orgA) {
        orgA = await prisma.organization.create({
            data: {
                name: "Publisher Org A",
                slug: "publisher-org-a",
                status: "active"
            }
        });
        console.log("✅ Created Org A (Publisher):", orgA.id);
    } else {
        console.log("⏩ Org A already exists:", orgA.id);
    }

    let workspaceA = await prisma.workspace.findFirst({
        where: { organizationId: orgA.id, slug: "default" }
    });
    if (!workspaceA) {
        workspaceA = await prisma.workspace.create({
            data: {
                organizationId: orgA.id,
                name: "Default",
                slug: "default",
                isDefault: true,
                environment: "production"
            }
        });
        console.log("✅ Created Workspace A:", workspaceA.id);
    }

    // Create Router Agent
    const routerAgent = await prisma.agent.upsert({
        where: { workspaceId_slug: { workspaceId: workspaceA.id, slug: "support-router" } },
        create: {
            slug: "support-router",
            name: "Router Agent",
            description: "Routes customer inquiries to the appropriate specialist agent",
            instructions: `You are a customer support router. When a customer contacts you:
1. Greet them warmly
2. Listen to their issue
3. Classify it as: billing, technical, account, general, complaint, or urgent
4. Route to the FAQ Agent for standard queries (billing, technical, account, general)
5. Route to the Escalation Agent for complex issues (complaint, urgent)
Always be professional and empathetic.`,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.3,
            memoryEnabled: true,
            memoryConfig: { lastMessages: 10 },
            maxSteps: 3,
            workspaceId: workspaceA.id,
            type: "USER",
            visibility: "ORGANIZATION"
        },
        update: {}
    });
    console.log("✅ Router Agent:", routerAgent.id);

    // Create FAQ Agent
    const faqAgent = await prisma.agent.upsert({
        where: { workspaceId_slug: { workspaceId: workspaceA.id, slug: "support-faq" } },
        create: {
            slug: "support-faq",
            name: "FAQ Agent",
            description: "Answers customer questions using the knowledge base",
            instructions: `You are a customer support FAQ specialist. Your role:
1. Search the knowledge base for relevant answers
2. Provide accurate, cited responses
3. If you're not confident in your answer (confidence < 70%), hand off to the Escalation Agent
4. Never make up information — only answer based on available knowledge
5. Always cite your sources when answering`,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.2,
            memoryEnabled: true,
            memoryConfig: { lastMessages: 10 },
            maxSteps: 5,
            workspaceId: workspaceA.id,
            type: "USER",
            visibility: "ORGANIZATION"
        },
        update: {}
    });
    console.log("✅ FAQ Agent:", faqAgent.id);

    // Create Escalation Agent
    const escalationAgent = await prisma.agent.upsert({
        where: { workspaceId_slug: { workspaceId: workspaceA.id, slug: "support-escalation" } },
        create: {
            slug: "support-escalation",
            name: "Escalation Agent",
            description: "Handles complex issues requiring human judgment",
            instructions: `You are a customer support escalation specialist. Your role:
1. Handle complex issues that the FAQ Agent couldn't resolve
2. Attempt resolution using available knowledge
3. If the issue requires human intervention, create an approval request
4. Once a human provides guidance, deliver the resolution to the customer
5. Route to the FAQ Agent for follow-up questions after resolution`,
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.3,
            memoryEnabled: true,
            memoryConfig: { lastMessages: 15 },
            maxSteps: 5,
            workspaceId: workspaceA.id,
            type: "USER",
            visibility: "ORGANIZATION"
        },
        update: {}
    });
    console.log("✅ Escalation Agent:", escalationAgent.id);

    // Create Network
    const network = await prisma.network.upsert({
        where: { slug: "customer-support-network" },
        create: {
            slug: "customer-support-network",
            name: "Customer Support Network",
            description: "Multi-agent support network with smart routing",
            instructions:
                "Route messages based on issue classification. Standard queries go to FAQ Agent, complex/urgent issues go to Escalation Agent.",
            modelProvider: "anthropic",
            modelName: "claude-sonnet-4-20250514",
            temperature: 0.3,
            topologyJson: {
                nodes: [
                    {
                        id: "router",
                        type: "agent",
                        agentSlug: "support-router",
                        position: { x: 250, y: 50 }
                    },
                    {
                        id: "faq",
                        type: "agent",
                        agentSlug: "support-faq",
                        position: { x: 100, y: 250 }
                    },
                    {
                        id: "escalation",
                        type: "agent",
                        agentSlug: "support-escalation",
                        position: { x: 400, y: 250 }
                    }
                ],
                edges: [
                    { source: "router", target: "faq", label: "billing, account, general" },
                    { source: "router", target: "escalation", label: "complex, complaint, urgent" },
                    { source: "escalation", target: "faq", label: "follow-up" }
                ]
            },
            memoryConfig: { lastMessages: 20, semanticRecall: false },
            maxSteps: 10,
            workspaceId: workspaceA.id,
            isPublished: true,
            type: "USER"
        },
        update: {}
    });
    console.log("✅ Network:", network.id);

    // Create network primitives
    for (const prim of [
        { agentId: routerAgent.id, type: "agent", desc: "Entry point — classifies and routes" },
        { agentId: faqAgent.id, type: "agent", desc: "Handles standard queries" },
        { agentId: escalationAgent.id, type: "agent", desc: "Handles complex issues" }
    ]) {
        await prisma.networkPrimitive.upsert({
            where: { networkId_agentId: { networkId: network.id, agentId: prim.agentId } },
            create: {
                networkId: network.id,
                primitiveType: prim.type,
                agentId: prim.agentId,
                description: prim.desc
            },
            update: {}
        });
    }

    // Create knowledge base documents
    const docs = [
        {
            slug: "support-billing-faq",
            name: "Billing FAQ",
            content: `# Billing FAQ\n\n## How do I update my payment method?\nGo to Settings > Billing > Payment Methods and click "Update".\n\n## What payment methods do you accept?\nWe accept Visa, Mastercard, American Express, and bank transfers.\n\n## How do I get an invoice?\nInvoices are automatically generated and available in Settings > Billing > Invoices.\n\n## Can I get a refund?\nRefunds are available within 14 days of purchase. Contact support for assistance.`
        },
        {
            slug: "support-account-faq",
            name: "Account FAQ",
            content: `# Account FAQ\n\n## How do I reset my password?\nClick "Forgot Password" on the login page and follow the email instructions.\n\n## How do I change my email?\nGo to Settings > Account > Email and click "Change Email".\n\n## How do I delete my account?\nGo to Settings > Account > Delete Account. This action is irreversible.\n\n## How do I enable two-factor authentication?\nGo to Settings > Security > Two-Factor Authentication and follow the setup wizard.`
        },
        {
            slug: "support-troubleshooting",
            name: "Troubleshooting Guide",
            content: `# Troubleshooting Guide\n\n## The app won't load\n1. Clear your browser cache\n2. Try a different browser\n3. Check our status page at status.example.com\n\n## I can't connect my integration\n1. Verify your API key is correct\n2. Check that the integration service is not down\n3. Try disconnecting and reconnecting\n\n## Slow performance\n1. Check your internet connection\n2. Reduce the number of concurrent operations\n3. Contact support if the issue persists`
        }
    ];

    for (const doc of docs) {
        await prisma.document.upsert({
            where: { slug: doc.slug },
            create: {
                ...doc,
                contentType: "markdown",
                category: "Support",
                tags: ["support", "faq"],
                workspaceId: workspaceA.id,
                organizationId: orgA.id
            },
            update: {}
        });
    }
    console.log("✅ Created 3 knowledge base documents");

    // Create test cases for agents
    const testCases = [
        {
            agentId: routerAgent.id,
            name: "Route billing question",
            inputText: "I need help with my invoice",
            expectedOutput: null,
            tags: ["routing", "billing"]
        },
        {
            agentId: routerAgent.id,
            name: "Route complaint",
            inputText: "I'm very upset about the service quality",
            expectedOutput: null,
            tags: ["routing", "complaint"]
        },
        {
            agentId: faqAgent.id,
            name: "Answer password reset",
            inputText: "How do I reset my password?",
            expectedOutput: "Click Forgot Password on the login page",
            tags: ["faq", "account"]
        },
        {
            agentId: faqAgent.id,
            name: "Answer payment methods",
            inputText: "What payment methods do you accept?",
            expectedOutput: "Visa, Mastercard, American Express, and bank transfers",
            tags: ["faq", "billing"]
        },
        {
            agentId: escalationAgent.id,
            name: "Handle complex complaint",
            inputText: "I've been waiting 3 days for a response and my business is losing money",
            expectedOutput: null,
            tags: ["escalation", "urgent"]
        }
    ];

    for (const tc of testCases) {
        const existing = await prisma.agentTestCase.findFirst({
            where: { agentId: tc.agentId, name: tc.name }
        });
        if (!existing) {
            await prisma.agentTestCase.create({ data: tc });
        }
    }
    console.log("✅ Created 5 test cases");

    // Create guardrail policies
    for (const agent of [routerAgent, faqAgent, escalationAgent]) {
        await prisma.guardrailPolicy.upsert({
            where: { agentId: agent.id },
            create: {
                agentId: agent.id,
                configJson: {
                    input: {
                        filters: [{ type: "pii", action: "redact" }]
                    },
                    output: {
                        filters: [
                            { type: "tone", action: "enforce", config: { tone: "professional" } },
                            { type: "hallucination", action: "block" }
                        ]
                    }
                }
            },
            update: {}
        });
    }
    console.log("✅ Created guardrail policies for all 3 agents");

    // ─── Org B: Buyer ───────────────────────────────────────────────────

    let orgB = await prisma.organization.findUnique({ where: { slug: "buyer-org-b" } });
    if (!orgB) {
        orgB = await prisma.organization.create({
            data: {
                name: "Buyer Org B",
                slug: "buyer-org-b",
                status: "active"
            }
        });
        console.log("\n✅ Created Org B (Buyer):", orgB.id);
    } else {
        console.log("\n⏩ Org B already exists:", orgB.id);
    }

    let workspaceB = await prisma.workspace.findFirst({
        where: { organizationId: orgB.id, slug: "default" }
    });
    if (!workspaceB) {
        workspaceB = await prisma.workspace.create({
            data: {
                organizationId: orgB.id,
                name: "Default",
                slug: "default",
                isDefault: true,
                environment: "production"
            }
        });
        console.log("✅ Created Workspace B:", workspaceB.id);
    }

    console.log("\n📋 Summary:");
    console.log("  Org A (Publisher):", orgA.id);
    console.log("  Workspace A:", workspaceA.id);
    console.log("  Router Agent:", routerAgent.id);
    console.log("  FAQ Agent:", faqAgent.id);
    console.log("  Escalation Agent:", escalationAgent.id);
    console.log("  Network:", network.id);
    console.log("  Org B (Buyer):", orgB.id);
    console.log("  Workspace B:", workspaceB.id);
    console.log("\n✅ Marketplace test data seeded successfully!");
    console.log("\nNext steps:");
    console.log("  1. Package the network into a playbook from Org A");
    console.log("  2. Publish the playbook");
    console.log("  3. Browse marketplace as Org B");
    console.log("  4. Purchase and deploy the playbook");
    console.log("  5. Verify 3 agents + network created in Org B workspace");
    console.log("  6. Submit a review from Org B");
}

main()
    .catch((error) => {
        console.error("❌ Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
