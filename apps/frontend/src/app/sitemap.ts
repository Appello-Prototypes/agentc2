import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/content/blog";
import { DOCS_PAGES } from "@/lib/content/docs";

const BASE = "https://agentc2.ai";

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    const staticRoutes: MetadataRoute.Sitemap = [
        { url: `${BASE}/`, lastModified: now, priority: 1.0, changeFrequency: "weekly" },
        { url: `${BASE}/about`, lastModified: now, priority: 0.7, changeFrequency: "monthly" },
        { url: `${BASE}/signup`, lastModified: now, priority: 0.9, changeFrequency: "weekly" },
        { url: `${BASE}/terms`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
        { url: `${BASE}/privacy`, lastModified: now, priority: 0.3, changeFrequency: "yearly" },
        { url: `${BASE}/security`, lastModified: now, priority: 0.6, changeFrequency: "monthly" },
        { url: `${BASE}/docs`, lastModified: now, priority: 0.9, changeFrequency: "daily" },
        { url: `${BASE}/blog`, lastModified: now, priority: 0.8, changeFrequency: "daily" }
    ];

    const docsRoutes: MetadataRoute.Sitemap = DOCS_PAGES.map((page) => ({
        url: `${BASE}/docs/${page.slug}`,
        lastModified: new Date(page.lastUpdated),
        priority: 0.8,
        changeFrequency: "weekly"
    }));

    const blogRoutes: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
        url: `${BASE}/blog/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        priority: 0.7,
        changeFrequency: "monthly"
    }));

    return [...staticRoutes, ...docsRoutes, ...blogRoutes];
}
