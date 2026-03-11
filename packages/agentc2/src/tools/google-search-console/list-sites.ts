/**
 * Google Search Console — List Sites Tool
 *
 * Lists all verified properties (sites) the authenticated user has access to.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callGscApi, GSC_SCOPES, checkGoogleScopes, resolveGmailAddress } from "./shared";

type GscSite = {
    siteUrl?: string;
    permissionLevel?: string;
};

type GscSiteListResponse = {
    siteEntry?: GscSite[];
};

export const gscListSitesTool = createTool({
    id: "gsc-list-sites",
    description:
        "List all Google Search Console properties (sites) the authenticated user has access to. Returns site URLs and permission levels. Use this to discover which sites are available for analytics queries.",
    inputSchema: z.object({
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        sites: z.array(
            z.object({
                siteUrl: z.string(),
                permissionLevel: z.string()
            })
        ),
        error: z.string().optional()
    }),
    execute: async ({ gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            const scopeCheck = await checkGoogleScopes(address, GSC_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    sites: [],
                    error: `Google Search Console requires scope: ${scopeCheck.missing.join(", ")}. Re-authorize Google OAuth.`
                };
            }

            const response = await callGscApi(address, "/webmasters/v3/sites");

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    sites: [],
                    error: `GSC API error (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as GscSiteListResponse;
            const sites = (data.siteEntry || []).map((site) => ({
                siteUrl: site.siteUrl || "",
                permissionLevel: site.permissionLevel || ""
            }));

            return { success: true, sites };
        } catch (error) {
            return {
                success: false,
                sites: [],
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
