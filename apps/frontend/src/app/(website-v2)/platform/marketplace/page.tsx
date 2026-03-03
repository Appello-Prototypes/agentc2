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
    PlaybookCardIllustration,
    AgentConfigIllustration,
    NetworkTopologyIllustration
} from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Playbook Marketplace — AgentC2",
    description:
        "Don't build from scratch. Deploy proven agent solutions in one click. Browse, install, and publish playbooks — pre-packaged agent configs, tools, workflows, and sample data.",
    path: "/platform/marketplace",
    keywords: [
        "AI agent marketplace",
        "agent playbooks",
        "pre-built AI agents",
        "agent templates",
        "AI marketplace"
    ]
});

export default function MarketplacePage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Platform", href: "/platform" },
                        { label: "Playbook Marketplace" }
                    ]}
                    currentPath="/platform/marketplace"
                />
            </SectionWrapper>

            <PageHero
                overline="Marketplace"
                title="Don't build from scratch. Deploy proven agent solutions in one click."
                description="The Playbook Marketplace is AgentC2's library of pre-packaged agent solutions. Each playbook bundles agent configs, tool integrations, workflows, sample data, and documentation — so you can go from zero to production in minutes instead of weeks."
                primaryCta={{ label: "Browse Playbooks", href: "/marketplace" }}
                secondaryCta={{ label: "Publish a Playbook", href: "/docs" }}
            >
                <PlaybookCardIllustration />
            </PageHero>

            {/* What is a Playbook */}
            <SectionWrapper muted>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex flex-col justify-center">
                        <SectionHeader
                            centered={false}
                            overline="Playbooks"
                            title="What Is a Playbook?"
                            description="A playbook is a complete, versioned, portable agent solution. Think of it as a Docker image for AI agents — everything needed to run is bundled inside."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Agent configuration: instructions, model, temperature, scorers
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Tool bindings: which MCP tools the agent needs
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Workflow definitions: multi-step orchestration DAGs
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Sample data and RAG documents for knowledge seeding
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Documentation, changelog, and usage examples
                            </li>
                        </ul>
                    </div>
                    <div className="flex items-center justify-center">
                        <AgentConfigIllustration />
                    </div>
                </div>
            </SectionWrapper>

            {/* How Installation Works */}
            <SectionWrapper>
                <SectionHeader
                    overline="Install"
                    title="One-Click Installation"
                    description="Installing a playbook takes seconds. AgentC2 handles dependency resolution, credential prompts, and workspace isolation automatically."
                />
                <FlowDiagram
                    className="mt-12"
                    steps={[
                        {
                            number: 1,
                            title: "Browse &amp; Select",
                            description:
                                "Search the marketplace by category, use case, or keyword. Preview the playbook&apos;s agent config, required tools, and reviews before installing."
                        },
                        {
                            number: 2,
                            title: "Configure Credentials",
                            description:
                                "If the playbook requires API keys (e.g., HubSpot, Jira), you&apos;ll be prompted to connect those integrations. Already connected? It auto-maps."
                        },
                        {
                            number: 3,
                            title: "Deploy &amp; Customise",
                            description:
                                "The playbook installs into your workspace. All agents, tools, and workflows are live immediately. Customise instructions, models, or guardrails to fit your needs."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Publishing */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Publish"
                    title="Publish Your Own Playbooks"
                    description="Built a great agent solution? Package it as a playbook and share it with the community — or sell it on the marketplace."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Version Control",
                            description:
                                "Playbooks are versioned with semantic versioning. Users can pin to specific versions or auto-update to the latest compatible release."
                        },
                        {
                            title: "Review &amp; Rating",
                            description:
                                "Community reviews and star ratings help users find the best solutions. Publishers get feedback to improve their playbooks."
                        },
                        {
                            title: "Analytics Dashboard",
                            description:
                                "Track installations, active users, retention, and revenue. Understand how your playbook is being used and where users drop off."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Monetisation */}
            <SectionWrapper>
                <SectionHeader
                    overline="Monetise"
                    title="Monetisation for Publishers"
                    description="Turn your agent expertise into recurring revenue. Set your own pricing, offer free tiers, and earn from every installation."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={2}
                    features={[
                        {
                            title: "Flexible Pricing",
                            description:
                                "Offer playbooks for free, charge a one-time fee, or set up monthly subscriptions. Bundle multiple playbooks into solution packs for volume pricing."
                        },
                        {
                            title: "Revenue Sharing",
                            description:
                                "Publishers receive 80% of revenue. AgentC2 handles billing, invoicing, and payment processing. Payouts are monthly via Stripe Connect."
                        },
                        {
                            title: "Enterprise Licensing",
                            description:
                                "Offer site-wide licenses for enterprise customers. Volume discounts, custom SLAs, and dedicated support tiers are all configurable per playbook."
                        },
                        {
                            title: "Usage-Based Billing",
                            description:
                                "Optionally charge per agent run instead of a flat fee. Great for high-volume use cases where value scales with usage."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Featured Categories */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Categories"
                    title="Featured Playbook Categories"
                    description="From sales automation to DevOps, there's a playbook for every team."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Sales &amp; Revenue",
                            description:
                                "Lead scoring, outreach automation, CRM enrichment, pipeline management, and competitive intelligence agents."
                        },
                        {
                            title: "Customer Success",
                            description:
                                "Onboarding sequences, support triage, churn prediction, upsell identification, and NPS follow-up agents."
                        },
                        {
                            title: "Engineering &amp; DevOps",
                            description:
                                "Code review, bug triage, deployment automation, incident response, and documentation generation agents."
                        },
                        {
                            title: "Marketing &amp; Content",
                            description:
                                "Content calendar planning, SEO optimisation, social media scheduling, competitor monitoring, and analytics reporting."
                        },
                        {
                            title: "HR &amp; Operations",
                            description:
                                "Candidate screening, interview scheduling, policy Q&amp;A, expense approval, and compliance checking agents."
                        },
                        {
                            title: "Finance &amp; Legal",
                            description:
                                "Invoice processing, contract review, budget forecasting, audit trail generation, and regulatory compliance agents."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Multi-Agent Solutions */}
            <SectionWrapper>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex items-center justify-center lg:order-1">
                        <NetworkTopologyIllustration />
                    </div>
                    <div className="flex flex-col justify-center lg:order-2">
                        <SectionHeader
                            centered={false}
                            overline="Networks"
                            title="Multi-Agent Playbooks"
                            description="Advanced playbooks bundle entire agent networks — multiple specialist agents that collaborate on complex tasks. Install a complete team of agents with one click."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Pre-wired agent topologies: chain, fan-out, router
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Shared memory and context passing between agents
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Configurable handoff rules and escalation paths
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Network-level guardrails and budget controls
                            </li>
                        </ul>
                    </div>
                </div>
            </SectionWrapper>

            <CTABanner
                title="Find your next agent solution"
                description="Browse the Playbook Marketplace and deploy a production-ready agent in minutes. Or publish your own and start earning."
                primaryCta={{ label: "Browse Marketplace", href: "/marketplace" }}
                secondaryCta={{ label: "Publish a Playbook", href: "/docs" }}
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
                            description: "Six steps from zero to production agents.",
                            href: "/platform/how-it-works"
                        },
                        {
                            title: "Mission Command",
                            description:
                                "Autonomous multi-step execution with military-grade planning.",
                            href: "/platform/mission-command"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}
