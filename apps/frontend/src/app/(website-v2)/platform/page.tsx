import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { PageHero } from "@/components/website/sections/page-hero";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { SectionHeader } from "@/components/website/sections/section-header";
import { FeatureGrid } from "@/components/website/sections/feature-grid";
import { FlowDiagram } from "@/components/website/sections/flow-diagram";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { RelatedPages } from "@/components/website/sections/related-pages";
import {
    NetworkTopologyIllustration,
    McpIntegrationIllustration,
    AgentChatIllustration,
    WorkflowBuilderIllustration
} from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Platform Overview — AgentC2",
    description:
        "The complete AI agent operations platform. Build, deploy, and govern production AI agents with workflows, guardrails, multi-channel delivery, and a playbook marketplace.",
    path: "/platform",
    keywords: [
        "AI agent platform",
        "agent operations",
        "AI orchestration",
        "multi-channel AI",
        "agent lifecycle"
    ]
});

export default function PlatformOverviewPage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[{ label: "Home", href: "/" }, { label: "Platform" }]}
                    currentPath="/platform"
                />
            </SectionWrapper>

            <PageHero
                overline="Platform"
                title="The complete AI agent operations platform"
                description="AgentC2 gives your team everything it needs to build, deploy, govern, and continuously improve AI agents — across every channel your customers use. One platform. Full lifecycle. Zero duct tape."
                primaryCta={{ label: "Start Building Free", href: "/signup" }}
                secondaryCta={{ label: "See How It Works", href: "/platform/how-it-works" }}
            >
                <NetworkTopologyIllustration />
            </PageHero>

            {/* Agent Lifecycle */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Lifecycle"
                    title="The Agent Lifecycle"
                    description="Six continuous stages turn a rough idea into a battle-tested, self-improving agent fleet."
                />
                <FlowDiagram
                    className="mt-12"
                    steps={[
                        {
                            number: 1,
                            title: "Build",
                            description:
                                "Define agent instructions, attach tools, choose a model, and wire up memory — all from the dashboard or API."
                        },
                        {
                            number: 2,
                            title: "Configure",
                            description:
                                "Set guardrails, temperature, token budgets, scorer weights, and playbook overrides without redeploying."
                        },
                        {
                            number: 3,
                            title: "Deploy",
                            description:
                                "Push to web chat, Slack, WhatsApp, Telegram, voice, email, or embed — one click per channel."
                        }
                    ]}
                />
                <FlowDiagram
                    className="mt-8"
                    steps={[
                        {
                            number: 4,
                            title: "Monitor",
                            description:
                                "Real-time observability across every run: latency, token usage, tool calls, scorer results, and cost."
                        },
                        {
                            number: 5,
                            title: "Learn",
                            description:
                                "Automated signal extraction, proposal generation, and A/B experiments surface improvements continuously."
                        },
                        {
                            number: 6,
                            title: "Improve",
                            description:
                                "Approved proposals are promoted to production. The cycle repeats — agents get better every day."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Core Primitives */}
            <SectionWrapper>
                <SectionHeader
                    overline="Primitives"
                    title="Six Core Primitives"
                    description="AgentC2 organises work into composable building blocks that mirror how real teams operate."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Agents",
                            description:
                                "Database-driven, version-controlled agent configs with instructions, model selection, temperature, memory, and scorer weights. Swap models or prompts without code changes.",
                            href: "/platform/how-it-works"
                        },
                        {
                            title: "Skills (MCP Tools)",
                            description:
                                "200+ pre-built MCP tool integrations — HubSpot, Jira, Slack, Google Drive, GitHub, Firecrawl, Playwright, and more. Add custom tools in minutes.",
                            href: "/platform/architecture"
                        },
                        {
                            title: "Workflows",
                            description:
                                "Multi-step DAGs with branching, human-in-the-loop approval gates, retry policies, and parallel execution. Visual builder included."
                        },
                        {
                            title: "Networks",
                            description:
                                "Multi-agent topologies — sequential chains, parallel fan-out, router-based dispatch, or full mesh collaboration between specialist agents."
                        },
                        {
                            title: "Campaigns",
                            description:
                                "Mission Command-style planning: campaigns break into missions, missions into tasks. Budget enforcement and after-action reviews are built in.",
                            href: "/platform/mission-command"
                        },
                        {
                            title: "Playbooks",
                            description:
                                "Pre-packaged agent solutions — agent config, tools, workflows, and sample data — installable in one click from the marketplace.",
                            href: "/platform/marketplace"
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Model Flexibility */}
            <SectionWrapper muted>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex flex-col justify-center">
                        <SectionHeader
                            centered={false}
                            overline="Models"
                            title="Model Flexibility"
                            description="Run OpenAI GPT-4o, Anthropic Claude, or any AI SDK-compatible provider. Switch models per-agent, per-environment, or per-request — no vendor lock-in, ever."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Per-agent model and temperature overrides
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Streaming and non-streaming responses
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Token-level cost tracking and budget caps
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Hot-swap providers without redeployment
                            </li>
                        </ul>
                    </div>
                    <div className="flex items-center justify-center">
                        <McpIntegrationIllustration />
                    </div>
                </div>
            </SectionWrapper>

            {/* Memory & Knowledge */}
            <SectionWrapper>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex items-center justify-center lg:order-1">
                        <AgentChatIllustration />
                    </div>
                    <div className="flex flex-col justify-center lg:order-2">
                        <SectionHeader
                            centered={false}
                            overline="Memory"
                            title="Memory &amp; Knowledge"
                            description="Agents remember previous conversations, recall relevant facts with semantic search, and ingest documents through the RAG pipeline — so every interaction gets smarter."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Conversation memory per-thread and per-user
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Semantic recall via pgvector embeddings
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                RAG ingestion: PDF, Markdown, HTML, plain text
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Configurable context window and token limits
                            </li>
                        </ul>
                    </div>
                </div>
            </SectionWrapper>

            {/* Voice & Background Processing */}
            <SectionWrapper muted>
                <div className="grid gap-16 md:grid-cols-2">
                    <div>
                        <SectionHeader
                            centered={false}
                            overline="Voice"
                            title="Voice Capabilities"
                            description="Deploy voice agents powered by ElevenLabs and OpenAI Realtime. Agents can answer phone calls, join meetings, and handle support — all with sub-second latency."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                ElevenLabs conversational agents with MCP tools
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                OpenAI Realtime API for low-latency voice
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Custom voice cloning and persona selection
                            </li>
                        </ul>
                    </div>
                    <div>
                        <SectionHeader
                            centered={false}
                            overline="Background Jobs"
                            title="Background Processing"
                            description="Long-running tasks — document ingestion, learning sessions, campaign execution — run in the background via Inngest so agents never block on heavy work."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Event-driven job orchestration with Inngest
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Automatic retries and dead-letter queues
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Real-time progress tracking in the dashboard
                            </li>
                        </ul>
                    </div>
                </div>
            </SectionWrapper>

            {/* Workflow Builder */}
            <SectionWrapper>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex flex-col justify-center">
                        <SectionHeader
                            centered={false}
                            overline="Orchestration"
                            title="Visual Workflow Builder"
                            description="Design multi-step agent workflows with branching logic, parallel execution, human-in-the-loop gates, and error handling — then deploy them as API endpoints or scheduled jobs."
                        />
                    </div>
                    <div className="flex items-center justify-center">
                        <WorkflowBuilderIllustration />
                    </div>
                </div>
            </SectionWrapper>

            <CTABanner
                title="Ready to build your first agent?"
                description="Create a free account and deploy a production agent in under an hour. No credit card required."
                primaryCta={{ label: "Start Free", href: "/signup" }}
                secondaryCta={{ label: "Talk to Sales", href: "/contact" }}
            />

            <SectionWrapper>
                <RelatedPages
                    title="Explore the Platform"
                    pages={[
                        {
                            title: "How It Works",
                            description: "From zero to production agents in six simple steps.",
                            href: "/platform/how-it-works"
                        },
                        {
                            title: "Architecture",
                            description:
                                "Open-source foundations, multi-tenant security, and deployment options.",
                            href: "/platform/architecture"
                        },
                        {
                            title: "Channels & Voice",
                            description:
                                "Deploy once, reach every channel — web, Slack, WhatsApp, voice, and more.",
                            href: "/platform/channels"
                        },
                        {
                            title: "Mission Command",
                            description:
                                "Autonomous multi-step execution with military-grade planning.",
                            href: "/platform/mission-command"
                        },
                        {
                            title: "Dark Factory",
                            description: "Autonomous software development from ticket to deploy.",
                            href: "/platform/dark-factory"
                        },
                        {
                            title: "Playbook Marketplace",
                            description: "Deploy proven agent solutions in one click.",
                            href: "/platform/marketplace"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}
