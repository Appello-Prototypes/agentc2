import { NextRequest, NextResponse } from "next/server";
import { getModelsForApi, clearModelCache } from "@repo/mastra/agents/model-registry";
import type { ModelProvider } from "@repo/mastra/agents/model-registry";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * GET /api/models
 *
 * Returns the list of available AI models, dynamically fetched from
 * OpenAI and Anthropic APIs with in-memory caching (1hr TTL).
 *
 * Query parameters:
 *   - provider: Filter to a single provider ("openai" | "anthropic" | "google")
 *   - refresh:  When "true", bust the cache and re-fetch from APIs
 *
 * Uses org-scoped API keys when the request is authenticated.
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await authenticateRequest(request);
        const organizationId = authContext?.organizationId ?? null;

        const { searchParams } = new URL(request.url);
        const providerParam = searchParams.get("provider") as ModelProvider | null;
        const forceRefresh = searchParams.get("refresh") === "true";

        if (forceRefresh) {
            clearModelCache();
        }

        const validProviders: ModelProvider[] = ["openai", "anthropic", "google"];
        const provider =
            providerParam && validProviders.includes(providerParam) ? providerParam : null;

        const models = await getModelsForApi(organizationId, provider, forceRefresh);

        return NextResponse.json({
            success: true,
            models,
            count: models.length,
            cached: !forceRefresh
        });
    } catch (error) {
        console.error("[Models API] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch models"
            },
            { status: 500 }
        );
    }
}
