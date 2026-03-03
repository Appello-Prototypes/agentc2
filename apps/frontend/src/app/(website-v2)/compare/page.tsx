import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { allComparisons } from "@/data/website/comparisons";

export const metadata: Metadata = buildPageMetadata({
    title: "Compare AgentC2 — How We Stack Up",
    description:
        "See how AgentC2 compares to LangChain, n8n, CrewAI, OpenAI Assistants, Copilot Studio, Relevance AI, and Mastra.",
    path: "/compare",
    keywords: ["AI agent comparison", "AgentC2 alternatives", "agent platform comparison"]
});

export default function ComparePage() {
    const comparisons = Object.values(allComparisons);

    return (
        <>
            <PageHero
                overline="Comparisons"
                title="How AgentC2 stacks up"
                description="Honest, detailed comparisons against the platforms you're evaluating. See the real differences."
                centered
            />

            <SectionWrapper>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {comparisons.map((c) => (
                        <Link
                            key={c.slug}
                            href={`/compare/${c.slug}`}
                            className="border-border/60 bg-card hover:border-primary/40 group rounded-2xl border p-6 transition-colors"
                        >
                            <h3 className="text-foreground group-hover:text-primary text-lg font-semibold transition-colors">
                                AgentC2 vs {c.competitor}
                            </h3>
                            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                                {c.heroSubtitle}
                            </p>
                        </Link>
                    ))}
                </div>
            </SectionWrapper>
        </>
    );
}
