/**
 * Playwright Fallback Client
 *
 * Playwright requires browser automation which cannot run in serverless environments.
 * This client provides limited functionality via external browser-as-a-service APIs
 * like Browserless.io, or indicates that full Playwright support requires local/VM deployment.
 *
 * For full Playwright support, deploy to a traditional server environment.
 */

import type {
    McpApiClient,
    ToolExecutionContext,
    ToolResult,
    UnifiedToolDefinition
} from "../types";

/**
 * Playwright API Client for serverless environments
 *
 * Limited functionality - full browser automation requires non-serverless deployment.
 * This client can integrate with browser-as-a-service APIs for basic functionality.
 */
export class PlaywrightApiClient implements McpApiClient {
    serverId = "playwright";
    private browserlessToken: string | undefined;
    private browserlessUrl: string;

    constructor() {
        // Optional: Support Browserless.io as a fallback
        this.browserlessToken = process.env.BROWSERLESS_TOKEN;
        this.browserlessUrl = process.env.BROWSERLESS_URL || "https://chrome.browserless.io";
    }

    /**
     * Playwright is always "configured" as it doesn't require auth,
     * but may have limited functionality in serverless.
     */
    isConfigured(): boolean {
        return true;
    }

    /**
     * Check if we have a browser service configured for fallback
     */
    hasBrowserService(): boolean {
        return !!this.browserlessToken;
    }

    async listTools(): Promise<UnifiedToolDefinition[]> {
        const tools: UnifiedToolDefinition[] = [
            {
                name: "playwright-screenshot",
                description: "Take a screenshot of a URL (uses browser service in serverless)",
                serverId: this.serverId,
                parameters: {
                    url: { type: "string", description: "URL to screenshot", required: true },
                    fullPage: { type: "boolean", description: "Capture full page" },
                    width: { type: "number", description: "Viewport width" },
                    height: { type: "number", description: "Viewport height" }
                },
                hasApiFallback: this.hasBrowserService()
            },
            {
                name: "playwright-pdf",
                description: "Generate PDF from a URL (uses browser service in serverless)",
                serverId: this.serverId,
                parameters: {
                    url: { type: "string", description: "URL to convert to PDF", required: true },
                    format: { type: "string", description: "Page format (A4, Letter, etc.)" }
                },
                hasApiFallback: this.hasBrowserService()
            },
            {
                name: "playwright-scrape",
                description: "Scrape content from a URL (uses browser service in serverless)",
                serverId: this.serverId,
                parameters: {
                    url: { type: "string", description: "URL to scrape", required: true },
                    selector: { type: "string", description: "CSS selector to extract" },
                    waitFor: { type: "string", description: "Selector to wait for before scraping" }
                },
                hasApiFallback: this.hasBrowserService()
            }
        ];

        // Add warning tools if no browser service
        if (!this.hasBrowserService()) {
            tools.push({
                name: "playwright-navigate",
                description:
                    "Navigate to URL (NOT AVAILABLE in serverless - requires local deployment or BROWSERLESS_TOKEN)",
                serverId: this.serverId,
                parameters: {
                    url: { type: "string", description: "URL to navigate to" }
                },
                hasApiFallback: false
            });
        }

        return tools;
    }

    async executeTool(toolName: string, params: ToolExecutionContext): Promise<ToolResult> {
        const startTime = Date.now();

        // Check if browser service is available
        if (!this.hasBrowserService()) {
            return {
                success: false,
                error:
                    "Playwright browser automation is not available in serverless environments. " +
                    "To enable limited functionality, configure BROWSERLESS_TOKEN for browser-as-a-service. " +
                    "For full Playwright support, deploy to a traditional server environment.",
                metadata: {
                    mode: "api",
                    executionTime: Date.now() - startTime,
                    serverId: this.serverId
                }
            };
        }

        try {
            let result: { success: boolean; data?: unknown; error?: string };

            switch (toolName) {
                case "playwright-screenshot":
                    result = await this.screenshot(params);
                    break;
                case "playwright-pdf":
                    result = await this.pdf(params);
                    break;
                case "playwright-scrape":
                    result = await this.scrape(params);
                    break;
                default:
                    result = {
                        success: false,
                        error: `Tool ${toolName} is not available in serverless mode. Deploy locally for full Playwright support.`
                    };
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

    private async screenshot(params: ToolExecutionContext) {
        const response = await fetch(
            `${this.browserlessUrl}/screenshot?token=${this.browserlessToken}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: params.url,
                    options: {
                        fullPage: params.fullPage || false
                    },
                    viewport: {
                        width: (params.width as number) || 1920,
                        height: (params.height as number) || 1080
                    }
                })
            }
        );

        if (!response.ok) {
            return { success: false, error: `Screenshot failed: ${response.statusText}` };
        }

        // Return base64 encoded image
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        return {
            success: true,
            data: {
                image: `data:image/png;base64,${base64}`,
                url: params.url
            }
        };
    }

    private async pdf(params: ToolExecutionContext) {
        const response = await fetch(`${this.browserlessUrl}/pdf?token=${this.browserlessToken}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: params.url,
                options: {
                    format: (params.format as string) || "A4"
                }
            })
        });

        if (!response.ok) {
            return { success: false, error: `PDF generation failed: ${response.statusText}` };
        }

        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        return {
            success: true,
            data: {
                pdf: `data:application/pdf;base64,${base64}`,
                url: params.url
            }
        };
    }

    private async scrape(params: ToolExecutionContext) {
        const response = await fetch(
            `${this.browserlessUrl}/content?token=${this.browserlessToken}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: params.url,
                    waitFor: params.waitFor
                })
            }
        );

        if (!response.ok) {
            return { success: false, error: `Scrape failed: ${response.statusText}` };
        }

        const html = await response.text();
        return {
            success: true,
            data: {
                html,
                url: params.url
            }
        };
    }
}

export const playwrightApiClient = new PlaywrightApiClient();
