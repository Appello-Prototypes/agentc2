import { createTool } from "@mastra/core/tools";
import { z } from "zod";

type SearchProvider = "exa" | "brave" | "perplexity" | "firecrawl";

const SYNTHESIS_PATTERNS =
    /\b(explain|summarize|what\s+is|how\s+does|why\s+does|compare|difference\s+between|pros\s+and\s+cons|overview\s+of|tell\s+me\s+about)\b/i;

const SPEED_PATTERNS =
    /\b(quick|fast|latest|current|right\s+now|today|breaking|stock\s+price|weather|score)\b/i;

const SCRAPE_PATTERNS = /\b(scrape|crawl|extract\s+from|read\s+this|content\s+of|full\s+page)\b/i;

function classifySearchIntent(query: string): SearchProvider {
    if (SCRAPE_PATTERNS.test(query)) return "firecrawl";
    if (SYNTHESIS_PATTERNS.test(query)) return "perplexity";
    if (SPEED_PATTERNS.test(query)) return "brave";
    return "exa";
}

const normalizedResultSchema = z.object({
    title: z.string(),
    url: z.string(),
    description: z.string(),
    score: z.number().optional()
});

/**
 * Smart Search Router — auto-selects the best search provider for each query.
 */
export const smartSearchTool = createTool({
    id: "smart-search",
    description:
        "Intelligent search that auto-routes to the best provider: Exa (accuracy), Brave (speed), Perplexity (synthesized answers), or Firecrawl (scraping). Just provide your query — the router picks the optimal engine.",
    inputSchema: z.object({
        query: z.string().describe("The search query or research question"),
        provider: z
            .enum(["auto", "exa", "brave", "perplexity", "firecrawl"])
            .optional()
            .default("auto")
            .describe("Force a specific provider, or 'auto' to let the router decide"),
        numResults: z.number().optional().default(5).describe("Number of results to return")
    }),
    outputSchema: z.object({
        provider: z.string(),
        results: z.array(normalizedResultSchema),
        resultCount: z.number(),
        synthesizedAnswer: z.string().optional()
    }),
    execute: async ({ query, provider: requestedProvider, numResults }) => {
        const provider =
            requestedProvider === "auto" ? classifySearchIntent(query) : requestedProvider;

        switch (provider) {
            case "exa": {
                const apiKey = process.env.EXA_API_KEY;
                if (!apiKey) throw new Error("EXA_API_KEY is not configured");
                const response = await fetch("https://api.exa.ai/search", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": apiKey
                    },
                    body: JSON.stringify({
                        query,
                        numResults,
                        useAutoprompt: true
                    })
                });
                if (!response.ok) throw new Error(`Exa search failed: ${response.status}`);
                const data = (await response.json()) as {
                    results: Array<Record<string, unknown>>;
                };
                const results = (data.results || []).map((r) => ({
                    title: (r.title as string) || "",
                    url: (r.url as string) || "",
                    description: (r.text as string)?.substring(0, 300) || "",
                    score: r.score as number | undefined
                }));
                return { provider: "exa", results, resultCount: results.length };
            }

            case "brave": {
                const apiKey = process.env.BRAVE_SEARCH_API_KEY;
                if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY is not configured");
                const url = new URL("https://api.search.brave.com/res/v1/web/search");
                url.searchParams.set("q", query);
                url.searchParams.set("count", String(numResults));
                const response = await fetch(url.toString(), {
                    headers: {
                        Accept: "application/json",
                        "X-Subscription-Token": apiKey
                    }
                });
                if (!response.ok) throw new Error(`Brave search failed: ${response.status}`);
                const data = (await response.json()) as {
                    web: { results: Array<Record<string, unknown>> };
                };
                const results = (data.web?.results || []).map((r) => ({
                    title: (r.title as string) || "",
                    url: (r.url as string) || "",
                    description: (r.description as string) || "",
                    score: undefined
                }));
                return { provider: "brave", results, resultCount: results.length };
            }

            case "perplexity": {
                const apiKey = process.env.PERPLEXITY_API_KEY;
                if (!apiKey) throw new Error("PERPLEXITY_API_KEY is not configured");
                const response = await fetch("https://api.perplexity.ai/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: "sonar",
                        messages: [{ role: "user", content: query }],
                        return_citations: true,
                        max_tokens: 2048
                    })
                });
                if (!response.ok) throw new Error(`Perplexity search failed: ${response.status}`);
                const data = (await response.json()) as {
                    choices: Array<{ message: { content: string } }>;
                    citations?: string[];
                };
                const answer = data.choices?.[0]?.message?.content || "";
                const citations = data.citations || [];
                const results = citations.map((url, i) => ({
                    title: `Source ${i + 1}`,
                    url,
                    description: "",
                    score: undefined
                }));
                return {
                    provider: "perplexity",
                    results,
                    resultCount: results.length,
                    synthesizedAnswer: answer
                };
            }

            case "firecrawl": {
                const apiKey = process.env.FIRECRAWL_API_KEY;
                if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");
                const response = await fetch("https://api.firecrawl.dev/v1/search", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({ query, limit: numResults })
                });
                if (!response.ok) throw new Error(`Firecrawl search failed: ${response.status}`);
                const data = (await response.json()) as {
                    data: Array<Record<string, unknown>>;
                };
                const rawResults = Array.isArray(data.data) ? data.data : [];
                const results = rawResults.map((r) => ({
                    title: (r.title as string) || "",
                    url: (r.url as string) || "",
                    description: (r.description as string) || (r.snippet as string) || "",
                    score: undefined
                }));
                return { provider: "firecrawl", results, resultCount: results.length };
            }

            default:
                throw new Error(`Unknown search provider: ${provider}`);
        }
    }
});
