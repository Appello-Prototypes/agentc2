import { McpToolDefinition, McpToolRoute } from "./types";

export const supportToolDefinitions: McpToolDefinition[] = [
    {
        name: "submit-support-ticket",
        description:
            "Submit a support ticket (bug report, feature request, improvement, or question). " +
            "Creates a new ticket reviewed by the platform team. Returns the ticket number.",
        inputSchema: {
            type: "object",
            properties: {
                type: {
                    type: "string",
                    enum: ["BUG", "FEATURE_REQUEST", "IMPROVEMENT", "QUESTION"],
                    description:
                        "Type of ticket: BUG for bugs/errors, FEATURE_REQUEST for new features, IMPROVEMENT for enhancements, QUESTION for general questions"
                },
                title: {
                    type: "string",
                    description: "Short, descriptive title for the ticket"
                },
                description: {
                    type: "string",
                    description:
                        "Detailed description. For bugs: include steps to reproduce, expected vs actual behavior. For features: describe the desired functionality and use case."
                },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        "Optional tags for categorization (e.g., 'ui', 'api', 'performance')"
                }
            },
            required: ["type", "title", "description"]
        },
        invoke_url: "/api/mcp",
        category: "support"
    },
    {
        name: "list-my-tickets",
        description:
            "List your submitted support tickets with optional filters. " +
            "Shows ticket number, title, type, status, priority, and creation date. " +
            "Results are ordered by most recent first.",
        inputSchema: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: [
                        "NEW",
                        "TRIAGED",
                        "IN_PROGRESS",
                        "WAITING_ON_CUSTOMER",
                        "RESOLVED",
                        "CLOSED"
                    ],
                    description: "Filter by status (optional)"
                },
                type: {
                    type: "string",
                    enum: ["BUG", "FEATURE_REQUEST", "IMPROVEMENT", "QUESTION"],
                    description: "Filter by ticket type (optional)"
                },
                limit: {
                    type: "number",
                    description: "Max number of tickets to return (default: 20, max: 50)"
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "support"
    },
    {
        name: "view-ticket-details",
        description:
            "View full details of a specific support ticket by ticket number, including the comment thread. " +
            "Only shows comments visible to users (excludes internal admin notes).",
        inputSchema: {
            type: "object",
            properties: {
                ticketNumber: {
                    type: "number",
                    description: "The ticket number (e.g., 1, 2, 3)"
                }
            },
            required: ["ticketNumber"]
        },
        invoke_url: "/api/mcp",
        category: "support"
    },
    {
        name: "comment-on-ticket",
        description:
            "Add a comment to an existing support ticket. " +
            "Use this to provide additional information, answer questions from the support team, " +
            "or follow up on a ticket.",
        inputSchema: {
            type: "object",
            properties: {
                ticketNumber: {
                    type: "number",
                    description: "The ticket number to comment on"
                },
                message: {
                    type: "string",
                    description: "The comment text to add"
                }
            },
            required: ["ticketNumber", "message"]
        },
        invoke_url: "/api/mcp",
        category: "support"
    }
];

export const supportToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "submit-support-ticket", injectOrg: true, injectUser: true },
    { kind: "registry", name: "list-my-tickets", injectOrg: true, injectUser: true },
    { kind: "registry", name: "view-ticket-details", injectOrg: true, injectUser: true },
    { kind: "registry", name: "comment-on-ticket", injectOrg: true, injectUser: true }
];
