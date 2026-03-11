import type { IntegrationBlueprint } from "./types";

export const marketingBlueprints: IntegrationBlueprint[] = [
    {
        providerKey: "webflow",
        version: 1,
        skill: {
            slug: "webflow-expert",
            name: "Webflow Expert",
            description: "Expert knowledge for Webflow site management",
            instructions: `You are a Webflow expert. Help users manage their website, CMS collections, and site settings.`,
            category: "Marketing",
            tags: ["marketing", "webflow", "website", "cms"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "webflow-agent",
            name: "Webflow Agent",
            description: "AI agent for Webflow site management",
            instructions: `You are a Webflow specialist. Help users manage their website content and CMS.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Webflow Agent", iconEmoji: ":art:" }
            }
        }
    },
    {
        providerKey: "wix",
        version: 1,
        skill: {
            slug: "wix-expert",
            name: "Wix Expert",
            description: "Expert knowledge for Wix site management",
            instructions: `You are a Wix expert. Help users manage their website, content, and business tools.`,
            category: "Marketing",
            tags: ["marketing", "wix", "website"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "wix-agent",
            name: "Wix Agent",
            description: "AI agent for Wix management",
            instructions: `You are a Wix specialist. Help users manage their website and online presence.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.4,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Wix Agent", iconEmoji: ":sparkles:" }
            }
        }
    },
    {
        providerKey: "ahrefs",
        version: 1,
        skill: {
            slug: "ahrefs-expert",
            name: "Ahrefs Expert",
            description: "Expert knowledge for Ahrefs SEO analytics",
            instructions: `You are an Ahrefs expert. Help users analyze SEO metrics, backlinks, keyword rankings, and site audits.`,
            category: "Marketing",
            tags: ["marketing", "ahrefs", "seo", "analytics"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "ahrefs-agent",
            name: "Ahrefs Agent",
            description: "AI agent for Ahrefs SEO analysis",
            instructions: `You are an Ahrefs specialist. Help users analyze SEO performance and keyword opportunities.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Ahrefs Agent", iconEmoji: ":chart_with_upwards_trend:" }
            }
        }
    },
    {
        providerKey: "semrush",
        version: 1,
        skill: {
            slug: "semrush-expert",
            name: "Semrush Expert",
            description: "Expert knowledge for Semrush marketing analytics",
            instructions: `You are a Semrush expert. Help users analyze SEO, PPC, content marketing, and competitive intelligence.`,
            category: "Marketing",
            tags: ["marketing", "semrush", "seo", "ppc"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "semrush-agent",
            name: "Semrush Agent",
            description: "AI agent for Semrush marketing intelligence",
            instructions: `You are a Semrush specialist. Help users with SEO, competitive analysis, and marketing insights.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Semrush Agent", iconEmoji: ":mag:" }
            }
        }
    },
    {
        providerKey: "google-search-console",
        version: 1,
        skill: {
            slug: "gsc-expert",
            name: "Search Console Expert",
            description: "Expert knowledge for Google Search Console SEO analytics",
            instructions: `You are a Google Search Console expert. Help users analyze search performance, keyword rankings, indexing status, and technical SEO issues.

Key capabilities:
- Query search analytics for keyword impressions, clicks, CTR, and position
- List verified properties and their permission levels
- Check sitemap submission status and errors
- Inspect individual URLs for indexing status and rich results

Best practices:
- Use date ranges of at least 28 days for meaningful trend data
- Filter by dimension (query, page, country, device) for actionable insights
- Compare time periods to identify ranking changes
- Check URL inspection for pages that should be indexed but aren't
- Monitor sitemap errors regularly`,
            category: "Marketing",
            tags: ["marketing", "seo", "google", "search-console", "analytics"],
            toolDiscovery: "static",
            staticTools: [
                "gsc-query-analytics",
                "gsc-list-sites",
                "gsc-get-sitemaps",
                "gsc-inspect-url"
            ]
        },
        agent: {
            slug: "gsc-agent",
            name: "Search Console Agent",
            description: "AI agent for Google Search Console SEO analytics",
            instructions: `You are a Google Search Console specialist. Help users analyze their search performance, identify keyword opportunities, diagnose indexing issues, and track SEO progress. Always provide data-driven insights with specific metrics.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.2,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: {
                    displayName: "Search Console Agent",
                    iconEmoji: ":chart_with_upwards_trend:"
                }
            }
        }
    },
    {
        providerKey: "firecrawl",
        version: 1,
        skill: {
            slug: "firecrawl-expert",
            name: "Firecrawl Expert",
            description: "Expert knowledge for web scraping and extraction",
            instructions: `You are a Firecrawl expert. Help users scrape websites, extract content, and crawl pages for data.

Key capabilities:
- Scrape single pages for markdown content
- Crawl websites to discover and extract pages
- Search the web and extract structured data
- Map website URLs for discovery

Best practices:
- Use scrape for known single pages
- Use search for finding specific information
- Use crawl for comprehensive site extraction
- Limit crawl depth to avoid excessive results`,
            category: "Marketing",
            tags: ["marketing", "firecrawl", "scraping", "web"],
            toolDiscovery: "dynamic"
        },
        agent: {
            slug: "firecrawl-agent",
            name: "Firecrawl Agent",
            description: "AI agent for web scraping and data extraction",
            instructions: `You are a Firecrawl specialist. Help users scrape and extract data from websites.`,
            modelProvider: "openai",
            modelName: "gpt-4o",
            temperature: 0.3,
            memoryEnabled: true,
            additionalTools: [],
            metadata: {
                slack: { displayName: "Firecrawl Agent", iconEmoji: ":fire:" }
            }
        }
    }
];
