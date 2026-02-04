#!/usr/bin/env node

/**
 * Fathom MCP Server
 *
 * A minimal MCP server for accessing Fathom meeting recordings.
 * Uses direct API calls with correct X-Api-Key authentication.
 *
 * Features:
 * - List meetings (with date filtering)
 * - Get meeting summary
 * - Get meeting transcript
 * - Get meeting details
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

// Fathom API configuration
const FATHOM_API_BASE = "https://api.fathom.ai/external/v1";
const API_KEY = process.env.FATHOM_API_KEY;
const MAX_TOOL_TEXT_CHARS = Number(process.env.FATHOM_MCP_MAX_CHARS || 20000);

if (!API_KEY) {
    console.error("Error: FATHOM_API_KEY environment variable is required");
    process.exit(1);
}

/**
 * Make authenticated request to Fathom API
 */
async function fathomRequest(endpoint) {
    const url = `${FATHOM_API_BASE}${endpoint}`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "X-Api-Key": API_KEY,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Fathom API error (${response.status}): ${error}`);
    }

    return response.json();
}

function formatToolResponse(payload) {
    const text = JSON.stringify(payload, null, 2);
    if (text.length <= MAX_TOOL_TEXT_CHARS) {
        return text;
    }
    return `${text.slice(0, MAX_TOOL_TEXT_CHARS)}\n... (truncated)`;
}

// Create the MCP server
const server = new McpServer({
    name: "fathom-mcp",
    version: "1.0.0"
});

// ============================================================================
// TOOL: list_meetings
// ============================================================================
server.tool(
    "list_meetings",
    "List all Fathom meetings. Optionally filter by date range using ISO date strings (YYYY-MM-DD).",
    {
        after: z
            .string()
            .optional()
            .describe("Only return meetings after this date (YYYY-MM-DD or ISO timestamp)"),
        before: z
            .string()
            .optional()
            .describe("Only return meetings before this date (YYYY-MM-DD or ISO timestamp)"),
        limit: z
            .number()
            .optional()
            .default(50)
            .describe("Maximum number of meetings to return (default: 50)")
    },
    async ({ after, before, limit }) => {
        try {
            // Build query params
            const params = new URLSearchParams();
            if (limit) params.set("limit", limit.toString());
            if (after) params.set("created_after", after);
            if (before) params.set("created_before", before);

            const queryString = params.toString();
            const endpoint = `/meetings${queryString ? `?${queryString}` : ""}`;

            const data = await fathomRequest(endpoint);

            // Format the response for readability
            const meetings = data.items || [];

            const formatted = meetings.map((m) => ({
                id: m.recording_id,
                title: m.title || m.meeting_title || "Untitled Meeting",
                started_at: m.recording_start_time || m.scheduled_start_time || m.created_at,
                ended_at: m.recording_end_time,
                url: m.url,
                share_url: m.share_url,
                recorded_by: m.recorded_by?.name || null,
                attendees:
                    m.calendar_invitees?.map((a) => ({
                        name: a.name,
                        email: a.email,
                        is_external: a.is_external
                    })) || [],
                has_summary: !!m.default_summary,
                has_transcript: !!m.transcript
            }));

            return {
                content: [
                    {
                        type: "text",
                        text: formatToolResponse({
                            total: formatted.length,
                            has_more: !!data.next_cursor,
                            meetings: formatted
                        })
                    }
                ]
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true
            };
        }
    }
);

// ============================================================================
// TOOL: get_meeting_summary
// ============================================================================
server.tool(
    "get_meeting_summary",
    "Get the AI-generated summary for a specific Fathom meeting.",
    {
        meeting_id: z.string().describe("The Fathom recording ID")
    },
    async ({ meeting_id }) => {
        try {
            const data = await fathomRequest(`/recordings/${meeting_id}/summary`);

            return {
                content: [
                    {
                        type: "text",
                        text: formatToolResponse({
                            meeting_id,
                            ...data
                        })
                    }
                ]
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true
            };
        }
    }
);

// ============================================================================
// TOOL: get_meeting_transcript
// ============================================================================
server.tool(
    "get_meeting_transcript",
    "Get the full transcript for a specific Fathom meeting.",
    {
        meeting_id: z.string().describe("The Fathom recording ID")
    },
    async ({ meeting_id }) => {
        try {
            const data = await fathomRequest(`/recordings/${meeting_id}/transcript`);

            return {
                content: [
                    {
                        type: "text",
                        text: formatToolResponse({
                            meeting_id,
                            ...data
                        })
                    }
                ]
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true
            };
        }
    }
);

// ============================================================================
// TOOL: get_meeting_details
// ============================================================================
server.tool(
    "get_meeting_details",
    "Get full details for a specific Fathom meeting including metadata, summary, and attendees.",
    {
        meeting_id: z.string().describe("The Fathom recording ID")
    },
    async ({ meeting_id }) => {
        try {
            // Get both summary and transcript
            let summary = null;
            let transcript = null;

            try {
                summary = await fathomRequest(`/recordings/${meeting_id}/summary`);
            } catch (e) {
                // Summary might not be available yet
            }

            try {
                transcript = await fathomRequest(`/recordings/${meeting_id}/transcript`);
            } catch (e) {
                // Transcript might not be available yet
            }

            return {
                content: [
                    {
                        type: "text",
                        text: formatToolResponse({
                            meeting_id,
                            summary,
                            transcript
                        })
                    }
                ]
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true
            };
        }
    }
);

// ============================================================================
// Start the server
// ============================================================================
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Fathom MCP server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
