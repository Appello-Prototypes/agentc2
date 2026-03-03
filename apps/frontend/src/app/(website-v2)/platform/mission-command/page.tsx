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
    CampaignIllustration,
    BudgetHierarchyIllustration,
    EvalScorecardIllustration
} from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Mission Command — AgentC2",
    description:
        "Autonomous multi-step execution with military-grade planning. Campaigns break into missions, missions into tasks — with budget enforcement, human approval gates, and after-action reviews.",
    path: "/platform/mission-command",
    keywords: [
        "AI agent campaigns",
        "mission command AI",
        "autonomous execution",
        "agent task planning",
        "budget enforcement AI"
    ]
});

export default function MissionCommandPage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Platform", href: "/platform" },
                        { label: "Mission Command" }
                    ]}
                    currentPath="/platform/mission-command"
                />
            </SectionWrapper>

            <PageHero
                overline="Mission Command"
                title="Autonomous multi-step execution with military-grade planning"
                description="Inspired by military doctrine, Mission Command gives your agents the ability to decompose complex objectives into structured campaigns, missions, and tasks — then execute them autonomously while respecting budgets, approval gates, and risk boundaries."
                primaryCta={{ label: "Start a Campaign", href: "/signup" }}
                secondaryCta={{ label: "Learn More", href: "/docs" }}
            >
                <CampaignIllustration />
            </PageHero>

            {/* Hierarchy */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Structure"
                    title="Campaign → Mission → Task"
                    description="Three levels of abstraction let you express high-level business objectives and let agents figure out the details."
                />
                <FlowDiagram
                    className="mt-12"
                    steps={[
                        {
                            number: 1,
                            title: "Campaign",
                            description:
                                'The top-level objective. "Generate 50 qualified leads this quarter" or "Migrate all legacy APIs to v3." Campaigns define the intent, budget ceiling, and success criteria.'
                        },
                        {
                            number: 2,
                            title: "Mission",
                            description:
                                "A self-contained unit of work within a campaign. Each mission has its own agent assignment, tool access list, budget allocation, and approval requirements."
                        },
                        {
                            number: 3,
                            title: "Task",
                            description:
                                "The atomic unit of execution. A single tool call, API request, or decision point. Tasks produce artefacts that feed downstream missions."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Execution Flow */}
            <SectionWrapper>
                <SectionHeader
                    overline="Execution"
                    title="How Execution Works"
                    description="Campaigns are planned, approved, executed, and reviewed in a continuous loop."
                />
                <div className="mt-12 grid gap-8 md:grid-cols-2">
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-3 text-lg font-semibold">
                            1. Planning Phase
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            The campaign agent receives a high-level objective and decomposes it
                            into missions. Each mission is assigned an agent, tools, and a budget
                            slice. The plan is presented for human approval before any execution
                            begins.
                        </p>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-3 text-lg font-semibold">
                            2. Approval Gate
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Reviewers approve, modify, or reject the plan. Approval can be
                            all-or-nothing or per-mission. High-risk missions can require multiple
                            approvers. Once approved, execution begins automatically.
                        </p>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-3 text-lg font-semibold">
                            3. Autonomous Execution
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Agents execute missions in parallel or sequentially based on dependency
                            graphs. Budget is tracked in real time. If a mission exceeds its
                            allocation, it pauses and requests additional budget or human guidance.
                        </p>
                    </div>
                    <div className="border-border/60 bg-card rounded-2xl border p-6">
                        <h3 className="text-foreground mb-3 text-lg font-semibold">
                            4. After-Action Review
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Every completed campaign generates an AAR: what worked, what
                            didn&apos;t, token usage vs. budget, tool success rates, and scorer
                            outcomes. AARs feed into the Learning Pipeline for continuous
                            improvement.
                        </p>
                    </div>
                </div>
            </SectionWrapper>

            {/* Key Features */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Features"
                    title="Key Capabilities"
                    description="Mission Command is not just a task runner — it's a governance framework for autonomous agent operations."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Intent-Based Planning",
                            description:
                                "Describe what you want achieved, not how. The campaign agent decomposes objectives into executable missions using its domain knowledge and tool awareness."
                        },
                        {
                            title: "Budget Enforcement",
                            description:
                                "Set token and cost ceilings at the campaign, mission, and task level. Real-time tracking prevents overruns. Alerts fire when thresholds approach."
                        },
                        {
                            title: "Human Approval Gates",
                            description:
                                "Configure which missions require human sign-off before execution. Support for multi-approver workflows with escalation timeouts."
                        },
                        {
                            title: "After-Action Reviews",
                            description:
                                "Structured post-execution reports capture outcomes, failures, budget utilisation, and improvement opportunities. Queryable via API."
                        },
                        {
                            title: "Dependency Graphs",
                            description:
                                "Missions can declare dependencies on other missions. The scheduler respects ordering while maximising parallelism where possible."
                        },
                        {
                            title: "Risk Classification",
                            description:
                                "Tag missions as low, medium, or high risk. Risk level determines approval requirements, budget limits, and monitoring intensity."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Budget Hierarchy */}
            <SectionWrapper>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex flex-col justify-center">
                        <SectionHeader
                            centered={false}
                            overline="Budgets"
                            title="Hierarchical Budget Control"
                            description="Budgets cascade from organisation to team to campaign to mission. Every level can set caps, and overruns at any level trigger alerts and pause execution."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Organisation-level monthly cost ceilings
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Team-level budget pools with rollover options
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Per-campaign and per-mission token allocations
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Real-time spend dashboards and threshold alerts
                            </li>
                        </ul>
                    </div>
                    <div className="flex items-center justify-center">
                        <BudgetHierarchyIllustration />
                    </div>
                </div>
            </SectionWrapper>

            {/* Use Cases */}
            <SectionWrapper muted>
                <SectionHeader overline="Use Cases" title="What Teams Build with Mission Command" />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Lead Generation Campaigns",
                            description:
                                "Research prospects, enrich CRM records, draft outreach sequences, and score responses — all orchestrated as a single campaign with budget controls."
                        },
                        {
                            title: "Compliance Audits",
                            description:
                                "Scan documents, extract policy violations, generate remediation tickets, and track resolution. Human approval required before any external communication."
                        },
                        {
                            title: "Content Production",
                            description:
                                "Plan an editorial calendar, research topics, draft articles, generate social media variants, and schedule publication across platforms."
                        },
                        {
                            title: "API Migrations",
                            description:
                                "Catalogue legacy endpoints, generate migration plans, write adapter code, run test suites, and deploy — with rollback gates at every stage."
                        },
                        {
                            title: "Customer Onboarding",
                            description:
                                "Welcome sequences, data collection, account setup, training material delivery, and check-in scheduling — fully automated with human escalation."
                        },
                        {
                            title: "Competitive Intelligence",
                            description:
                                "Monitor competitor websites, extract pricing changes, summarise product updates, and deliver weekly briefings to leadership."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Eval */}
            <SectionWrapper>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex items-center justify-center lg:order-1">
                        <EvalScorecardIllustration />
                    </div>
                    <div className="flex flex-col justify-center lg:order-2">
                        <SectionHeader
                            centered={false}
                            overline="Evaluation"
                            title="Built-In Scoring &amp; Evaluation"
                            description="Every mission run is scored against configurable metrics — relevance, accuracy, helpfulness, and custom domain scorers. Results feed directly into after-action reviews."
                        />
                    </div>
                </div>
            </SectionWrapper>

            <CTABanner
                title="Put your agents on a mission"
                description="Start your first campaign today. Define the objective, set a budget, and let your agents execute."
                primaryCta={{ label: "Start Free", href: "/signup" }}
                secondaryCta={{ label: "See a Demo", href: "/contact" }}
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
