import { prisma } from "@repo/database";

export interface MarkupResult {
    platformCostUsd: number;
    billedCostUsd: number;
    markupMultiplier: number;
}

const markupCache = new Map<string, { rate: number; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Look up the platform markup rate for a given provider/model.
 * Falls back to the org subscription's plan markup, then a global default of 2x.
 */
export async function getPlatformMarkupRate(
    provider: string,
    modelName: string,
    orgMarkup?: number | null
): Promise<number> {
    const cacheKey = `${provider}:${modelName}`;
    const cached = markupCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
        return cached.rate;
    }

    const record = await prisma.platformMarkup.findUnique({
        where: { provider_modelName: { provider, modelName } }
    });

    if (record?.isActive) {
        markupCache.set(cacheKey, {
            rate: record.defaultMarkup,
            expiry: Date.now() + CACHE_TTL_MS
        });
        return record.defaultMarkup;
    }

    return orgMarkup ?? 2.0;
}

/**
 * Apply markup to a raw API cost.
 */
export function calculateMarkup(apiCostUsd: number, markupMultiplier: number): MarkupResult {
    return {
        platformCostUsd: Math.round(apiCostUsd * 1_000_000) / 1_000_000,
        billedCostUsd: Math.round(apiCostUsd * markupMultiplier * 1_000_000) / 1_000_000,
        markupMultiplier
    };
}

/**
 * Convenience: calculate the billed cost given raw token counts.
 * Uses the same pricing table as cost-calculator but applies markup.
 */
export async function calculateBilledCost(
    apiCostUsd: number,
    provider: string,
    modelName: string,
    orgMarkup?: number | null
): Promise<MarkupResult> {
    const rate = await getPlatformMarkupRate(provider, modelName, orgMarkup);
    return calculateMarkup(apiCostUsd, rate);
}
