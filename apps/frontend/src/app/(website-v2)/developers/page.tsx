import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionHeader } from "@/components/website/sections/section-header";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { FeatureGrid } from "@/components/website/sections/feature-grid";
import { RelatedPages } from "@/components/website/sections/related-pages";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { StyledLink } from "@/components/website/layout/styled-link";
import {
    McpIntegrationIllustration,
    AgentConfigIllustration,
    EmbedWidgetIllustration,
    WorkflowBuilderIllustration,
    PlaybookCardIllustration,
    ObservabilityIllustration
} from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Developers — Build with AgentC2",
    description:
        "Everything you need to build, extend, and integrate AI agents. REST API, MCP integrations, Embed SDK, webhooks, custom tools, and playbook authoring.",
    path: "/developers",
    keywords: [
        "AI agent API",
        "MCP integration",
        "agent SDK",
        "developer platform",
        "AI developer tools"
    ]
});

export default function DevelopersPage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[{ label: "Home", href: "/" }, { label: "Developers" }]}
                    currentPath="/developers"
                    className="mb-8"
                />
            </SectionWrapper>

            <PageHero
                overline="Developers"
                title="Build with AgentC2. Extend everything."
                description="A complete developer platform for AI agent orchestration. Authenticate with a single API key, invoke agents over REST, connect 40+ MCP integrations, embed chat widgets, and author reusable playbooks — all from a unified control plane."
                primaryCta={{ label: "Read the Docs", href: "/docs" }}
                secondaryCta={{ label: "API Reference", href: "/developers/api" }}
            >
                <AgentConfigIllustration className="w-full max-w-md" />
            </PageHero>

            {/* Getting Started */}
            <SectionWrapper muted id="getting-started">
                <SectionHeader
                    overline="Quick Start"
                    title="Up and running in minutes"
                    description="Authenticate, invoke your first agent, and stream a response — three steps, one API key."
                />
                <div className="mt-12 grid gap-8 lg:grid-cols-2">
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-2 text-lg font-semibold">
                            1. Get your API key
                        </h3>
                        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                            Generate a key from the AgentC2 dashboard under Settings → API Keys.
                            Each key is scoped to your organization and supports role-based access.
                        </p>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs">
                            <code>{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://agentc2.ai/agent/api/agents`}</code>
                        </pre>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-2 text-lg font-semibold">
                            2. Invoke an agent
                        </h3>
                        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                            Send a message to any agent by slug. The response streams back as
                            server-sent events so your UI updates in real time.
                        </p>
                        <pre className="bg-muted/50 overflow-x-auto rounded-xl p-4 font-mono text-xs">
                            <code>{`curl -X POST \\
  https://agentc2.ai/agent/api/agents/assistant/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Summarize Q4 pipeline"}'`}</code>
                        </pre>
                    </div>
                </div>
            </SectionWrapper>

            {/* Capabilities Grid */}
            <SectionWrapper id="capabilities">
                <SectionHeader
                    overline="Capabilities"
                    title="Everything you need to build production agents"
                    description="Six pillars of developer functionality — from low-level REST endpoints to high-level playbook abstractions."
                />
                <div className="mt-12">
                    <FeatureGrid
                        columns={3}
                        features={[
                            {
                                icon: <ObservabilityIllustration className="h-auto w-full" />,
                                title: "REST API",
                                description:
                                    "Full CRUD for agents, workflows, networks, and knowledge bases. Streaming chat, tool invocation, and run history — all over standard HTTP.",
                                href: "/developers/api"
                            },
                            {
                                icon: <McpIntegrationIllustration className="h-auto w-full" />,
                                title: "MCP Integration",
                                description:
                                    "Connect any Model Context Protocol server. 40+ built-in integrations including HubSpot, Jira, Slack, Gmail, GitHub, and Google Drive.",
                                href: "/developers/mcp"
                            },
                            {
                                icon: <WorkflowBuilderIllustration className="h-auto w-full" />,
                                title: "Webhook System",
                                description:
                                    "Subscribe to agent lifecycle events — run.started, run.completed, tool.called, approval.requested. Signed payloads with retry logic."
                            },
                            {
                                icon: <EmbedWidgetIllustration className="h-auto w-full" />,
                                title: "Embed SDK",
                                description:
                                    "Drop an agent chat widget into any website with a single script tag. Fully themeable, supports custom actions, and works cross-origin."
                            },
                            {
                                icon: <AgentConfigIllustration className="h-auto w-full" />,
                                title: "Custom Tools",
                                description:
                                    "Author tools in TypeScript with Zod schemas. Register them in the tool registry and attach to any agent at runtime. Full type safety."
                            },
                            {
                                icon: <PlaybookCardIllustration className="h-auto w-full" />,
                                title: "Playbook Authoring",
                                description:
                                    "Package agents, workflows, networks, and tools into reusable playbooks. Share across organizations or publish to the marketplace."
                            }
                        ]}
                    />
                </div>
            </SectionWrapper>

            {/* Architecture Overview */}
            <SectionWrapper muted id="architecture">
                <SectionHeader
                    overline="Architecture"
                    title="Built on open standards"
                    description="AgentC2 is built on the Mastra framework — an open-source TypeScript agent runtime with first-class support for MCP, RAG, and multi-agent orchestration."
                />
                <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        {
                            label: "TypeScript Native",
                            detail: "End-to-end type safety from tool schemas to API responses"
                        },
                        {
                            label: "Database-Driven",
                            detail: "Agent configs stored in PostgreSQL — version, rollback, audit"
                        },
                        {
                            label: "Multi-Provider",
                            detail: "OpenAI, Anthropic, and any OpenAI-compatible endpoint"
                        },
                        {
                            label: "Event-Driven",
                            detail: "Inngest-powered background jobs with automatic retries"
                        }
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="border-border/60 bg-card rounded-2xl border p-6"
                        >
                            <h3 className="text-foreground mb-2 text-sm font-semibold">
                                {item.label}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {item.detail}
                            </p>
                        </div>
                    ))}
                </div>
            </SectionWrapper>

            {/* Explore Docs CTA */}
            <SectionWrapper>
                <div className="flex flex-col items-center gap-4 text-center">
                    <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                        Dive deeper
                    </h2>
                    <p className="text-muted-foreground max-w-lg text-lg">
                        Explore the full API reference, connect your first MCP server, or browse
                        integration guides.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <StyledLink href="/developers/api" size="lg">
                            API Reference
                        </StyledLink>
                        <StyledLink href="/developers/mcp" variant="outline" size="lg">
                            MCP Guide
                        </StyledLink>
                        <StyledLink href="/docs" variant="outline" size="lg">
                            Full Docs
                        </StyledLink>
                    </div>
                </div>
            </SectionWrapper>

            <CTABanner
                title="Start building with AgentC2"
                description="Create your free account, generate an API key, and deploy your first agent in under five minutes."
                primaryCta={{ label: "Get Started Free", href: "/signup" }}
                secondaryCta={{ label: "Talk to Sales", href: "/contact" }}
            />

            <SectionWrapper>
                <RelatedPages
                    title="Explore More"
                    pages={[
                        {
                            title: "API Reference",
                            description:
                                "Complete REST API documentation for agents, workflows, networks, knowledge, and MCP tools.",
                            href: "/developers/api"
                        },
                        {
                            title: "MCP Integration Guide",
                            description:
                                "Connect any MCP server, bring your own tools, and discover 40+ built-in integrations.",
                            href: "/developers/mcp"
                        },
                        {
                            title: "Use Cases",
                            description:
                                "See how Sales, Support, Engineering, and Operations teams deploy production AI agents.",
                            href: "/use-cases"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}
