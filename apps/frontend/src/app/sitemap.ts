import type { MetadataRoute } from "next";
import { ALL_BLOG_POSTS } from "@/lib/content/blog";
import { DOCS_PAGES, DOCS_LAUNCH_PRIORITY } from "@/lib/content/docs";
import { getAllDocSlugs } from "@/lib/content/mdx";

const BASE = "https://agentc2.ai";

const launchPrioritySlugs = new Set(DOCS_LAUNCH_PRIORITY.map((p) => p.slug));

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    const staticRoutes: MetadataRoute.Sitemap = [
        { url: `${BASE}/`, lastModified: now, priority: 1.0, changeFrequency: "weekly" },
        { url: `${BASE}/about`, lastModified: now, priority: 0.7, changeFrequency: "monthly" },
        { url: `${BASE}/signup`, lastModified: now, priority: 0.9, changeFrequency: "monthly" },
        { url: `${BASE}/login`, lastModified: now, priority: 0.6, changeFrequency: "monthly" },
        { url: `${BASE}/docs`, lastModified: now, priority: 0.9, changeFrequency: "weekly" },
        { url: `${BASE}/blog`, lastModified: now, priority: 0.8, changeFrequency: "weekly" },
        { url: `${BASE}/terms`, lastModified: now, priority: 0.2, changeFrequency: "yearly" },
        { url: `${BASE}/privacy`, lastModified: now, priority: 0.2, changeFrequency: "yearly" },
        { url: `${BASE}/security`, lastModified: now, priority: 0.5, changeFrequency: "monthly" }
    ];

    const seen = new Set<string>();
    const docsRoutes: MetadataRoute.Sitemap = [];

    for (const slug of getAllDocSlugs()) {
        seen.add(slug);
        const isHighPriority = launchPrioritySlugs.has(slug);
        docsRoutes.push({
            url: `${BASE}/docs/${slug}`,
            lastModified: now,
            priority: isHighPriority ? 0.9 : 0.7,
            changeFrequency: "weekly"
        });
    }

    for (const page of DOCS_PAGES) {
        if (!seen.has(page.slug)) {
            const isHighPriority = launchPrioritySlugs.has(page.slug);
            docsRoutes.push({
                url: `${BASE}/docs/${page.slug}`,
                lastModified: new Date(page.lastUpdated),
                priority: isHighPriority ? 0.9 : 0.7,
                changeFrequency: "weekly"
            });
        }
    }

    const blogRoutes: MetadataRoute.Sitemap = ALL_BLOG_POSTS.map((post) => ({
        url: `${BASE}/blog/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        priority: post.category === "pillar" ? 0.8 : 0.6,
        changeFrequency: "monthly" as const
    }));

    return [...staticRoutes, ...docsRoutes, ...blogRoutes];
}
