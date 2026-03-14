/**
 * Google Search Console — Inspect URL Tool
 *
 * Checks the indexing status of a specific URL using the URL Inspection API.
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

type InspectionResult = {
    inspectionResult?: {
        inspectionResultLink?: string;
        indexStatusResult?: {
            verdict?: string;
            coverageState?: string;
            robotsTxtState?: string;
            indexingState?: string;
            lastCrawlTime?: string;
            pageFetchState?: string;
            googleCanonical?: string;
            userCanonical?: string;
            referringUrls?: string[];
            crawledAs?: string;
        };
        mobileUsabilityResult?: {
            verdict?: string;
            issues?: Array<{ issueType?: string; severity?: string; message?: string }>;
        };
        richResultsResult?: {
            verdict?: string;
            detectedItems?: Array<{
                richResultType?: string;
                items?: Array<{
                    name?: string;
                    issues?: Array<{ issueMessage?: string; severity?: string }>;
                }>;
            }>;
        };
    };
};

export const gscInspectUrlTool = createTool({
    id: "gsc-inspect-url",
    description:
        "Inspect a specific URL in Google Search Console. Returns indexing status, crawl info, mobile usability, and rich results status. Use to check if a page is indexed, diagnose crawl issues, or verify structured data.",
    inputSchema: z.object({
        inspectionUrl: z
            .string()
            .describe(
                "The fully-qualified URL to inspect (e.g., 'https://agentc2.ai/blog/my-post')"
            ),
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
        indexStatus: z
            .object({
                verdict: z.string(),
                coverageState: z.string(),
                robotsTxtState: z.string(),
                indexingState: z.string(),
                lastCrawlTime: z.string(),
                pageFetchState: z.string(),
                googleCanonical: z.string(),
                userCanonical: z.string(),
                crawledAs: z.string()
            })
            .optional(),
        mobileUsability: z
            .object({
                verdict: z.string(),
                issues: z.array(
                    z.object({
                        issueType: z.string(),
                        severity: z.string(),
                        message: z.string()
                    })
                )
            })
            .optional(),
        richResults: z
            .object({
                verdict: z.string(),
                detectedItems: z.array(
                    z.object({
                        richResultType: z.string()
                    })
                )
            })
            .optional(),
        error: z.string().optional()
    }),
    execute: async ({ inspectionUrl, siteUrl, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            const response = await callGscApi(address, "/v1/urlInspection/index:inspect", {
                method: "POST",
                body: {
                    inspectionUrl,
                    siteUrl
                }
            });

            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    error: await gscScopeError(address, response.status)
                };
            }

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `GSC URL Inspection API error (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as InspectionResult;
            const result = data.inspectionResult;

            const idx = result?.indexStatusResult;
            const mob = result?.mobileUsabilityResult;
            const rich = result?.richResultsResult;

            return {
                success: true,
                indexStatus: idx
                    ? {
                          verdict: idx.verdict || "",
                          coverageState: idx.coverageState || "",
                          robotsTxtState: idx.robotsTxtState || "",
                          indexingState: idx.indexingState || "",
                          lastCrawlTime: idx.lastCrawlTime || "",
                          pageFetchState: idx.pageFetchState || "",
                          googleCanonical: idx.googleCanonical || "",
                          userCanonical: idx.userCanonical || "",
                          crawledAs: idx.crawledAs || ""
                      }
                    : undefined,
                mobileUsability: mob
                    ? {
                          verdict: mob.verdict || "",
                          issues: (mob.issues || []).map((i) => ({
                              issueType: i.issueType || "",
                              severity: i.severity || "",
                              message: i.message || ""
                          }))
                      }
                    : undefined,
                richResults: rich
                    ? {
                          verdict: rich.verdict || "",
                          detectedItems: (rich.detectedItems || []).map((d) => ({
                              richResultType: d.richResultType || ""
                          }))
                      }
                    : undefined
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
