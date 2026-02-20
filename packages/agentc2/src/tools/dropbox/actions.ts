/**
 * Dropbox Action Tools
 *
 * Mastra tools for listing, reading, uploading, searching,
 * and sharing Dropbox files.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const API_BASE = "https://api.dropboxapi.com/2";
const CONTENT_BASE = "https://content.dropboxapi.com/2";

// ── Shared helper: resolve connection + call Dropbox ───────────────

async function getAccessToken(connectionId: string): Promise<string> {
    const { prisma } = await import("@repo/database");
    const { createDecipheriv } = await import("crypto");

    const connection = await prisma.integrationConnection.findUnique({
        where: { id: connectionId }
    });

    if (!connection || !connection.isActive) {
        throw new Error("Dropbox connection not found or inactive");
    }

    let creds: Record<string, unknown> = {};
    if (connection.credentials && typeof connection.credentials === "object") {
        const value = connection.credentials as Record<string, unknown>;
        if (value.__enc === "v1") {
            const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
            if (key) {
                const buf = Buffer.from(key, "hex");
                if (buf.length === 32) {
                    const iv = Buffer.from(value.iv as string, "base64");
                    const tag = Buffer.from(value.tag as string, "base64");
                    const encrypted = Buffer.from(value.data as string, "base64");
                    const decipher = createDecipheriv("aes-256-gcm", buf, iv);
                    decipher.setAuthTag(tag);
                    const decrypted = Buffer.concat([
                        decipher.update(encrypted),
                        decipher.final()
                    ]).toString("utf8");
                    try {
                        creds = JSON.parse(decrypted);
                    } catch {
                        /* empty */
                    }
                }
            }
        } else {
            creds = value;
        }
    }

    const accessToken = creds.accessToken as string;
    if (!accessToken) {
        throw new Error("No access token found for Dropbox connection");
    }

    return accessToken;
}

