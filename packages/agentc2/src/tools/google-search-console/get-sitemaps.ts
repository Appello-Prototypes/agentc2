/**
 * Google Search Console — Get Sitemaps Tool
 *
 * Lists all sitemaps submitted for a site, including their status and error counts.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callGscApi, GSC_SCOPES, checkGoogleScopes, resolveGmailAddress } from "./shared";

async function gscScopeError(address: string, status: number) {
    const scopeCheck = await checkGoogleScopes(address, GSC_SCOPES);
    return scopeCheck.ok
        ? `GSC API error (${status}). Check API access or re-authorize.`
        : `Google Search Console requires scope: ${scopeCheck.missing.join(", ")}. Re-authorize Google OAuth.`;
}

type GscSitemap = {
    path?: string;
    lastSubmitted?: string;
    isPending?: boolean;
    isSitemapsIndex?: boolean;
    type?: string;
    lastDownloaded?: string;
    warnings?: string;
    errors?: string;
    contents?: Array<{
        type?: string;
        submitted?: string;
        indexed?: string;
    }>;
};

type GscSitemapListResponse = {
    sitemap?: GscSitemap[];
};

export const gscGetSitemapsTool = createTool({
    id: "gsc-get-sitemaps",
    description:
        "List all sitemaps submitted to Google Search Console for a site. Returns sitemap URLs, submission status, error counts, and content type breakdown (web pages, images, etc.).",
    inputSchema: z.object({
        siteUrl: z
            .string()
            .describe(
                "The site URL as registered in GSC (e.g., 'https://agentc2.ai/' or 'sc-domain:agentc2.ai')"
            ),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        sitemaps: z.array(
            z.object({
                path: z.string(),
                lastSubmitted: z.string(),
                isPending: z.boolean(),
                isSitemapsIndex: z.boolean(),
                type: z.string(),
                warnings: z.string(),
                errors: z.string(),
                contents: z.array(
                    z.object({
                        type: z.string(),
                        submitted: z.string(),
                        indexed: z.string()
                    })
                )
            })
        ),
        error: z.string().optional()
    }),
    execute: async ({ siteUrl, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            const encodedSite = encodeURIComponent(siteUrl);
            const response = await callGscApi(
                address,
                `/webmasters/v3/sites/${encodedSite}/sitemaps`
            );

            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    sitemaps: [],
                    error: await gscScopeError(address, response.status)
                };
            }

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    sitemaps: [],
                    error: `GSC API error (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as GscSitemapListResponse;
            const sitemaps = (data.sitemap || []).map((sm) => ({
                path: sm.path || "",
                lastSubmitted: sm.lastSubmitted || "",
                isPending: sm.isPending || false,
                isSitemapsIndex: sm.isSitemapsIndex || false,
                type: sm.type || "",
                warnings: sm.warnings || "0",
                errors: sm.errors || "0",
                contents: (sm.contents || []).map((c) => ({
                    type: c.type || "",
                    submitted: c.submitted || "0",
                    indexed: c.indexed || "0"
                }))
            }));

            return { success: true, sitemaps };
        } catch (error) {
            return {
                success: false,
                sitemaps: [],
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
