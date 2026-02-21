import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const BRAVE_BASE_URL = "https://api.search.brave.com/res/v1";

function getBraveApiKey(): string {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
        throw new Error("BRAVE_SEARCH_API_KEY is not configured");
    }
    return apiKey;
}

async function braveGet(
    path: string,
    params: Record<string, string>
): Promise<Record<string, unknown>> {
    const url = new URL(`${BRAVE_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
        headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": getBraveApiKey()
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brave Search error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<Record<string, unknown>>;
}

/**
 * Brave Search — fastest agent search engine (669ms median latency).
 * Independent index, privacy-focused.
 */
export const braveSearchTool = createTool({
    id: "brave-search",
    description:
        "Fast web search using Brave Search (sub-second latency). Returns structured results from an independent search index. Best for speed-sensitive queries in multi-step agent workflows.",
    inputSchema: z.object({
        query: z.string().describe("The search query"),
        count: z.number().optional().default(10).describe("Number of results (max 20)"),
        freshness: z
            .enum(["pd", "pw", "pm", "py"])
            .optional()
            .describe("Freshness filter: pd=past day, pw=past week, pm=past month, py=past year"),
        country: z
            .string()
            .optional()
            .describe("Country code for localized results (e.g. 'US', 'GB')")
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                title: z.string(),
                url: z.string(),
                description: z.string(),
                age: z.string().optional()
            })
        ),
        resultCount: z.number()
    }),
    execute: async ({ query, count, freshness, country }) => {
        const params: Record<string, string> = {
            q: query,
            count: String(Math.min(count ?? 10, 20))
        };
        if (freshness) params.freshness = freshness;
        if (country) params.country = country;

        const data = await braveGet("/web/search", params);
        const webResults =
            (data.web as { results?: Array<Record<string, unknown>> })?.results || [];

        const results = webResults.map((r) => ({
            title: (r.title as string) || "",
            url: (r.url as string) || "",
            description: (r.description as string) || "",
            age: r.age as string | undefined
        }));

        return { results, resultCount: results.length };
    }
});

/**
 * Brave Local Search — search for local businesses and points of interest.
 */
export const braveLocalSearchTool = createTool({
    id: "brave-local-search",
    description:
        "Search for local businesses, restaurants, services, and points of interest using Brave Search. Returns results with addresses, ratings, and contact info.",
    inputSchema: z.object({
        query: z
            .string()
            .describe("Local search query (e.g. 'coffee shops near downtown Seattle')"),
        count: z.number().optional().default(5).describe("Number of results")
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                title: z.string(),
                url: z.string(),
                description: z.string(),
                address: z.string().optional(),
                phone: z.string().optional(),
                rating: z.number().optional()
            })
        ),
        resultCount: z.number()
    }),
    execute: async ({ query, count }) => {
        const params: Record<string, string> = {
            q: query,
            count: String(Math.min(count ?? 5, 20)),
            result_filter: "places"
        };

        const data = await braveGet("/web/search", params);

        const locations =
            (data.locations as { results?: Array<Record<string, unknown>> })?.results || [];
        const webResults =
            (data.web as { results?: Array<Record<string, unknown>> })?.results || [];

        const results =
            locations.length > 0
                ? locations.map((r) => ({
                      title: (r.title as string) || (r.name as string) || "",
                      url: (r.url as string) || "",
                      description: (r.description as string) || "",
                      address: (r.address as string) || undefined,
                      phone: (r.phone as string) || undefined,
                      rating: r.rating as number | undefined
                  }))
                : webResults.map((r) => ({
                      title: (r.title as string) || "",
                      url: (r.url as string) || "",
                      description: (r.description as string) || "",
                      address: undefined,
                      phone: undefined,
                      rating: undefined
                  }));

        return { results, resultCount: results.length };
    }
});

/**
 * Brave News Search — search for recent news articles.
 */
export const braveNewsSearchTool = createTool({
    id: "brave-news-search",
    description:
        "Search for recent news articles using Brave Search. Returns news results with publication dates and sources.",
    inputSchema: z.object({
        query: z.string().describe("News search query"),
        count: z.number().optional().default(10).describe("Number of results"),
        freshness: z
            .enum(["pd", "pw", "pm"])
            .optional()
            .describe("Freshness: pd=past day, pw=past week, pm=past month")
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                title: z.string(),
                url: z.string(),
                description: z.string(),
                age: z.string().optional(),
                source: z.string().optional()
            })
        ),
        resultCount: z.number()
    }),
    execute: async ({ query, count, freshness }) => {
        const params: Record<string, string> = {
            q: query,
            count: String(Math.min(count ?? 10, 20))
        };
        if (freshness) params.freshness = freshness;

        const data = await braveGet("/news/search", params);
        const newsResults = (data.results as Array<Record<string, unknown>>) || [];

        const results = newsResults.map((r) => ({
            title: (r.title as string) || "",
            url: (r.url as string) || "",
            description: (r.description as string) || "",
            age: r.age as string | undefined,
            source: ((r.meta_url as Record<string, unknown>)?.hostname as string) || undefined
        }));

        return { results, resultCount: results.length };
    }
});
