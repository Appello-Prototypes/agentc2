import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCS_PAGES, DOCS_SECTIONS, getDocsPage } from "@/lib/content/docs";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { DocsShell } from "@/components/docs/docs-shell";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { ContentPageTracker } from "@/components/analytics/content-page-tracker";

interface DocsPageProps {
    params: Promise<{ slug: string[] }>;
}

function formatSegment(segment: string): string {
    return segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function generateStaticParams() {
    return DOCS_PAGES.map((page) => ({ slug: page.slug.split("/") }));
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
    const { slug } = await params;
    const joined = slug.join("/");
    const page = getDocsPage(joined);

    if (!page) {
        return {};
    }

    return buildPageMetadata({
        title: page.title,
        description: page.description,
        path: `/docs/${page.slug}`,
        keywords: [page.primaryKeyword, ...page.secondaryKeywords]
    });
}

export default async function DocsDetailPage({ params }: DocsPageProps) {
    const { slug } = await params;
    const joined = slug.join("/");
    const page = getDocsPage(joined);

    if (!page) {
        notFound();
    }

    const section = DOCS_SECTIONS.find((candidate) => candidate.slug === page.section);
    const sectionPages = DOCS_PAGES.filter((candidate) => candidate.section === page.section).sort((a, b) =>
        a.slug.localeCompare(b.slug)
    );
    const pageIndex = sectionPages.findIndex((candidate) => candidate.slug === page.slug);
    const previousPage = pageIndex > 0 ? sectionPages[pageIndex - 1] : undefined;
    const nextPage = pageIndex >= 0 && pageIndex < sectionPages.length - 1 ? sectionPages[pageIndex + 1] : undefined;

    const breadcrumb = [
        { name: "Docs", path: "/docs" },
        {
            name: formatSegment(page.section),
            path: section ? `/docs/${section.firstPageSlug}` : "/docs"
        },
        { name: page.title.replace(" | AgentC2 Docs", ""), path: `/docs/${page.slug}` }
    ];

    const schema = breadcrumbJsonLd(breadcrumb);

    return (
        <>
            <ContentPageTracker
                eventName="docs_page_view"
                params={{
                    content_type: "docs",
                    content_slug: page.slug,
                    primary_keyword: page.primaryKeyword
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <DocsShell
                currentSlug={page.slug}
                currentSection={page.section}
                title={page.title.replace(" | AgentC2 Docs", "")}
                description={page.description}
                breadcrumb={breadcrumb}
                toc={[
                    { id: "overview", label: "Overview" },
                    { id: "related-pages", label: "Related Pages" },
                    { id: "next-step", label: "Next Step" }
                ]}
            >
                <div className="text-muted-foreground mb-4 flex flex-wrap gap-4 text-sm">
                    <span>Primary keyword: {page.primaryKeyword}</span>
                    <span>Intent: {page.searchIntent}</span>
                    <span>Type: {page.pageType}</span>
                    <span>Last updated: {page.lastUpdated}</span>
                </div>

                <article id="overview" className="space-y-4">
                    {page.body.map((paragraph) => (
                        <p key={paragraph} className="text-muted-foreground leading-relaxed">
                            {paragraph}
                        </p>
                    ))}
                </article>

                <section id="related-pages" className="mt-10">
                    <h2 className="text-foreground mb-3 text-xl font-semibold">Related Pages</h2>
                    <ul className="space-y-2">
                        {page.relatedSlugs.slice(0, 5).map((relatedSlug) => {
                            const related = getDocsPage(relatedSlug);
                            if (!related) {
                                return null;
                            }

                            return (
                                <li key={relatedSlug}>
                                    <Link
                                        href={`/docs/${relatedSlug}`}
                                        className="text-primary hover:text-primary/80"
                                    >
                                        {related.title.replace(" | AgentC2 Docs", "")}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <section id="next-step" className="mt-10 rounded-lg border p-6">
                    <h2 className="text-foreground text-xl font-semibold">Next Step</h2>
                    <p className="text-muted-foreground mt-2">
                        Apply this pattern in your workspace and validate behavior with traces and
                        evaluations.
                    </p>
                    <TrackedLink
                        href={page.ctaHref}
                        className="bg-primary text-primary-foreground mt-4 inline-flex rounded-md px-4 py-2 text-sm font-medium"
                        eventName={
                            page.ctaHref.includes("signup")
                                ? "signup_click_from_content"
                                : "workspace_click_from_content"
                        }
                        eventParams={{
                            content_type: "docs",
                            content_slug: page.slug,
                            cta_target: page.ctaHref
                        }}
                    >
                        {page.ctaLabel}
                    </TrackedLink>
                </section>

                <nav className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
                    {previousPage ? (
                        <Link
                            href={`/docs/${previousPage.slug}`}
                            className="text-primary hover:text-primary/80 text-sm font-medium"
                        >
                            ← {previousPage.title.replace(" | AgentC2 Docs", "")}
                        </Link>
                    ) : (
                        <span className="text-muted-foreground text-sm">Beginning of section</span>
                    )}

                    {nextPage ? (
                        <Link
                            href={`/docs/${nextPage.slug}`}
                            className="text-primary hover:text-primary/80 text-sm font-medium"
                        >
                            {nextPage.title.replace(" | AgentC2 Docs", "")} →
                        </Link>
                    ) : (
                        <span className="text-muted-foreground text-sm">End of section</span>
                    )}
                </nav>
            </DocsShell>
        </>
    );
}
