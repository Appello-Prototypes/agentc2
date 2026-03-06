import { McpToolDefinition, McpToolRoute } from "./types";

export const aiModelToolDefinitions: McpToolDefinition[] = [
    {
        name: "ai-models-list",
        description:
            "List available AI models from all configured providers. " +
            "Returns models grouped by provider with connection status. " +
            "Use 'provider' to filter to a single provider. Use 'refresh' to bust the cache.",
        inputSchema: {
            type: "object",
            properties: {
                provider: {
                    type: "string",
                    enum: [
                        "openai",
                        "anthropic",
                        "google",
                        "groq",
                        "mistral",
                        "xai",
                        "deepseek",
                        "togetherai",
                        "fireworks",
                        "openrouter",
                        "kimi"
                    ],
                    description: "Filter to a single provider. Omit to list all."
                },
                refresh: {
                    type: "boolean",
                    description: "Bust the cache and re-fetch live from APIs (default: false)"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    },
    {
        name: "ai-models-test",
        description:
            "Test connectivity to one or more AI models by sending a minimal prompt and measuring latency. " +
            "Verifies the org's API key works and the model responds. " +
            "Pass a single provider to test its default model, a specific model ID, or 'all' to test every configured provider. " +
            "Returns per-model results: status (ok/error), latency_ms, model response snippet, and error details.",
        inputSchema: {
            type: "object",
            properties: {
                provider: {
                    type: "string",
                    enum: [
                        "openai",
                        "anthropic",
                        "google",
                        "groq",
                        "mistral",
                        "xai",
                        "deepseek",
                        "togetherai",
                        "fireworks",
                        "openrouter",
                        "kimi",
                        "all"
                    ],
                    description:
                        "Provider to test, or 'all' to test every provider with a configured API key."
                },
                modelId: {
                    type: "string",
                    description:
                        "Specific model ID to test (e.g. 'gpt-4o-mini', 'claude-sonnet-4-20250514'). " +
                        "If omitted, tests the provider's default/cheapest model."
                },
                prompt: {
                    type: "string",
                    description:
                        "Custom test prompt (default: 'Say hello in exactly 3 words.'). Keep it short to minimize cost."
                }
            },
            required: ["provider"]
        },
        invoke_url: "/api/mcp",
        category: "integrations"
    }
];

export const aiModelToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "ai-models-list",
        method: "GET",
        path: "/api/models",
        queryParams: ["provider", "refresh"]
    },
    {
        kind: "internal",
        name: "ai-models-test",
        method: "POST",
        path: "/api/models/test",
        bodyParams: ["provider", "modelId", "prompt"]
    }
];
