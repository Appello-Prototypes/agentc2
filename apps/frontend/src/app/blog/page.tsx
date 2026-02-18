import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/content/blog";
import { buildPageMetadata } from "@/lib/seo";
import { ContentPageTracker } from "@/components/analytics/content-page-tracker";

export const metadata: Metadata = buildPageMetadata({
    title: "AgentC2 Blog",
    description:
        "Insights on AI agent orchestration, MCP integrations, guardrails, workflows, and production AI operations.",
    path: "/blog",
    keywords: ["AI agent orchestration blog", "MCP guide", "AI agent best practices"]
});

const CATEGORY_LABELS: Record<string, string> = {
    all: "All",
    comparison: "Comparisons",
    pillar: "Pillar",
    tutorial: "Tutorials",
    feature: "Features",
    educational: "Educational",
    "use-case": "Use Cases",
    integration: "Integrations",
    "pain-point": "Pain Points",
    technical: "Technical"
};

function getActiveCategories(): string[] {
    const seen: Set<string> = new Set(BLOG_POSTS.map((p) => p.category));
    return ["all", ...Object.keys(CATEGORY_LABELS).filter((k) => k !== "all" && seen.has(k))];
}

interface BlogIndexProps {
    searchParams: Promise<{ category?: string }>;
}

export default async function BlogIndexPage({ searchParams }: BlogIndexProps) {
    const { category } = await searchParams;
    const activeCategory = category || "all";
    const categories = getActiveCategories();
    const filteredPosts =
        activeCategory === "all"
            ? BLOG_POSTS
            : BLOG_POSTS.filter((p) => p.category === activeCategory);

    return (
        <main className="mx-auto max-w-4xl px-6 py-12">
            <ContentPageTracker
                eventName="blog_post_view"
                params={{ content_type: "blog", content_slug: "index" }}
            />
            <header className="mb-10">
                <h1 className="text-foreground text-4xl font-bold tracking-tight">AgentC2 Blog</h1>
                <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
                    Practical guides, comparisons, and implementation patterns for production AI
                    agent systems.
                </p>
            </header>

            <nav className="mb-8 flex flex-wrap gap-2" aria-label="Filter by category">
                {categories.map((cat) => {
                    const isActive = cat === activeCategory;
                    return (
                        <Link
                            key={cat}
                            href={cat === "all" ? "/blog" : `/blog?category=${cat}`}
                            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                                isActive
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                            }`}
                        >
                            {CATEGORY_LABELS[cat] ?? cat}
                        </Link>
                    );
                })}
            </nav>

            <ul className="space-y-6">
                {filteredPosts.map((post) => (
                    <li key={post.slug} className="border-border rounded-lg border p-6">
                        <p className="text-muted-foreground text-xs tracking-wide uppercase">
                            {post.category}
                        </p>
                        <Link
                            href={`/blog/${post.slug}`}
                            className="text-foreground mt-2 block text-2xl font-semibold"
                        >
                            {post.title}
                        </Link>
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                            {post.description}
                        </p>
                        <p className="text-muted-foreground mt-4 text-xs">
                            {post.publishedAt} · {post.readMinutes} min read
                        </p>
                    </li>
                ))}
            </ul>

            {filteredPosts.length === 0 && (
                <p className="text-muted-foreground py-12 text-center">
                    No posts in this category yet.
                </p>
            )}
        </main>
    );
}
