/**
 * Google Drive Search Files Tool
 *
 * Searches Google Drive files by name, content, or type.
 * Uses the same Google OAuth credentials as Gmail (requires drive.readonly scope).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    callDriveApi,
    DRIVE_API,
    DRIVE_READ_SCOPES,
    checkGoogleScopes,
    resolveGmailAddress
} from "./shared";

type DriveFile = {
    id?: string;
    name?: string;
    mimeType?: string;
    modifiedTime?: string;
    webViewLink?: string;
    owners?: Array<{ displayName?: string; emailAddress?: string }>;
    size?: string;
};

type DriveListResponse = {
    files?: DriveFile[];
    nextPageToken?: string;
};

export const googleDriveSearchFilesTool = createTool({
    id: "google-drive-search-files",
    description:
        "Search Google Drive files by name, content, or type. Returns matching files with names, types, modification dates, and view links. Use Drive query syntax in the query parameter (e.g., \"name contains 'report'\" or \"mimeType='application/vnd.google-apps.document'\").",
    inputSchema: z.object({
        query: z
            .string()
            .describe(
                "Drive search query. Examples: \"name contains 'quarterly report'\", \"fullText contains 'budget'\", \"mimeType='application/vnd.google-apps.document'\". See Google Drive API query syntax."
            ),
        maxResults: z
            .number()
            .min(1)
            .max(50)
            .default(10)
            .describe("Maximum number of results (1-50, default 10)"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        files: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                mimeType: z.string(),
                modifiedTime: z.string(),
                webViewLink: z.string(),
                owner: z.string()
            })
        ),
        totalFound: z.number(),
        error: z.string().optional()
    }),
    execute: async ({ query, maxResults, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            // Pre-flight scope check
            const scopeCheck = await checkGoogleScopes(address, DRIVE_READ_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    files: [],
                    totalFound: 0,
                    error:
                        `Google Drive requires scope: ${scopeCheck.missing.join(", ")}. ` +
                        `Re-authorize Google OAuth to grant Drive access.`
                };
            }

            const response = await callDriveApi(address, DRIVE_API, "/files", {
                params: {
                    q: `${query} and trashed = false`,
                    pageSize: String(maxResults || 10),
                    fields: "files(id,name,mimeType,modifiedTime,webViewLink,owners,size),nextPageToken",
                    orderBy: "modifiedTime desc"
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 403 || response.status === 401) {
                    return {
                        success: false,
                        files: [],
                        totalFound: 0,
                        error: `Drive access denied (${response.status}). The Google OAuth token may need Drive scopes. Details: ${errorText}`
                    };
                }
                return {
                    success: false,
                    files: [],
                    totalFound: 0,
                    error: `Drive API error (${response.status}): ${errorText}`
                };
            }

            const data = (await response.json()) as DriveListResponse;
            const files = (data.files || []).map((file) => ({
                id: file.id || "",
                name: file.name || "(untitled)",
                mimeType: file.mimeType || "",
                modifiedTime: file.modifiedTime || "",
                webViewLink: file.webViewLink || "",
                owner: file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || ""
            }));

            return {
                success: true,
                files,
                totalFound: files.length
            };
        } catch (error) {
            return {
                success: false,
                files: [],
                totalFound: 0,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
