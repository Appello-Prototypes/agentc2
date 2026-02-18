import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getBlogPost } from "@/lib/content/blog";
import { getDocsPage } from "@/lib/content/docs";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { ContentPageTracker } from "@/components/analytics/content-page-tracker";
import { TrackedLink } from "@/components/analytics/tracked-link";

interface BlogDetailProps {
    params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
    return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogDetailProps): Promise<Metadata> {
    const { slug } = await params;
    const post = getBlogPost(slug);

    if (!post) {
        return {};
    }

    return buildPageMetadata({
        title: post.title,
        description: post.description,
        path: `/blog/${post.slug}`,
        keywords: [post.primaryKeyword, ...post.secondaryKeywords]
    });
}

export default async function BlogDetailPage({ params }: BlogDetailProps) {
    const { slug } = await params;
    const post = getBlogPost(slug);

    if (!post) {
        notFound();
    }

    const schema = breadcrumbJsonLd([
        { name: "Blog", path: "/blog" },
        { name: post.title, path: `/blog/${post.slug}` }
    ]);

    return (
        <main className="mx-auto max-w-3xl px-6 py-12">
            <ContentPageTracker
                eventName="blog_post_view"
                params={{
                    content_type: "blog",
                    content_slug: post.slug,
                    primary_keyword: post.primaryKeyword
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <nav className="mb-4 text-sm">
                <Link href="/blog" className="text-primary hover:text-primary/80">
                    Blog
                </Link>
                <span className="text-muted-foreground px-2">/</span>
                <span className="text-muted-foreground">{post.title}</span>
            </nav>

            <header className="mb-8">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    {post.category}
                </p>
                <h1 className="text-foreground mt-2 text-4xl font-bold tracking-tight">
                    {post.title}
                </h1>
                <p className="text-muted-foreground mt-3 leading-relaxed">{post.description}</p>
                <p className="text-muted-foreground mt-4 text-sm">
                    By {post.author} · Published {post.publishedAt} · Updated {post.updatedAt} ·{" "}
                    {post.readMinutes} min read
                </p>
            </header>

            <article className="space-y-8">
                {post.sections.map((section) => (
                    <section key={section.heading}>
                        <h2 className="text-foreground text-2xl font-semibold">
                            {section.heading}
                        </h2>
                        <div className="mt-3 space-y-3">
                            {section.paragraphs.map((paragraph) => (
                                <p
                                    key={paragraph}
                                    className="text-muted-foreground leading-relaxed"
                                >
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    </section>
                ))}
            </article>

            <section className="mt-10">
                <h2 className="text-foreground mb-3 text-xl font-semibold">
                    Related Documentation
                </h2>
                <ul className="space-y-2">
                    {post.relatedDocs.map((slug) => {
                        const page = getDocsPage(slug);
                        if (!page) {
                            return null;
                        }

                        return (
                            <li key={slug}>
                                <Link
                                    href={`/docs/${slug}`}
                                    className="text-primary hover:text-primary/80"
                                >
                                    {page.title.replace(" | AgentC2 Docs", "")}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section className="mt-10 rounded-lg border p-6">
                <h2 className="text-foreground text-xl font-semibold">Put this into practice</h2>
                <p className="text-muted-foreground mt-2">
                    Start your AgentC2 workspace and implement these patterns with production
                    observability and governance.
                </p>
                <TrackedLink
                    href="/signup"
                    className="bg-primary text-primary-foreground mt-4 inline-flex rounded-md px-4 py-2 text-sm font-medium"
                    eventName="signup_click_from_content"
                    eventParams={{
                        content_type: "blog",
                        content_slug: post.slug,
                        cta_target: "/signup"
                    }}
                >
                    Start with AgentC2
                </TrackedLink>
            </section>
        </main>
    );
}
