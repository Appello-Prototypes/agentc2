import Link from "next/link";
import type { Metadata } from "next";
import { DOCS_LAUNCH_PRIORITY, DOCS_SECTIONS } from "@/lib/content/docs";
import { buildPageMetadata } from "@/lib/seo";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { ContentPageTracker } from "@/components/analytics/content-page-tracker";

export const metadata: Metadata = buildPageMetadata({
    title: "AgentC2 Documentation",
    description:
        "Comprehensive AgentC2 documentation for AI agent orchestration, MCP integrations, workflows, networks, guardrails, and production deployment.",
    path: "/docs",
    keywords: ["AI agent documentation", "AI agent orchestration docs", "MCP integration docs"]
});

export default function DocsHomePage() {
    return (
        <main className="mx-auto max-w-6xl px-6 py-12">
            <ContentPageTracker
                eventName="docs_page_view"
                params={{ content_type: "docs", content_slug: "index" }}
            />
            <header className="mb-10 space-y-4">
                <h1 className="text-foreground text-4xl font-bold tracking-tight">
                    AgentC2 Documentation
                </h1>
                <p className="text-muted-foreground max-w-3xl text-base leading-relaxed">
                    Learn how to build, deploy, and scale production AI agents with AgentC2. This
                    docs hub includes architecture references, implementation guides, and
                    operational playbooks.
                </p>
                <div className="flex gap-3">
                    <TrackedLink
                        href="/docs/getting-started/introduction"
                        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
                        eventName="docs_cta_click"
                        eventParams={{
                            content_type: "docs",
                            content_slug: "index",
                            cta_target: "/docs/getting-started/introduction"
                        }}
                    >
                        Start Here
                    </TrackedLink>
                    <TrackedLink
                        href="/signup"
                        className="border-border rounded-md border px-4 py-2 text-sm font-medium"
                        eventName="signup_click_from_content"
                        eventParams={{
                            content_type: "docs",
                            content_slug: "index",
                            cta_target: "/signup"
                        }}
                    >
                        Launch AgentC2
                    </TrackedLink>
                </div>
            </header>

            <section className="mb-12">
                <h2 className="text-foreground mb-4 text-2xl font-semibold">
                    Documentation Sections
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {DOCS_SECTIONS.map((section) => (
                        <Link
                            key={section.slug}
                            href={`/docs/${section.firstPageSlug}`}
                            className="border-border hover:border-primary/50 rounded-lg border p-4 transition-colors"
                        >
                            <p className="text-foreground text-base font-semibold">
                                {section.title}
                            </p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {section.pageCount} pages
                            </p>
                        </Link>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-foreground mb-4 text-2xl font-semibold">
                    Launch Priority Pages
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                    {DOCS_LAUNCH_PRIORITY.map((page) => (
                        <li key={page.slug}>
                            <Link
                                href={`/docs/${page.slug}`}
                                className="text-primary hover:text-primary/80 text-sm font-medium"
                            >
                                {page.title.replace(" | AgentC2 Docs", "")}
                            </Link>
                            <p className="text-muted-foreground text-sm">{page.description}</p>
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    );
}
