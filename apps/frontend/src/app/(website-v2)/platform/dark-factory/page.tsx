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
    DarkFactoryIllustration,
    EvalScorecardIllustration,
    ObservabilityIllustration
} from "@/components/website/illustrations";

export const metadata: Metadata = buildPageMetadata({
    title: "Dark Factory — AgentC2",
    description:
        "Autonomous software development. From ticket to deploy. AI agents plan, code, test, and ship — with human approval gates, risk classification, and trust scoring at every stage.",
    path: "/platform/dark-factory",
    keywords: [
        "autonomous software development",
        "AI coding agents",
        "dark factory AI",
        "automated deployment",
        "AI DevOps",
        "trust scoring"
    ]
});

export default function DarkFactoryPage() {
    return (
        <>
            <SectionWrapper>
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Platform", href: "/platform" },
                        { label: "Dark Factory" }
                    ]}
                    currentPath="/platform/dark-factory"
                />
            </SectionWrapper>

            <PageHero
                overline="Dark Factory"
                title="Autonomous software development. From ticket to deploy."
                description="The Dark Factory is AgentC2's autonomous development pipeline. AI agents receive a ticket, plan the implementation, write code, run tests, open a pull request, and deploy — all without human intervention for low-risk changes. High-risk work gets human approval gates at every stage."
                primaryCta={{ label: "Enable Dark Factory", href: "/signup" }}
                secondaryCta={{ label: "Read the Docs", href: "/docs" }}
            >
                <DarkFactoryIllustration />
            </PageHero>

            {/* Pipeline Stages */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Pipeline"
                    title="The Dark Factory Pipeline"
                    description="Six stages take a ticket from backlog to production. Each stage produces verifiable artefacts."
                />
                <FlowDiagram
                    className="mt-12"
                    steps={[
                        {
                            number: 1,
                            title: "Intake",
                            description:
                                "A ticket arrives from Jira, GitHub Issues, or the API. The intake agent classifies risk, estimates complexity, and assigns an autonomy level."
                        },
                        {
                            number: 2,
                            title: "Plan",
                            description:
                                "The planning agent reads the codebase, identifies affected files, and produces a step-by-step implementation plan with test criteria."
                        },
                        {
                            number: 3,
                            title: "Implement",
                            description:
                                "A coding agent executes the plan using Cursor Cloud. Each file change is committed atomically with descriptive messages."
                        }
                    ]}
                />
                <FlowDiagram
                    className="mt-8"
                    steps={[
                        {
                            number: 4,
                            title: "Test",
                            description:
                                "Automated test suites run against the changes. The test agent adds missing tests, fixes failures, and validates coverage thresholds."
                        },
                        {
                            number: 5,
                            title: "Review",
                            description:
                                "A code review agent checks for style, security, performance, and correctness. For high-risk changes, a human reviewer is requested."
                        },
                        {
                            number: 6,
                            title: "Deploy",
                            description:
                                "The deploy agent opens a PR, merges on approval, and monitors the rollout. Rollback triggers automatically if health checks fail."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Autonomy Levels */}
            <SectionWrapper>
                <SectionHeader
                    overline="Autonomy"
                    title="Six Autonomy Levels"
                    description="Not every change should be fully autonomous. Autonomy levels let you dial agent independence up or down based on risk, complexity, and trust."
                />
                <ComparisonTable
                    className="mt-12"
                    usLabel="Level"
                    themLabel="Description"
                    rows={[
                        {
                            feature: "Level 0 — Manual",
                            us: "Human does everything",
                            them: "Agent provides suggestions only"
                        },
                        {
                            feature: "Level 1 — Assisted",
                            us: "Agent drafts, human approves every step",
                            them: "Useful for onboarding and high-risk domains"
                        },
                        {
                            feature: "Level 2 — Supervised",
                            us: "Agent executes, human reviews before merge",
                            them: "Default for most production changes"
                        },
                        {
                            feature: "Level 3 — Monitored",
                            us: "Agent merges, human is notified",
                            them: "For trusted agents on well-tested codebases"
                        },
                        {
                            feature: "Level 4 — Autonomous",
                            us: "Agent ships without notification",
                            them: "Only for low-risk, high-confidence changes"
                        },
                        {
                            feature: "Level 5 — Dark Factory",
                            us: "Full pipeline, zero human touch",
                            them: "Reserved for mature, battle-tested agents"
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Risk Classification */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="Risk"
                    title="Risk Classification"
                    description="Every incoming ticket is classified by risk to determine the appropriate autonomy level and approval requirements."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Low Risk",
                            description:
                                "Documentation updates, dependency bumps, style fixes, and test additions. Eligible for Level 4-5 autonomy. No human approval required."
                        },
                        {
                            title: "Medium Risk",
                            description:
                                "Feature additions, refactors, and bug fixes in well-tested areas. Level 2-3 autonomy. Human review before merge."
                        },
                        {
                            title: "High Risk",
                            description:
                                "Database migrations, auth changes, payment logic, and security-sensitive code. Level 0-1 autonomy. Multi-approver workflows mandatory."
                        }
                    ]}
                />
            </SectionWrapper>

            {/* Cursor Cloud */}
            <SectionWrapper>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex flex-col justify-center">
                        <SectionHeader
                            centered={false}
                            overline="Compute"
                            title="Cursor Cloud Integration"
                            description="Dark Factory agents run on ephemeral Cursor Cloud instances — isolated compute environments with full IDE capabilities. Each task gets a fresh environment. No state leaks between runs."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Ephemeral compute: clean environment per task
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Full git integration: clone, branch, commit, push
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Language server support for type checking and linting
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Test runner integration: Jest, Vitest, Playwright
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Automatic teardown after task completion
                            </li>
                        </ul>
                    </div>
                    <div className="flex items-center justify-center">
                        <ObservabilityIllustration />
                    </div>
                </div>
            </SectionWrapper>

            {/* Trust Scoring */}
            <SectionWrapper muted>
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                    <div className="flex items-center justify-center lg:order-1">
                        <EvalScorecardIllustration />
                    </div>
                    <div className="flex flex-col justify-center lg:order-2">
                        <SectionHeader
                            centered={false}
                            overline="Trust"
                            title="Trust Scoring"
                            description="Every Dark Factory agent builds a trust score over time. Successful deployments increase trust; failures, rollbacks, and human overrides decrease it. Trust scores determine the maximum autonomy level an agent can operate at."
                        />
                        <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Historical success rate tracking
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Per-repository and per-language trust scores
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Automatic autonomy level promotion/demotion
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Trust decay for inactive agents
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5 font-bold">✓</span>
                                Manual trust overrides with audit trail
                            </li>
                        </ul>
                    </div>
                </div>
            </SectionWrapper>

            {/* Ephemeral Compute */}
            <SectionWrapper>
                <SectionHeader
                    overline="Security"
                    title="Ephemeral &amp; Isolated"
                    description="Every Dark Factory run happens in a sandboxed environment. No persistent state, no shared secrets, no cross-contamination between tasks."
                />
                <FeatureGrid
                    className="mt-12"
                    columns={3}
                    features={[
                        {
                            title: "Sandboxed Execution",
                            description:
                                "Each task runs in an isolated container with no access to other tasks, secrets, or production data unless explicitly granted."
                        },
                        {
                            title: "Scoped Credentials",
                            description:
                                "Only the credentials required for the specific task are injected. GitHub tokens are scoped to the target repository only."
                        },
                        {
                            title: "Audit Everything",
                            description:
                                "Every file change, command execution, and API call is logged with timestamps. Full replay capability for post-incident review."
                        }
                    ]}
                />
            </SectionWrapper>

            <CTABanner
                title="Ship code while you sleep"
                description="Enable Dark Factory and let your agents handle the tickets that don't need you. Start with Level 1 and promote as trust builds."
                primaryCta={{ label: "Get Started", href: "/signup" }}
                secondaryCta={{ label: "Talk to Engineering", href: "/contact" }}
            />

            <SectionWrapper>
                <RelatedPages
                    title="More Platform Pages"
                    pages={[
                        {
                            title: "Mission Command",
                            description:
                                "Autonomous multi-step execution with military-grade planning.",
                            href: "/platform/mission-command"
                        },
                        {
                            title: "Architecture",
                            description: "Open-source foundations and multi-tenant security.",
                            href: "/platform/architecture"
                        },
                        {
                            title: "Platform Overview",
                            description: "The complete AI agent operations platform at a glance.",
                            href: "/platform"
                        }
                    ]}
                />
            </SectionWrapper>
        </>
    );
}
