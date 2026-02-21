import Link from "next/link";
import type { Metadata } from "next";
import { DOCS_LAUNCH_PRIORITY, DOCS_SECTIONS } from "@/lib/content/docs";
import { getDocSections } from "@/lib/content/mdx";
import { buildPageMetadata } from "@/lib/seo";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { ContentPageTracker } from "@/components/analytics/content-page-tracker";

export const metadata: Metadata = buildPageMetadata({
    title: "AgentC2 Documentation",
    description:
        "Learn how to build, deploy, and operate AI agents with AgentC2. Quickstart guides, core concepts, integrations, and API reference.",
    path: "/docs",
    keywords: ["AI agent documentation", "AI agent platform docs", "agent quickstart guide"]
});

const SECTION_META: Record<string, { description: string; icon: string }> = {
    "getting-started": {
        description: "Create your first agent in under 5 minutes. No code required.",
        icon: "rocket"
    },
    "core-concepts": {
        description: "Understand agents, networks, workflows, integrations, and knowledge.",
        icon: "bot"
    },
    guides: {
        description: "Step-by-step tutorials for common use cases and production setups.",
        icon: "compass"
    },
    workspace: {
        description: "Navigate the AgentC2 workspace UI -- chat, manage agents, connect tools.",
        icon: "channels"
    },
    "api-reference": {
        description: "Full REST API, MCP developer access, and endpoint documentation.",
        icon: "code"
    }
};

function SectionIcon({ name }: { name: string }) {
    const icons: Record<string, React.ReactNode> = {
        rocket: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
        ),
        bot: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect width="18" height="10" x="3" y="11" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" x2="8" y1="16" y2="16" />
                <line x1="16" x2="16" y1="16" y2="16" />
            </svg>
        ),
        puzzle: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.611a2.407 2.407 0 0 1-1.706.707 2.408 2.408 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.407 2.407 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.611-1.611a2.407 2.407 0 0 1 1.704-.706c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z" />
            </svg>
        ),
        workflow: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="3" y="3" width="6" height="6" rx="1" />
                <rect x="15" y="3" width="6" height="6" rx="1" />
                <rect x="9" y="15" width="6" height="6" rx="1" />
                <path d="M6 9v3a1 1 0 0 0 1 1h4" />
                <path d="M18 9v3a1 1 0 0 1-1 1h-4" />
            </svg>
        ),
        network: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="12" cy="5" r="3" />
                <circle cx="5" cy="19" r="3" />
                <circle cx="19" cy="19" r="3" />
                <path d="M12 8v4" />
                <path d="m10 14-3.5 3" />
                <path d="m14 14 3.5 3" />
            </svg>
        ),
        plug: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M12 22v-5" />
                <path d="M9 8V2" />
                <path d="M15 8V2" />
                <path d="M18 8v5a6 6 0 0 1-6 6v0a6 6 0 0 1-6-6V8z" />
            </svg>
        ),
        channels: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="m7.5 4.27 9 5.15" />
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
            </svg>
        ),
        book: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
        ),
        target: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
            </svg>
        ),
        shield: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            </svg>
        ),
        code: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
        ),
        compass: (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
        )
    };

    return <div className="text-primary mb-2">{icons[name] ?? icons.code}</div>;
}

export default function DocsHomePage() {
    const mdxSections = getDocSections();

    const displaySections =
        mdxSections.length > 0
            ? mdxSections.map((s) => ({
                  slug: s.slug,
                  title: s.title,
                  firstPageSlug: s.pages[0]?.slug ?? s.slug,
                  pageCount: s.pages.length
              }))
            : DOCS_SECTIONS;

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
                    Everything you need to build, deploy, and operate AI agents with AgentC2. Start
                    with a quickstart, explore core concepts, or jump into a step-by-step guide.
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
                    {displaySections.map((section) => {
                        const meta = SECTION_META[section.slug];
                        return (
                            <Link
                                key={section.slug}
                                href={`/docs/${section.firstPageSlug}`}
                                className="border-border hover:border-primary/50 rounded-lg border p-4 transition-colors"
                            >
                                {meta && <SectionIcon name={meta.icon} />}
                                <p className="text-foreground text-base font-semibold">
                                    {section.title}
                                </p>
                                {meta && (
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {meta.description}
                                    </p>
                                )}
                                <p className="text-muted-foreground mt-2 text-xs">
                                    {section.pageCount} pages
                                </p>
                            </Link>
                        );
                    })}
                </div>
            </section>

            <section>
                <h2 className="text-foreground mb-4 text-2xl font-semibold">Popular Pages</h2>
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
