import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: [
                    "/",
                    "/about",
                    "/login",
                    "/signup",
                    "/docs/",
                    "/blog/",
                    "/terms",
                    "/privacy",
                    "/security"
                ],
                disallow: [
                    "/api/",
                    "/workspace",
                    "/dashboard",
                    "/agents/",
                    "/workflows/",
                    "/networks/",
                    "/skills/",
                    "/knowledge/",
                    "/campaigns/",
                    "/live/",
                    "/settings/",
                    "/mcp/",
                    "/demos/",
                    "/activity",
                    "/triggers",
                    "/onboarding",
                    "/support/",
                    "/bim/",
                    "/channels/",
                    "/coding-pipeline",
                    "/marketplace",
                    "/examples",
                    "/embed/",
                    "/embed-v2/",
                    "/admin",
                    "/_home/",
                    "/_next/"
                ]
            }
        ],
        sitemap: "https://agentc2.ai/sitemap.xml",
        host: "https://agentc2.ai"
    };
}
