import { McpToolDefinition, McpToolRoute } from "./types";

export const conversationToolDefinitions: McpToolDefinition[] = [
    {
        name: "conversation-list",
        description:
            "List conversation threads grouped by threadId. Shows run count, turn count, tokens, cost, and time range per thread. Use to browse conversations across agents or filter by agent.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "Filter by agent ID" },
                agentSlug: { type: "string", description: "Filter by agent slug" },
                source: {
                    type: "string",
                    description: "Filter by source channel (api, slack, whatsapp, voice)"
                },
                from: { type: "string", description: "Start date (ISO)" },
                to: { type: "string", description: "End date (ISO)" },
                search: { type: "string", description: "Search within thread content" },
                limit: {
                    type: "number",
                    description: "Max threads to return (default 30, max 100)"
                },
                offset: { type: "number", description: "Pagination offset" }
            }
        },
        invoke_url: "/api/mcp",
        category: "monitoring"
    },
    {
        name: "conversation-get",
        description:
            "Get a complete conversation thread by threadId. Returns all runs, turns, user inputs, agent outputs, tool calls, token counts, and costs — rendered as a chronological message list.",
        inputSchema: {
            type: "object",
            properties: {
                threadId: {
                    type: "string",
                    description: "The thread ID to retrieve"
                }
            },
            required: ["threadId"]
        },
        invoke_url: "/api/mcp",
        category: "monitoring"
    }
];

export const conversationToolRoutes: McpToolRoute[] = [
    {
        kind: "internal",
        name: "conversation-list",
        method: "GET",
        path: "/api/threads",
        queryParams: ["agentId", "agentSlug", "source", "from", "to", "search", "limit", "offset"]
    },
    {
        kind: "internal",
        name: "conversation-get",
        method: "GET",
        path: "/api/threads/{threadId}",
        pathParams: ["threadId"]
    }
];
