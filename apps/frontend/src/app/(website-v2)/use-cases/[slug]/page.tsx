import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { useCaseDataMap, useCaseSlugs } from "@/data/website/use-cases";
import { UseCasePageTemplate } from "@/components/website/use-case/use-case-page-template";

export function generateStaticParams() {
    return useCaseSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
    params
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const data = useCaseDataMap[slug];
    if (!data) return {};

    return buildPageMetadata({
        title: `${data.vertical} — AgentC2 Use Cases`,
        description: data.heroDescription,
        path: `/use-cases/${slug}`,
        keywords: ["AI agents", data.vertical, "use case", "automation"]
    });
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const data = useCaseDataMap[slug];
    if (!data) notFound();

    return <UseCasePageTemplate data={data} />;
}