async function callDropbox(
    connectionId: string,
    endpoint: string,
    body: unknown
): Promise<unknown> {
    const token = await getAccessToken(connectionId);
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Dropbox API error (${response.status}): ${errorText}`);
    }

    return response.json();
}

// ── Tools ──────────────────────────────────────────────────────────

export const dropboxListFilesTool = createTool({
    id: "dropbox-list-files",
    description: "List files and folders in a Dropbox path. Use empty string for root.",
    inputSchema: z.object({
        connectionId: z.string().describe("Dropbox IntegrationConnection ID"),
        path: z
            .string()
            .optional()
            .default("")
            .describe("Dropbox path (e.g., '/Documents'). Empty string for root."),
        limit: z.number().optional().default(25).describe("Max results (default 25)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        entries: z.array(z.record(z.unknown())),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, path, limit }) => {
        try {
            const result = (await callDropbox(connectionId, "/files/list_folder", {
                path: path || "",
                recursive: false,
                include_media_info: false,
                include_deleted: false,
                limit: Math.min(limit || 25, 100)
            })) as { entries: unknown[] };

            return {
                success: true,
                entries: (result.entries as Record<string, unknown>[]) || []
            };
        } catch (error) {
            return {
                success: false,
                entries: [],
                error: error instanceof Error ? error.message : "Failed to list files"
            };
        }
    }
});

export const dropboxGetFileTool = createTool({
    id: "dropbox-get-file",
    description:
        "Download and read a text file from Dropbox. Returns the file content as text. Works best with text files (code, documents, CSVs).",
    inputSchema: z.object({
        connectionId: z.string().describe("Dropbox IntegrationConnection ID"),
        path: z.string().describe("Full Dropbox path to the file (e.g., '/Documents/notes.txt')")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        content: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, path }) => {
        try {
            const token = await getAccessToken(connectionId);
            const response = await fetch(`${CONTENT_BASE}/files/download`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Dropbox-API-Arg": JSON.stringify({ path })
                }
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(`Download failed (${response.status}): ${errorText}`);
            }

            const resultHeader = response.headers.get("Dropbox-API-Result");
            const metadata = resultHeader ? JSON.parse(resultHeader) : {};
            const content = await response.text();

            return {
                success: true,
                content,
                metadata: metadata as Record<string, unknown>
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to download file"
            };
        }
    }
});

export const dropboxUploadFileTool = createTool({
    id: "dropbox-upload-file",
    description: "Upload a text file to Dropbox.",
    inputSchema: z.object({
        connectionId: z.string().describe("Dropbox IntegrationConnection ID"),
        path: z.string().describe("Destination path in Dropbox (e.g., '/Documents/report.txt')"),
        content: z.string().describe("File content to upload"),
        mode: z
            .enum(["add", "overwrite"])
            .optional()
            .default("add")
            .describe("Upload mode: 'add' (create new) or 'overwrite' (replace existing)")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        metadata: z.record(z.unknown()).optional(),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, path, content, mode }) => {
        try {
            const token = await getAccessToken(connectionId);
            const response = await fetch(`${CONTENT_BASE}/files/upload`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Dropbox-API-Arg": JSON.stringify({
                        path,
                        mode: mode || "add",
                        autorename: true,
                        mute: false
                    }),
                    "Content-Type": "application/octet-stream"
                },
                body: content
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(`Upload failed (${response.status}): ${errorText}`);
            }

            const metadata = await response.json();
            return { success: true, metadata: metadata as Record<string, unknown> };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to upload file"
            };
        }
    }
});

export const dropboxSearchFilesTool = createTool({
    id: "dropbox-search-files",
    description: "Search for files in Dropbox by name or content.",
    inputSchema: z.object({
        connectionId: z.string().describe("Dropbox IntegrationConnection ID"),
        query: z.string().describe("Search query"),
        path: z
            .string()
            .optional()
            .default("")
            .describe("Limit search to this path (empty for all)"),
        maxResults: z.number().optional().default(25).describe("Max results")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        results: z.array(z.record(z.unknown())),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, query, path, maxResults }) => {
        try {
            const result = (await callDropbox(connectionId, "/files/search_v2", {
                query,
                options: {
                    path: path || "",
                    max_results: Math.min(maxResults || 25, 100),
                    file_status: "active"
                }
            })) as {
                matches: Array<{ metadata: { metadata: Record<string, unknown> } }>;
            };

            const files = (result.matches || []).map((m) => m.metadata.metadata);
            return { success: true, results: files };
        } catch (error) {
            return {
                success: false,
                results: [],
                error: error instanceof Error ? error.message : "Failed to search files"
            };
        }
    }
});

export const dropboxGetSharingLinksTool = createTool({
    id: "dropbox-get-sharing-links",
    description: "Get sharing links for a Dropbox file or create one if none exist.",
    inputSchema: z.object({
        connectionId: z.string().describe("Dropbox IntegrationConnection ID"),
        path: z.string().describe("Full Dropbox path to the file")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        links: z.array(z.object({ url: z.string(), name: z.string() })),
        error: z.string().optional()
    }),
    execute: async ({ connectionId, path }) => {
        try {
            const result = (await callDropbox(connectionId, "/sharing/list_shared_links", {
                path,
                direct_only: true
            })) as {
                links: Array<{ url: string; name: string }>;
            };

            const links = (result.links || []).map((link) => ({
                url: link.url,
                name: link.name
            }));

            // If no links exist, create one
            if (links.length === 0) {
                try {
                    const created = (await callDropbox(
                        connectionId,
                        "/sharing/create_shared_link_with_settings",
                        {
                            path,
                            settings: { requested_visibility: "public" }
                        }
                    )) as { url: string; name: string };
                    links.push({ url: created.url, name: created.name });
                } catch {
                    // Link creation may fail if the file doesn't support sharing
                }
            }

            return { success: true, links };
        } catch (error) {
            return {
                success: false,
                links: [],
                error: error instanceof Error ? error.message : "Failed to get sharing links"
            };
        }
    }
});
