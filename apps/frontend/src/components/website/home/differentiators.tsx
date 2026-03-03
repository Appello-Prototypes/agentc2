import Link from "next/link";
import {
    FederationIllustration,
    CampaignIllustration,
    PlaybookCardIllustration
} from "@/components/website/illustrations";

const CARDS = [
    {
        illustration: FederationIllustration,
        title: "Federation — Agents That Cross Organizational Boundaries",
        body: "The only platform with cross-organization agent collaboration. Establish encrypted channels between organizations, expose agents with fine-grained controls, and discover partner agents via agent cards.",
        cta: "Learn about Federation →",
        href: "/platform/federation"
    },
    {
        illustration: CampaignIllustration,
        title: "Mission Command — Autonomous Campaign Execution",
        body: "Define intent and end state. AgentC2 decomposes into missions, assigns agents, executes tasks, and generates After Action Reviews — all with human approval gates where you need them.",
        cta: "Learn about Mission Command →",
        href: "/platform/mission-command"
    },
    {
        illustration: PlaybookCardIllustration,
        title: "Playbook Marketplace — Deploy Proven Solutions",
        body: "Install complete agent solutions — agents, skills, workflows, networks, guardrails, and test cases — in one click. Customize for your organization, or publish and monetize your own solutions.",
        cta: "Explore the Marketplace →",
        href: "/platform/marketplace"
    }
];

export function Differentiators() {
    return (
        <section className="bg-muted/30 py-24">
            <div className="mx-auto max-w-7xl px-6">
                <div className="text-center">
                    <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                        ONLY ON AGENTC2
                    </span>
                    <h2 className="text-foreground mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                        Capabilities no other platform offers
                    </h2>
                </div>

                <div className="mt-16 grid gap-8 lg:grid-cols-3">
                    {CARDS.map(({ illustration: Illustration, title, body, cta, href }) => (
                        <div
                            key={href}
                            className="border-border/60 bg-card overflow-hidden rounded-2xl border"
                        >
                            <div className="border-border/40 bg-muted/20 border-b p-4">
                                <Illustration className="w-full" />
                            </div>
                            <div className="p-6">
                                <h3 className="text-foreground mb-3 text-lg font-semibold">
                                    {title}
                                </h3>
                                <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                                    {body}
                                </p>
                                <Link
                                    href={href}
                                    className="text-primary text-sm font-medium hover:underline"
                                >
                                    {cta}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
