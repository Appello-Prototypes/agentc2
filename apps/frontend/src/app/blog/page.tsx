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

export default function BlogIndexPage() {
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

            <ul className="space-y-6">
                {BLOG_POSTS.map((post) => (
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
        </main>
    );
}
