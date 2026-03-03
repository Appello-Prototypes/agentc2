import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { PageHero } from "@/components/website/sections/page-hero";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { SectionHeader } from "@/components/website/sections/section-header";
import { FeatureGrid } from "@/components/website/sections/feature-grid";
import { FlowDiagram } from "@/components/website/sections/flow-diagram";
import { ComparisonTable } from "@/components/website/sections/comparison-table";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { RelatedPages } from "@/components/website/sections/related-pages";
import {
    McpIntegrationIllustration,
    FederationIllustration,
    GuardrailPanelIllustration
} from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Architecture & Technical — AgentC2",
    description:
        "Built on proven open-source foundations, hardened for production. Explore the technology stack, multi-tenant architecture, MCP protocol, security model, and deployment options.",
    path: "/platform/architecture",
    keywords: [
        "AI agent architecture",
        "MCP protocol",
        "multi-tenant AI",
        "agent security",
        "Mastra framework",
        "AI SDK"
    ]
});

export default function ArchitecturePage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Platform", href: "/platform" },
                        { label: "Architecture" }
                    ]}
                    currentPath="/platform/architecture"
                />
            </SectionWrapper>

            <PageHero
                overline="Architecture"
                title="Built on proven open-source foundations, hardened for production"
                description="AgentC2 combines the Mastra AI framework, the Model Context Protocol (MCP), and a battle-tested Next.js stack into a single, cohesive platform. Every layer is designed for multi-tenancy, observability, and zero-downtime upgrades."
                primaryCta={{ label: "Read the Docs", href: "/docs" }}
                secondaryCta={{ label: "View on GitHub", href: "https://github.com/agentc2" }}
            >
                <FederationIllustration />
            </PageHero>

            {/* Tech Stack */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Stack"
                    title="Technology Stack"
                    description="Production-grade technologies chosen for performance, developer experience, and long-term maintainability."
                />
                <ComparisonTable
                    className="mt-12"
                    usLabel="Technology"
                    themLabel="Purpose"
                    rows={[
                        {
                            feature: "Runtime",
                            us: "Bun 1.3+",
                            them: "Fast JS runtime & package manager"
                        },
                        {
                            feature: "Framework",
                            us: "Next.js 16",
                            them: "App Router, RSC, streaming"
                        },
                        {
                            feature: "AI Framework",
                            us: "Mastra Core",
                            them: "Agent orchestration & tools"
                        },
                        {
                            feature: "Protocol",
                            us: "MCP (Model Context Protocol)",
                            them: "Standardised tool integration"
                        },
                        {
                            feature: "Database",
                            us: "PostgreSQL (Supabase)",
                            them: "Multi-tenant data & vectors"
                        },
                        { feature: "ORM", us: "Prisma 6", them: "Type-safe schema & migrations" },
                        { feature: "Auth", us: "Better Auth", them: "Session-based, SSO-ready" },
                        {
                            feature: "UI",
                            us: "shadcn/ui + Tailwind 4",
                            them: "Accessible component library"
                        },
                        {
                            feature: "Background Jobs",
                            us: "Inngest",
                            them: "Event-driven, durable functions"
                        },
                        {
                            feature: "Voice",
                            us: "ElevenLabs + OpenAI Realtime",
                            them: "Sub-second conversational AI"
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Architecture Tiers */}
            <SectionWrapper>
                <SectionHeader
                    overline="Layers"
                    title="Architecture Tiers"
                    description="Four distinct layers keep concerns separated and each tier independently scalable."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={2}
                    features={[
                        {
                            title: "Presentation Tier",
                            description:
                                "Next.js App Router with React Server Components. Streaming responses, optimistic UI, and real-time WebSocket updates for agent conversations. Deployed behind Caddy for HTTPS and cross-app cookie sharing."
                        },
                        {
                            title: "Agent Tier",
                            description:
                                "Mastra-powered agent runtime with database-driven configs, tool resolution, memory injection, and scorer evaluation. Agents are resolved at request time — no restart needed to update behaviour."
                        },
                        {
                            title: "Integration Tier",
                            description:
                                "MCP client connects to external tool servers (HubSpot, Jira, Slack, GitHub, Firecrawl, Playwright). Native OAuth flows for Gmail, Microsoft 365, and Dropbox with encrypted token storage."
                        },
                        {
                            title: "Data Tier",
                            description:
                                "PostgreSQL with pgvector for semantic search. Prisma 6 manages schema migrations. Supabase provides connection pooling, Row Level Security, and realtime subscriptions."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* MCP Architecture */}
            <SectionWrapper muted>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex flex-col justify-center">
                        <SectionHeader
                            centered={false}
                            overline="MCP"
                            title="Model Context Protocol"
                            description="MCP is the open standard that lets AI agents call external tools through a unified interface. AgentC2 implements MCP as a first-class citizen — every tool integration speaks the same protocol."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Stdio and SSE transports supported
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Per-organisation tool access control
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Schema-validated inputs and outputs (Zod)
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Dynamic tool discovery at runtime
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Bring your own MCP server in minutes
                            </li>
                        </ul>
                    </div>
                    <div className="flex items-center justify-center">
                        <McpIntegrationIllustration />
                    </div>
                </div>
            </SectionWrapper>

            {/* Multi-Tenant Architecture */}
            <SectionWrapper>
                <SectionHeader
                    overline="Multi-Tenancy"
                    title="Multi-Tenant by Design"
                    description="Every workspace is fully isolated. Data, credentials, agent configs, and audit logs never cross tenant boundaries."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Workspace Isolation",
                            description:
                                "Each organisation gets its own logical partition. Database rows, MCP credentials, and agent configs are scoped by org ID with enforced foreign keys."
                        },
                        {
                            title: "Credential Vault",
                            description:
                                "OAuth tokens and API keys are encrypted at rest with AES-256-GCM. Tokens are refreshed automatically. No plaintext secrets ever touch the database."
                        },
                        {
                            title: "Audit Trail",
                            description:
                                "Every agent run, tool call, and config change is logged with timestamps, user IDs, and input/output hashes. Queryable via API and dashboard."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Security */}
            <SectionWrapper muted>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex items-center justify-center lg:order-1">
                        <GuardrailPanelIllustration />
                    </div>
                    <div className="flex flex-col justify-center lg:order-2">
                        <SectionHeader
                            centered={false}
                            overline="Security"
                            title="Enterprise-Grade Security"
                            description="AgentC2 is built for regulated industries. Guardrails, budget caps, and human approval gates ensure agents operate within defined boundaries."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Guardrail rules: topic restrictions, PII filtering, output
                                validation
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Token and cost budget caps per agent, per team, per org
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Human-in-the-loop approval workflows for high-risk actions
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Role-based access control (RBAC) across workspaces
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                SOC 2-aligned logging and data retention policies
                            </li>
                        </ul>
                    </div>
                </div>
            </SectionWrapper>

            {/* Deployment Architecture */}
            <SectionWrapper>
                <SectionHeader
                    overline="Deployment"
                    title="Deployment Architecture"
                    description="AgentC2 runs as a persistent Next.js server — not serverless, not edge. This gives you long-lived WebSocket connections, in-process MCP clients, and predictable cold-start times."
                />
                <FlowDiagram
                    className="mt-12"
                    steps={[
                        {
                            number: 1,
                            title: "Caddy Reverse Proxy",
                            description:
                                "Automatic TLS, HTTP/2, cross-app cookie sharing, and load balancing across application instances."
                        },
                        {
                            number: 2,
                            title: "Next.js Application",
                            description:
                                "Bun runtime, App Router with RSC, API routes for agent interactions, Inngest webhook handler, and MCP endpoint."
                        },
                        {
                            number: 3,
                            title: "PostgreSQL + pgvector",
                            description:
                                "Supabase-managed PostgreSQL with vector extensions for semantic search, Prisma migrations, and realtime subscriptions."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* API Overview */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="API"
                    title="API Overview"
                    description="Every platform capability is available through a RESTful API. Build custom integrations, trigger workflows from external systems, or embed agent conversations in your own products."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Agent API",
                            description:
                                "Create, update, and invoke agents. Stream responses. Manage memory and conversation threads programmatically."
                        },
                        {
                            title: "Tool API",
                            description:
                                "List available MCP tools, execute tools directly, and register custom tool servers with schema validation."
                        },
                        {
                            title: "Workflow API",
                            description:
                                "Trigger workflows, poll for status, resume human-approval steps, and retrieve run artifacts."
                        },
                        {
                            title: "RAG API",
                            description:
                                "Ingest documents, query the knowledge base with semantic search, and manage vector collections."
                        },
                        {
                            title: "Webhook API",
                            description:
                                "Register webhooks for agent events, tool completions, workflow state changes, and learning proposals."
                        },
                        {
                            title: "Admin API",
                            description:
                                "Manage users, roles, workspaces, billing, and platform-wide configuration. RBAC-protected."
                        }
                    ]}
                />
            </SectionWrapper>

            <CTABanner
                title="Ready to dive deeper?"
                description="Explore the full API documentation or spin up a local instance to see the architecture first-hand."
                primaryCta={{ label: "Read the Docs", href: "/docs" }}
                secondaryCta={{ label: "Start Free", href: "/signup" }}
            />

            <SectionWrapper>
                <RelatedPages
                    title="More Platform Pages"
                    pages={[
                        {
                            title: "Platform Overview",
                            description: "The complete AI agent operations platform at a glance.",
                            href: "/platform"
                        },
                        {
                            title: "How It Works",
                            description: "From zero to production agents in six simple steps.",
                            href: "/platform/how-it-works"
                        },
                        {
                            title: "Channels & Voice",
                            description: "Deploy once, reach every channel your customers use.",
                            href: "/platform/channels"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}
