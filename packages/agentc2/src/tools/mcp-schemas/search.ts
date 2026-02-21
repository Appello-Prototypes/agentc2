import { McpToolDefinition, McpToolRoute } from "./types";

export const searchToolDefinitions: McpToolDefinition[] = [
    {
        name: "exa-search",
        description:
            "Search the web using Exa's neural search engine (95% factual accuracy). Returns structured results.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "The search query" },
                numResults: {
                    type: "number",
                    description: "Number of results to return (default: 10)"
                },
                type: {
                    type: "string",
                    enum: ["auto", "keyword", "neural"],
                    description: "Search type"
                },
                useAutoprompt: {
                    type: "boolean",
                    description: "Let Exa optimize the query"
                },
                includeText: {
                    type: "boolean",
                    description: "Include full text content of results"
                },
                startPublishedDate: {
                    type: "string",
                    description: "Filter results published after this date (YYYY-MM-DD)"
                },
                endPublishedDate: {
                    type: "string",
                    description: "Filter results published before this date (YYYY-MM-DD)"
                }
            },
            required: ["query"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    },
    {
        name: "exa-find-similar",
        description: "Find web pages similar to a given URL.",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string", description: "The URL to find similar pages for" },
                numResults: { type: "number", description: "Number of similar results" },
                includeText: { type: "boolean", description: "Include full text content" }
            },
            required: ["url"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    },
    {
        name: "exa-get-contents",
        description: "Extract clean text content from one or more URLs.",
        inputSchema: {
            type: "object",
            properties: {
                urls: {
                    type: "array",
                    items: { type: "string" },
                    description: "URLs to extract content from"
                },
                maxCharacters: {
                    type: "number",
                    description: "Maximum characters per result"
                }
            },
            required: ["urls"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    },
    {
        name: "exa-research",
        description:
            "Research a topic by running multiple search queries in parallel and combining results.",
        inputSchema: {
            type: "object",
            properties: {
                queries: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of search queries (1-5)"
                },
                numResultsPerQuery: {
                    type: "number",
                    description: "Results per query"
                },
                includeText: { type: "boolean", description: "Include full text" }
            },
            required: ["queries"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    },
    {
        name: "brave-search",
        description: "Fast web search using Brave Search (sub-second latency).",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "The search query" },
                count: { type: "number", description: "Number of results (max 20)" },
                freshness: {
                    type: "string",
                    enum: ["pd", "pw", "pm", "py"],
                    description: "Freshness filter"
                },
                country: { type: "string", description: "Country code for localized results" }
            },
            required: ["query"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    },
    {
        name: "brave-local-search",
        description: "Search for local businesses and points of interest.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Local search query" },
                count: { type: "number", description: "Number of results" }
            },
            required: ["query"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    },
    {
        name: "brave-news-search",
        description: "Search for recent news articles.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "News search query" },
                count: { type: "number", description: "Number of results" },
                freshness: {
                    type: "string",
                    enum: ["pd", "pw", "pm"],
                    description: "Freshness filter"
                }
            },
            required: ["query"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    },
    {
        name: "perplexity-research",
        description:
            "Get a comprehensive, AI-synthesized research answer with citations using Perplexity Sonar.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "The research question" }
            },
            required: ["query"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    },
    {
        name: "perplexity-search",
        description: "Quick web search with a concise AI-synthesized answer and source citations.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "The search question" }
            },
            required: ["query"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    },
    {
        name: "smart-search",
        description:
            "Intelligent search that auto-routes to the best provider: Exa (accuracy), Brave (speed), Perplexity (synthesis), or Firecrawl (scraping).",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "The search query" },
                provider: {
                    type: "string",
                    enum: ["auto", "exa", "brave", "perplexity", "firecrawl"],
                    description: "Force a specific provider or auto"
                },
                numResults: { type: "number", description: "Number of results" }
            },
            required: ["query"]
        },
        invoke_url: "/api/mcp",
        category: "search"
    }
];

export const searchToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "exa-search" },
    { kind: "registry", name: "exa-find-similar" },
    { kind: "registry", name: "exa-get-contents" },
    { kind: "registry", name: "exa-research" },
    { kind: "registry", name: "brave-search" },
    { kind: "registry", name: "brave-local-search" },
    { kind: "registry", name: "brave-news-search" },
    { kind: "registry", name: "perplexity-research" },
    { kind: "registry", name: "perplexity-search" },
    { kind: "registry", name: "smart-search" }
];
