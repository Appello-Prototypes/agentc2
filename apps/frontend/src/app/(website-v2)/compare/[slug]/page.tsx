import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { allComparisons, comparisonSlugs } from "@/data/website/comparisons";
import { ComparisonPageTemplate } from "@/components/website/comparison/comparison-page-template";

export function generateStaticParams() {
    return comparisonSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
    params
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const data = allComparisons[slug];
    if (!data) return {};

    return buildPageMetadata({
        title: `AgentC2 vs ${data.competitor} — Comparison`,
        description: data.heroSubtitle,
        path: `/compare/${slug}`,
        keywords: ["AI agent platform comparison", data.competitor, "AgentC2 alternative"]
    });
}

export default async function ComparisonPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const data = allComparisons[slug];
    if (!data) notFound();

    return <ComparisonPageTemplate data={data} />;
}
