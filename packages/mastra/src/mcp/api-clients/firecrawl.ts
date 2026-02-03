/**
 * Firecrawl Direct API Client
 *
 * Provides direct API access to Firecrawl when MCP stdio transport is unavailable.
 * Mirrors the functionality of the firecrawl-mcp server.
 */

import type {
    McpApiClient,
    ToolExecutionContext,
    ToolResult,
    UnifiedToolDefinition
} from "../types";

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v1";

/**
 * Firecrawl API Client for serverless environments
 */
export class FirecrawlApiClient implements McpApiClient {
    serverId = "firecrawl";
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = process.env.FIRECRAWL_API_KEY;
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    private async apiRequest(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<{ success: boolean; data?: unknown; error?: string }> {
        if (!this.apiKey) {
            return { success: false, error: "FIRECRAWL_API_KEY not configured" };
        }

        try {
            const response = await fetch(`${FIRECRAWL_API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `Firecrawl API error ${response.status}: ${errorText}`
                };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async listTools(): Promise<UnifiedToolDefinition[]> {
        return [
            {
                name: "firecrawl-scrape",
                description: "Scrape a single URL and extract its content",
                serverId: this.serverId,
                parameters: {
                    url: { type: "string", description: "URL to scrape", required: true },
                    formats: {
                        type: "array",
                        description: "Output formats: markdown, html, rawHtml, links, screenshot"
                    },
                    onlyMainContent: {
                        type: "boolean",
                        description: "Extract only main content"
                    },
                    includeTags: { type: "array", description: "HTML tags to include" },
                    excludeTags: { type: "array", description: "HTML tags to exclude" },
                    waitFor: { type: "number", description: "Wait time in ms before scraping" }
                },
                hasApiFallback: true
            },
            {
                name: "firecrawl-crawl",
                description: "Crawl a website starting from a URL",
                serverId: this.serverId,
                parameters: {
                    url: { type: "string", description: "Starting URL", required: true },
                    maxDepth: { type: "number", description: "Maximum crawl depth" },
                    limit: { type: "number", description: "Maximum pages to crawl" },
                    includePaths: { type: "array", description: "URL paths to include" },
                    excludePaths: { type: "array", description: "URL paths to exclude" }
                },
                hasApiFallback: true
            },
            {
                name: "firecrawl-map",
                description: "Get a sitemap/list of URLs from a website",
                serverId: this.serverId,
                parameters: {
                    url: { type: "string", description: "Website URL", required: true },
                    search: { type: "string", description: "Search query to filter URLs" },
                    limit: { type: "number", description: "Maximum URLs to return" }
                },
                hasApiFallback: true
            },
            {
                name: "firecrawl-crawl-status",
                description: "Check the status of a crawl job",
                serverId: this.serverId,
                parameters: {
                    jobId: { type: "string", description: "Crawl job ID", required: true }
                },
                hasApiFallback: true
            },
            {
                name: "firecrawl-cancel-crawl",
                description: "Cancel a running crawl job",
                serverId: this.serverId,
                parameters: {
                    jobId: { type: "string", description: "Crawl job ID", required: true }
                },
                hasApiFallback: true
            }
        ];
    }

    async executeTool(toolName: string, params: ToolExecutionContext): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            let result: { success: boolean; data?: unknown; error?: string };

            switch (toolName) {
                case "firecrawl-scrape":
                    result = await this.scrape(params);
                    break;
                case "firecrawl-crawl":
                    result = await this.crawl(params);
                    break;
                case "firecrawl-map":
                    result = await this.map(params);
                    break;
                case "firecrawl-crawl-status":
                    result = await this.getCrawlStatus(params.jobId as string);
                    break;
                case "firecrawl-cancel-crawl":
                    result = await this.cancelCrawl(params.jobId as string);
                    break;
                default:
                    result = { success: false, error: `Unknown tool: ${toolName}` };
            }

            return {
                ...result,
                metadata: {
                    mode: "api",
                    executionTime: Date.now() - startTime,
                    serverId: this.serverId
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                metadata: {
                    mode: "api",
                    executionTime: Date.now() - startTime,
                    serverId: this.serverId
                }
            };
        }
    }

    private async scrape(params: ToolExecutionContext) {
        const body: Record<string, unknown> = {
            url: params.url
        };

        if (params.formats) body.formats = params.formats;
        if (params.onlyMainContent !== undefined) body.onlyMainContent = params.onlyMainContent;
        if (params.includeTags) body.includeTags = params.includeTags;
        if (params.excludeTags) body.excludeTags = params.excludeTags;
        if (params.waitFor) body.waitFor = params.waitFor;

        return this.apiRequest("/scrape", {
            method: "POST",
            body: JSON.stringify(body)
        });
    }

    private async crawl(params: ToolExecutionContext) {
        const body: Record<string, unknown> = {
            url: params.url
        };

        if (params.maxDepth) body.maxDepth = params.maxDepth;
        if (params.limit) body.limit = params.limit;
        if (params.includePaths) body.includePaths = params.includePaths;
        if (params.excludePaths) body.excludePaths = params.excludePaths;

        return this.apiRequest("/crawl", {
            method: "POST",
            body: JSON.stringify(body)
        });
    }

    private async map(params: ToolExecutionContext) {
        const body: Record<string, unknown> = {
            url: params.url
        };

        if (params.search) body.search = params.search;
        if (params.limit) body.limit = params.limit;

        return this.apiRequest("/map", {
            method: "POST",
            body: JSON.stringify(body)
        });
    }

    private async getCrawlStatus(jobId: string) {
        return this.apiRequest(`/crawl/${jobId}`);
    }

    private async cancelCrawl(jobId: string) {
        return this.apiRequest(`/crawl/${jobId}`, {
            method: "DELETE"
        });
    }
}

export const firecrawlApiClient = new FirecrawlApiClient();
