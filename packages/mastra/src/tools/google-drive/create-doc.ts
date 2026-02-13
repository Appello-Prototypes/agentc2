/**
 * Google Drive Create Doc Tool
 *
 * Creates a new Google Doc in the user's Drive with the provided content.
 * Uses multipart upload to create the doc in a single request.
 * Requires drive.file scope (allows creating files the app owns).
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { callDriveApi, DRIVE_UPLOAD_API, DRIVE_WRITE_SCOPES, checkGoogleScopes } from "./shared";

export const googleDriveCreateDocTool = createTool({
    id: "google-drive-create-doc",
    description:
        "Create a new Google Doc in the user's Drive. Provide a title and text content. Returns a link to the created document that the user can open immediately. Useful for producing reports, summaries, analyses, or any structured output the user wants to keep.",
    inputSchema: z.object({
        title: z.string().describe("Title of the Google Doc"),
        content: z
            .string()
            .describe(
                "Text content for the document. Plain text is auto-converted to Google Doc format."
            ),
        gmailAddress: z
            .string()
            .email()
            .default("corey@useappello.com")
            .describe("The Google account email (defaults to corey@useappello.com)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        fileId: z.string(),
        fileName: z.string(),
        webViewLink: z.string(),
        error: z.string().optional()
    }),
    execute: async ({ title, content, gmailAddress }) => {
        const address = gmailAddress || "corey@useappello.com";
        try {
            // Pre-flight scope check
            const scopeCheck = await checkGoogleScopes(address, DRIVE_WRITE_SCOPES);
            if (!scopeCheck.ok) {
                return {
                    success: false,
                    fileId: "",
                    fileName: "",
                    webViewLink: "",
                    error:
                        `Creating Google Docs requires scope: ${scopeCheck.missing.join(", ")}. ` +
                        `Re-authorize Google OAuth to grant Drive file creation access.`
                };
            }

            // Build multipart request body
            const boundary = "------AgentC2DocUpload" + Date.now();
            const metadata = JSON.stringify({
                name: title,
                mimeType: "application/vnd.google-apps.document"
            });

            const multipartBody =
                `--${boundary}\r\n` +
                `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
                `${metadata}\r\n` +
                `--${boundary}\r\n` +
                `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
                `${content}\r\n` +
                `--${boundary}--`;

            const response = await callDriveApi(address, DRIVE_UPLOAD_API, "/files", {
                method: "POST",
                params: {
                    uploadType: "multipart",
                    fields: "id,name,webViewLink"
                },
                headers: {
                    "Content-Type": `multipart/related; boundary=${boundary}`
                },
                rawBody: multipartBody
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 403 || response.status === 401) {
                    return {
                        success: false,
                        fileId: "",
                        fileName: "",
                        webViewLink: "",
                        error: `Drive access denied (${response.status}). You may need to re-authorize with Drive file creation scope. Details: ${errorText}`
                    };
                }
                return {
                    success: false,
                    fileId: "",
                    fileName: "",
                    webViewLink: "",
                    error: `Drive API error (${response.status}): ${errorText}`
                };
            }

            const result = (await response.json()) as {
                id: string;
                name: string;
                webViewLink?: string;
            };

            return {
                success: true,
                fileId: result.id || "",
                fileName: result.name || title,
                webViewLink:
                    result.webViewLink || `https://docs.google.com/document/d/${result.id}/edit`
            };
        } catch (error) {
            return {
                success: false,
                fileId: "",
                fileName: "",
                webViewLink: "",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }
});
