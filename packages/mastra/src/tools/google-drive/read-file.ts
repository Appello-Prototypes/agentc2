/**
 * Google Drive Read File Tool
 *
 * Reads the content of a Google Drive file. Exports Google Docs/Sheets/Slides
 * as text, or downloads other file types as raw content.
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

/** Google Workspace MIME types that can be exported. */
const EXPORT_MIME_MAP: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
    "application/vnd.google-apps.drawing": "image/svg+xml"
};

const MAX_CONTENT_LENGTH = 50_000; // ~50KB text limit to avoid token explosion

export const googleDriveReadFileTool = createTool({
    id: "google-drive-read-file",
    description:
        "Read the content of a Google Drive file. Google Docs are exported as plain text, Sheets as CSV, Slides as text. Other files are downloaded directly (text-based files only, truncated at 50KB). Use google-drive-search-files first to find the file ID.",
    inputSchema: z.object({
        fileId: z
            .string()
            .describe("The Google Drive file ID (get this from search-files results)"),
        gmailAddress: z
            .string()
            .default("")
            .describe("Google account email. Leave empty to auto-detect from connected account.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        fileName: z.string(),
        mimeType: z.string(),
        content: z.string(),
        truncated: z.boolean(),
        webViewLink: z.string(),
        error: z.string().optional()
    }),
    execute: async ({ fileId, gmailAddress }) => {
        const address = await resolveGmailAddress(gmailAddress);
        try {
            // Pre-flight scope check
            const scopeCheck = await checkGoogleScopes(address, DRIVE_READ_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    fileName: "",
                    mimeType: "",
                    content: "",
                    truncated: false,
                    webViewLink: "",
                    error:
                        `Google Drive requires scope: ${scopeCheck.missing.join(", ")}. ` +
                        `Re-authorize Google OAuth to grant Drive access.`
                };
            }

            // First get file metadata to determine type
            const metaResponse = await callDriveApi(address, DRIVE_API, `/files/${fileId}`, {
                params: {
                    fields: "id,name,mimeType,webViewLink,size"
                }
            });

            if (!metaResponse.ok) {
                const errorText = await metaResponse.text();
                return {
                    success: false,
                    fileName: "",
                    mimeType: "",
                    content: "",
                    truncated: false,
                    webViewLink: "",
                    error: `Failed to get file metadata (${metaResponse.status}): ${errorText}`
                };
            }

            const meta = (await metaResponse.json()) as {
                id: string;
                name: string;
                mimeType: string;
                webViewLink?: string;
                size?: string;
            };

            const exportMime = EXPORT_MIME_MAP[meta.mimeType];
            let content: string;

            if (exportMime) {
                // Google Workspace file — use export endpoint
                const exportResponse = await callDriveApi(
                    address,
                    DRIVE_API,
                    `/files/${fileId}/export`,
                    {
                        params: { mimeType: exportMime }
                    }
                );

                if (!exportResponse.ok) {
                    const errorText = await exportResponse.text();
                    return {
                        success: false,
                        fileName: meta.name,
                        mimeType: meta.mimeType,
                        content: "",
                        truncated: false,
                        webViewLink: meta.webViewLink || "",
                        error: `Failed to export file (${exportResponse.status}): ${errorText}`
                    };
                }

                content = await exportResponse.text();
            } else {
                // Regular file — download directly
                const fileSize = meta.size ? parseInt(meta.size, 10) : 0;
                if (fileSize > 10_000_000) {
                    return {
                        success: false,
                        fileName: meta.name,
                        mimeType: meta.mimeType,
                        content: "",
                        truncated: false,
                        webViewLink: meta.webViewLink || "",
                        error: `File is too large (${Math.round(fileSize / 1_000_000)}MB). Only files under 10MB can be read directly.`
                    };
                }

                const downloadResponse = await callDriveApi(
                    address,
                    DRIVE_API,
                    `/files/${fileId}`,
                    {
                        params: { alt: "media" }
                    }
                );

                if (!downloadResponse.ok) {
                    const errorText = await downloadResponse.text();
                    return {
                        success: false,
                        fileName: meta.name,
                        mimeType: meta.mimeType,
                        content: "",
                        truncated: false,
                        webViewLink: meta.webViewLink || "",
                        error: `Failed to download file (${downloadResponse.status}): ${errorText}`
                    };
                }

                content = await downloadResponse.text();
            }

            // Truncate if too long
            const truncated = content.length > MAX_CONTENT_LENGTH;
            if (truncated) {
                content = content.slice(0, MAX_CONTENT_LENGTH) + "\n\n... [content truncated]";
            }

            return {
                success: true,
                fileName: meta.name,
                mimeType: meta.mimeType,
                content,
                truncated,
                webViewLink: meta.webViewLink || ""
            };
        } catch (error) {
            return {
                success: false,
                fileName: "",
                mimeType: "",
                content: "",
                truncated: false,
                webViewLink: "",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
