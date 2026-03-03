"use client";

import { SectionWrapper } from "@/components/website/layout/section-wrapper";
import { Breadcrumbs } from "@/components/website/sections/breadcrumbs";
import { ComparisonTable } from "@/components/website/sections/comparison-table";
import { CTABanner } from "@/components/website/sections/cta-banner";
import { PageHero } from "@/components/website/sections/page-hero";
import { SectionHeader } from "@/components/website/sections/section-header";
import { faqJsonLd } from "@/lib/seo";
import { cn } from "@repo/ui";

export interface ComparisonData {
    slug: string;
    competitor: string;
    competitorUrl: string;
    heroSubtitle: string;
    tldr: { them: string; us: string; difference: string };
    dimensions: Array<{
        name: string;
        them: string;
        us: string;
        whyItMatters: string;
    }>;
    featureTable: Array<{
        feature: string;
        us: string | boolean;
        them: string | boolean;
    }>;
    problemWeSolve: string;
    whoShouldChooseThem: string;
    whoShouldChooseUs: string;
    faqs: Array<{ question: string; answer: string }>;
}

export function ComparisonPageTemplate({ data }: { data: ComparisonData }) {
    return (
        <>
            {/* FAQ Schema */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(faqJsonLd(data.faqs))
                }}
            />

            {/* Breadcrumbs */}
            <div className="mx-auto max-w-7xl px-6 pt-8">
                <Breadcrumbs
                    items={[
                        { label: "Home", href: "/" },
                        { label: "Compare", href: "/compare" },
                        { label: `vs ${data.competitor}` }
                    ]}
                    currentPath={`/compare/${data.slug}`}
                />
            </div>

            {/* Hero */}
            <PageHero
                overline="Comparison"
                title={`AgentC2 vs ${data.competitor}`}
                description={data.heroSubtitle}
                primaryCta={{ label: "Start free", href: "/signup" }}
                secondaryCta={{
                    label: "See all comparisons",
                    href: "/compare"
                }}
                centered
            />

            {/* TL;DR */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="At a glance"
                    title="TL;DR"
                    description="The essential difference in three sentences."
                />
                <div className="mt-12 grid gap-8 md:grid-cols-3">
                    <TldrCard heading={`What ${data.competitor} is`} body={data.tldr.them} />
                    <TldrCard heading="What AgentC2 is" body={data.tldr.us} highlight />
                    <TldrCard heading="The key difference" body={data.tldr.difference} />
                </div>
            </SectionWrapper>

            {/* Detailed Dimensions */}
            {data.dimensions.map((dim, i) => (
                <SectionWrapper key={dim.name} muted={i % 2 !== 0}>
                    <div className="grid gap-12 lg:grid-cols-2">
                        <div>
                            <h3 className="text-primary text-xs font-semibold tracking-wider uppercase">
                                Dimension {i + 1}
                            </h3>
                            <h2 className="text-foreground mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                                {dim.name}
                            </h2>
                            <p className="text-muted-foreground mt-4 text-base leading-relaxed italic">
                                Why it matters: {dim.whyItMatters}
                            </p>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2">
                            <DimensionCard label={data.competitor} text={dim.them} />
                            <DimensionCard label="AgentC2" text={dim.us} highlight />
                        </div>
                    </div>
                </SectionWrapper>
            ))}

            {/* Feature Comparison Table */}
            <SectionWrapper>
                <SectionHeader
                    overline="Feature by feature"
                    title="Detailed comparison"
                    description={`A side-by-side look at AgentC2 and ${data.competitor}.`}
                />
                <div className="mt-12">
                    <ComparisonTable
                        rows={data.featureTable}
                        usLabel="AgentC2"
                        themLabel={data.competitor}
                    />
                </div>
            </SectionWrapper>

            {/* Problem We Solve */}
            <SectionWrapper muted>
                <SectionHeader overline="The problem" title="What problem does AgentC2 solve?" />
                <p className="text-muted-foreground mx-auto mt-6 max-w-3xl text-center text-lg leading-relaxed">
                    {data.problemWeSolve}
                </p>
            </SectionWrapper>

            {/* Who Should Choose */}
            <SectionWrapper>
                <div className="grid gap-8 md:grid-cols-2">
                    <ChoiceCard
                        heading={`Who should choose ${data.competitor}`}
                        body={data.whoShouldChooseThem}
                    />
                    <ChoiceCard
                        heading="Who should choose AgentC2"
                        body={data.whoShouldChooseUs}
                        highlight
                    />
                </div>
            </SectionWrapper>

            {/* CTA */}
            <CTABanner
                title={`Ready to move beyond ${data.competitor}?`}
                description="See how AgentC2 delivers production-grade agent operations out of the box."
                primaryCta={{ label: "Start free", href: "/signup" }}
                secondaryCta={{
                    label: "Book a demo",
                    href: "/contact"
                }}
            />

            {/* FAQs */}
            <SectionWrapper muted>
                <SectionHeader
                    overline="FAQ"
                    title={`AgentC2 vs ${data.competitor} — Common questions`}
                />
                <div className="divide-border/60 mx-auto mt-12 max-w-3xl divide-y">
                    {data.faqs.map((faq) => (
                        <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
                    ))}
                </div>
            </SectionWrapper>
        </>
    );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function TldrCard({
    heading,
    body,
    highlight
}: {
    heading: string;
    body: string;
    highlight?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-2xl border p-8",
                highlight ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"
            )}
        >
            <h3 className="text-foreground text-sm font-semibold tracking-wider uppercase">
                {heading}
            </h3>
            <p className="text-muted-foreground mt-3 text-base leading-relaxed">{body}</p>
        </div>
    );
}

function DimensionCard({
    label,
    text,
    highlight
}: {
    label: string;
    text: string;
    highlight?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-xl border p-6",
                highlight ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"
            )}
        >
            <span
                className={cn(
                    "text-xs font-semibold tracking-wider uppercase",
                    highlight ? "text-primary" : "text-muted-foreground"
                )}
            >
                {label}
            </span>
            <p className="text-foreground mt-3 text-sm leading-relaxed">{text}</p>
        </div>
    );
}

function ChoiceCard({
    heading,
    body,
    highlight
}: {
    heading: string;
    body: string;
    highlight?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-2xl border p-8",
                highlight ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"
            )}
        >
            <h3 className="text-foreground mb-4 text-xl font-bold">{heading}</h3>
            <p className="text-muted-foreground text-base leading-relaxed">{body}</p>
        </div>
    );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
    return (
        <details className="group py-6">
            <summary className="text-foreground flex cursor-pointer list-none items-center justify-between text-base font-medium">
                {question}
                <span className="text-muted-foreground ml-4 transition-transform group-open:rotate-45">
                    +
                </span>
            </summary>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">{answer}</p>
        </details>
    );
}
