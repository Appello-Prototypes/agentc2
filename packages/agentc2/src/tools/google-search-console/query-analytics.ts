/**
 * Google Search Console — Query Analytics Tool
 *
 * Queries the Search Analytics API for keyword performance data:
 * impressions, clicks, CTR, and average position.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callGscApi, GSC_SCOPES, checkGoogleScopes, resolveGmailAddress } from "./shared";

type SearchAnalyticsRow = {
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
};

type SearchAnalyticsResponse = {
    rows?: SearchAnalyticsRow[];
    responseAggregationType?: string;
};

export const gscQueryAnalyticsTool = createTool({
    id: "gsc-query-analytics",
    description:
        "Query Google Search Console search analytics for keyword performance data. Returns impressions, clicks, CTR, and average position per keyword/page. Use to measure SEO performance, identify ranking keywords, and track position changes.",
    inputSchema: z.object({
        siteUrl: z
            .string()
            .describe(
                "The site URL as registered in GSC (e.g., 'https://agentc2.ai/' or 'sc-domain:agentc2.ai')"
            ),
        startDate: z.string().describe("Start date in YYYY-MM-DD format (e.g., '2025-01-01')"),
        endDate: z.string().describe("End date in YYYY-MM-DD format (e.g., '2025-03-01')"),
        dimensions: z
            .array(z.enum(["query", "page", "country", "device", "date"]))
            .default(["query"])
            .describe("Dimensions to group by. Common: ['query'], ['query', 'page'], ['page']"),
        rowLimit: z
            .number()
            .min(1)
            .max(25000)
            .default(100)
            .describe("Maximum rows to return (1-25000, default 100)"),
        startRow: z.number().min(0).default(0).describe("Offset for pagination (default 0)"),
        dimensionFilterGroups: z
            .array(
                z.object({
                    filters: z.array(
                        z.object({
                            dimension: z.enum(["query", "page", "country", "device"]),
                            operator: z.enum([
                                "equals",
                                "notEquals",
                                "contains",
                                "notContains",
                                "includingRegex",
                                "excludingRegex"
                            ]),
                            expression: z.string()
                        })
                    )
                })
            )
            .optional()
            .describe(
                "Optional filters. Example: [{filters: [{dimension: 'query', operator: 'contains', expression: 'agentc2'}]}]"
            ),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        rows: z.array(
            z.object({
                keys: z.array(z.string()),
                clicks: z.number(),
                impressions: z.number(),
                ctr: z.number(),
                position: z.number()
            })
        ),
        totalRows: z.number(),
        error: z.string().optional()
    }),
    execute: async ({
        siteUrl,
        startDate,
        endDate,
        dimensions,
        rowLimit,
        startRow,
        dimensionFilterGroups,
        gmailAddress
    }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            const scopeCheck = await checkGoogleScopes(address, GSC_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    rows: [],
                    totalRows: 0,
                    error: `Google Search Console requires scope: ${scopeCheck.missing.join(", ")}. Re-authorize Google OAuth.`
                };
            }

            const encodedSite = encodeURIComponent(siteUrl);
            const body: Record<string, unknown> = {
                startDate,
                endDate,
                dimensions,
                rowLimit,
                startRow
            };
            if (dimensionFilterGroups) {
                body.dimensionFilterGroups = dimensionFilterGroups;
            }

            const response = await callGscApi(
                address,
                `/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
                { method: "POST", body }
            );

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    rows: [],
                    totalRows: 0,
                    error: `GSC API error (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as SearchAnalyticsResponse;
            const rows = (data.rows || []).map((row) => ({
                keys: row.keys || [],
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: Math.round((row.ctr || 0) * 10000) / 10000,
                position: Math.round((row.position || 0) * 100) / 100
            }));

            return {
                success: true,
                rows,
                totalRows: rows.length
            };
        } catch (error) {
            return {
                success: false,
                rows: [],
                totalRows: 0,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
