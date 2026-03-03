import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { PageHero } from "@/components/website/sections/page-hero";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { RelatedPages } from "@/components/website/sections/related-pages";
import {
    AgentConfigIllustration,
    ChannelDeploymentIllustration,
    ObservabilityIllustration,
    LearningPipelineIllustration,
    BudgetHierarchyIllustration
} from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "How It Works — AgentC2",
    description:
        "From zero to production agents in under an hour. Six steps: sign up, build, deploy, monitor, learn, and scale.",
    path: "/platform/how-it-works",
    keywords: [
        "AI agent setup",
        "agent deployment",
        "how to build AI agents",
        "agent operations workflow"
    ]
});

const steps = [
    {
        number: 1,
        label: "Sign Up",
        headline: "Create your workspace in 30 seconds",
        body: "Sign up with email or SSO. AgentC2 provisions a fully isolated workspace with its own database, credentials vault, and audit log. No credit card required — the free tier includes 10,000 agent runs per month.",
        Illustration: AgentConfigIllustration
    },
    {
        number: 2,
        label: "Build Your Agent",
        headline: "Define instructions, attach tools, choose a model",
        body: "Use the visual agent builder or the API to create your first agent. Write natural-language instructions, select from 200+ MCP tools (CRM, project management, web scraping, code execution), pick a model (GPT-4o, Claude, or bring your own), and configure memory, guardrails, and scorer weights.",
        Illustration: AgentConfigIllustration
    },
    {
        number: 3,
        label: "Deploy to Channels",
        headline: "One click per channel — web, Slack, WhatsApp, voice, embed",
        body: "Push your agent to any channel without writing integration code. Each channel gets unified conversation memory, consistent tool access, and the same guardrails. Add new channels later with zero re-architecture.",
        Illustration: ChannelDeploymentIllustration
    },
    {
        number: 4,
        label: "Monitor Everything",
        headline: "Real-time observability across every run",
        body: "The dashboard surfaces latency percentiles, token usage, tool call success rates, scorer results, cost per run, and error traces. Set alerts for anomalies. Drill into any conversation to see the full reasoning chain, tool inputs/outputs, and memory retrievals.",
        Illustration: ObservabilityIllustration
    },
    {
        number: 5,
        label: "Learn Automatically",
        headline: "Continuous improvement without manual tuning",
        body: "The Learning Pipeline extracts signals from production runs — low scorer results, repeated tool failures, user corrections — and generates improvement proposals. Proposals can be A/B tested in shadow mode before promotion. Human-in-the-loop approval ensures nothing ships without review.",
        Illustration: LearningPipelineIllustration
    },
    {
        number: 6,
        label: "Scale Your Fleet",
        headline: "From one agent to hundreds — same platform, same governance",
        body: "As your agent count grows, AgentC2 scales with you. Multi-agent networks handle complex workflows. Budget hierarchies enforce cost controls across teams. The Playbook Marketplace lets you package and share proven solutions across your organization — or monetise them externally.",
        Illustration: BudgetHierarchyIllustration
    }
];

export default function HowItWorksPage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Platform", href: "/platform" },
                        { label: "How It Works" }
                    ]}
                    currentPath="/platform/how-it-works"
                />
            </SectionWrapper>

            <PageHero
                overline="How It Works"
                title="From zero to production agents in under an hour"
                description="AgentC2 compresses the typical months-long AI agent development cycle into six straightforward steps. No PhD required. No infrastructure to manage. Just results."
                primaryCta={{ label: "Start Free", href: "/signup" }}
                secondaryCta={{ label: "Watch Demo", href: "/demo" }}
                centered
            />

            {steps.map((step, index) => {
                const isReversed = index % 2 === 1;
                const Illustration = step.Illustration;

                return (
                    <SectionWrapper key={step.number} muted={index % 2 === 0}>
                        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                            <div
                                className={`flex flex-col justify-center ${isReversed ? "lg:order-2" : ""}`}
                            >
                                <span className="text-primary mb-2 text-sm font-semibold tracking-wider uppercase">
                                    Step {step.number}
                                </span>
                                <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                                    {step.headline}
                                </h2>
                                <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                                    {step.body}
                                </p>
                            </div>
                            <div
                                className={`flex items-center justify-center ${isReversed ? "lg:order-1" : ""}`}
                            >
                                <Illustration />
                            </div>
                        </div>
                    </SectionWrapper>
                );
            })}

            <CTABanner
                title="See it in action"
                description="Create your free workspace and deploy your first agent today. The whole process takes less than an hour."
                primaryCta={{ label: "Get Started", href: "/signup" }}
                secondaryCta={{ label: "Book a Demo", href: "/contact" }}
            />

            <SectionWrapper>
                <RelatedPages
                    title="Keep Exploring"
                    pages={[
                        {
                            title: "Platform Overview",
                            description: "The complete AI agent operations platform at a glance.",
                            href: "/platform"
                        },
                        {
                            title: "Architecture",
                            description:
                                "Open-source foundations, multi-tenant security, and deployment options.",
                            href: "/platform/architecture"
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
