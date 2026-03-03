import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { useCaseCards } from "@/data/website/use-cases";

export const metadata: Metadata = buildPageMetadata({
    title: "Use Cases — AgentC2 for Every Team",
    description:
        "Discover how Sales, Support, Engineering, Operations, Construction, and Partner Networks use AgentC2 to deploy production AI agents.",
    path: "/use-cases",
    keywords: ["AI agent use cases", "enterprise AI", "agent automation"]
});

export default function UseCasesPage() {
    return (
        <>
            <PageHero
                overline="Use Cases"
                title="AI agents for every team"
                description="From sales pipeline automation to autonomous engineering — see how teams deploy AgentC2 agents to transform their workflows."
                centered
            />

            <SectionWrapper>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {useCaseCards.map((uc) => (
                        <Link
                            key={uc.slug}
                            href={`/use-cases/${uc.slug}`}
                            className="border-border/60 bg-card hover:border-primary/40 group rounded-2xl border p-6 transition-colors"
                        >
                            <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                                {uc.vertical}
                            </span>
                            <h3 className="text-foreground group-hover:text-primary mt-2 text-lg font-semibold transition-colors">
                                {uc.title}
                            </h3>
                            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                                {uc.description}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {uc.integrations.map((name) => (
                                    <span
                                        key={name}
                                        className="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs"
                                    >
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </Link>
                    ))}
                </div>
            </SectionWrapper>
        </>
    );
}
