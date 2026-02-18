import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: [
                    "/",
                    "/about",
                    "/signup",
                    "/terms",
                    "/privacy",
                    "/security",
                    "/docs",
                    "/blog"
                ],
                disallow: ["/dashboard", "/examples", "/workspace", "/api"]
            }
        ],
        sitemap: "https://agentc2.ai/sitemap.xml",
        host: "https://agentc2.ai"
    };
}
