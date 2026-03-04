import { NextRequest, NextResponse } from "next/server";
import {
    getParamsForProvider,
    getProvidersWithParams,
    SHARED_PARAMS
} from "@repo/agentc2/agents/model-params";

/**
 * GET /api/models/params
 *
 * Returns the provider parameter schema for dynamic UI rendering.
 *
 * Query parameters:
 *   - provider: Provider name (e.g., "anthropic", "openai")
 *   - model:    Optional model name to filter model-specific params
 *
 * Without a provider, returns all providers that have param schemas.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const model = searchParams.get("model") ?? undefined;

    if (!provider) {
        return NextResponse.json({
            success: true,
            providers: getProvidersWithParams(),
            shared: SHARED_PARAMS
        });
    }

    const groups = getParamsForProvider(provider, model);

    return NextResponse.json({
        success: true,
        provider,
        model: model ?? null,
        groups,
        shared: SHARED_PARAMS
    });
}
