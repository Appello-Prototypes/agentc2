/**
 * Jira Direct API Client
 *
 * Provides direct API access to Jira when MCP stdio transport is unavailable.
 * Mirrors the functionality of @timbreeding/jira-mcp-server.
 */

import type {
    McpApiClient,
    ToolExecutionContext,
    ToolResult,
    UnifiedToolDefinition
} from "../types";

/**
 * Jira API Client for serverless environments
 */
export class JiraApiClient implements McpApiClient {
    serverId = "jira";
    private baseUrl: string | undefined;
    private username: string | undefined;
    private apiToken: string | undefined;

    constructor() {
        this.baseUrl = process.env.JIRA_URL;
        this.username = process.env.JIRA_USERNAME;
        this.apiToken = process.env.JIRA_API_TOKEN;
    }

    isConfigured(): boolean {
        return !!(this.baseUrl && this.username && this.apiToken);
    }

    private getAuthHeader(): string {
        const credentials = Buffer.from(`${this.username}:${this.apiToken}`).toString("base64");
        return `Basic ${credentials}`;
    }

    private async apiRequest(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<{ success: boolean; data?: unknown; error?: string }> {
        if (!this.isConfigured()) {
            return { success: false, error: "Jira credentials not configured" };
        }

        try {
            const response = await fetch(`${this.baseUrl}/rest/api/3${endpoint}`, {
                ...options,
                headers: {
                    Authorization: this.getAuthHeader(),
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `Jira API error ${response.status}: ${errorText}`
                };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async listTools(): Promise<UnifiedToolDefinition[]> {
        return [
            {
                name: "jira-search-issues",
                description: "Search for Jira issues using JQL",
                serverId: this.serverId,
                parameters: {
                    jql: { type: "string", description: "JQL query string", required: true },
                    maxResults: { type: "number", description: "Maximum results to return" },
                    startAt: { type: "number", description: "Starting index for pagination" },
                    fields: { type: "array", description: "Fields to include in response" }
                },
                hasApiFallback: true
            },
            {
                name: "jira-get-issue",
                description: "Get a specific Jira issue by key",
                serverId: this.serverId,
                parameters: {
                    issueKey: {
                        type: "string",
                        description: "Issue key (e.g., PROJ-123)",
                        required: true
                    },
                    fields: { type: "array", description: "Fields to include" },
                    expand: { type: "array", description: "Fields to expand" }
                },
                hasApiFallback: true
            },
            {
                name: "jira-create-issue",
                description: "Create a new Jira issue",
                serverId: this.serverId,
                parameters: {
                    projectKey: { type: "string", description: "Project key", required: true },
                    summary: { type: "string", description: "Issue summary", required: true },
                    issueType: {
                        type: "string",
                        description: "Issue type (e.g., Bug, Task, Story)",
                        required: true
                    },
                    description: { type: "string", description: "Issue description" },
                    priority: { type: "string", description: "Priority name" },
                    assignee: { type: "string", description: "Assignee account ID" },
                    labels: { type: "array", description: "Labels to add" }
                },
                hasApiFallback: true
            },
            {
                name: "jira-update-issue",
                description: "Update an existing Jira issue",
                serverId: this.serverId,
                parameters: {
                    issueKey: {
                        type: "string",
                        description: "Issue key (e.g., PROJ-123)",
                        required: true
                    },
                    summary: { type: "string", description: "New summary" },
                    description: { type: "string", description: "New description" },
                    priority: { type: "string", description: "New priority" },
                    assignee: { type: "string", description: "New assignee account ID" },
                    labels: { type: "array", description: "New labels" }
                },
                hasApiFallback: true
            },
            {
                name: "jira-add-comment",
                description: "Add a comment to a Jira issue",
                serverId: this.serverId,
                parameters: {
                    issueKey: {
                        type: "string",
                        description: "Issue key (e.g., PROJ-123)",
                        required: true
                    },
                    body: { type: "string", description: "Comment text", required: true }
                },
                hasApiFallback: true
            },
            {
                name: "jira-get-comments",
                description: "Get comments on a Jira issue",
                serverId: this.serverId,
                parameters: {
                    issueKey: {
                        type: "string",
                        description: "Issue key (e.g., PROJ-123)",
                        required: true
                    },
                    maxResults: { type: "number", description: "Maximum comments to return" }
                },
                hasApiFallback: true
            },
            {
                name: "jira-transition-issue",
                description: "Transition an issue to a new status",
                serverId: this.serverId,
                parameters: {
                    issueKey: {
                        type: "string",
                        description: "Issue key (e.g., PROJ-123)",
                        required: true
                    },
                    transitionId: {
                        type: "string",
                        description: "Transition ID",
                        required: true
                    }
                },
                hasApiFallback: true
            },
            {
                name: "jira-get-transitions",
                description: "Get available transitions for an issue",
                serverId: this.serverId,
                parameters: {
                    issueKey: {
                        type: "string",
                        description: "Issue key (e.g., PROJ-123)",
                        required: true
                    }
                },
                hasApiFallback: true
            },
            {
                name: "jira-get-projects",
                description: "Get list of Jira projects",
                serverId: this.serverId,
                parameters: {
                    maxResults: { type: "number", description: "Maximum projects to return" },
                    startAt: { type: "number", description: "Starting index" }
                },
                hasApiFallback: true
            },
            {
                name: "jira-get-myself",
                description: "Get current user information",
                serverId: this.serverId,
                parameters: {},
                hasApiFallback: true
            }
        ];
    }

    async executeTool(toolName: string, params: ToolExecutionContext): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            let result: { success: boolean; data?: unknown; error?: string };

            switch (toolName) {
                case "jira-search-issues":
                    result = await this.searchIssues(params);
                    break;
                case "jira-get-issue":
                    result = await this.getIssue(params);
                    break;
                case "jira-create-issue":
                    result = await this.createIssue(params);
                    break;
                case "jira-update-issue":
                    result = await this.updateIssue(params);
                    break;
                case "jira-add-comment":
                    result = await this.addComment(params);
                    break;
                case "jira-get-comments":
                    result = await this.getComments(params);
                    break;
                case "jira-transition-issue":
                    result = await this.transitionIssue(params);
                    break;
                case "jira-get-transitions":
                    result = await this.getTransitions(params.issueKey as string);
                    break;
                case "jira-get-projects":
                    result = await this.getProjects(params);
                    break;
                case "jira-get-myself":
                    result = await this.getMyself();
                    break;
                default:
                    result = { success: false, error: `Unknown tool: ${toolName}` };
            }

            return {
                ...result,
                metadata: {
                    mode: "api",
                    executionTime: Date.now() - startTime,
                    serverId: this.serverId
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                metadata: {
                    mode: "api",
                    executionTime: Date.now() - startTime,
                    serverId: this.serverId
                }
            };
        }
    }

    private async searchIssues(params: ToolExecutionContext) {
        const queryParams = new URLSearchParams();
        queryParams.set("jql", params.jql as string);
        if (params.maxResults) queryParams.set("maxResults", String(params.maxResults));
        if (params.startAt) queryParams.set("startAt", String(params.startAt));
        if (params.fields) queryParams.set("fields", (params.fields as string[]).join(","));

        return this.apiRequest(`/search?${queryParams.toString()}`);
    }

    private async getIssue(params: ToolExecutionContext) {
        const issueKey = params.issueKey as string;
        const queryParams = new URLSearchParams();
        if (params.fields) queryParams.set("fields", (params.fields as string[]).join(","));
        if (params.expand) queryParams.set("expand", (params.expand as string[]).join(","));

        const query = queryParams.toString();
        return this.apiRequest(`/issue/${issueKey}${query ? `?${query}` : ""}`);
    }

    private async createIssue(params: ToolExecutionContext) {
        const fields: Record<string, unknown> = {
            project: { key: params.projectKey },
            summary: params.summary,
            issuetype: { name: params.issueType }
        };

        if (params.description) {
            fields.description = {
                type: "doc",
                version: 1,
                content: [
                    {
                        type: "paragraph",
                        content: [{ type: "text", text: params.description as string }]
                    }
                ]
            };
        }
        if (params.priority) fields.priority = { name: params.priority };
        if (params.assignee) fields.assignee = { accountId: params.assignee };
        if (params.labels) fields.labels = params.labels;

        return this.apiRequest("/issue", {
            method: "POST",
            body: JSON.stringify({ fields })
        });
    }

    private async updateIssue(params: ToolExecutionContext) {
        const issueKey = params.issueKey as string;
        const fields: Record<string, unknown> = {};

        if (params.summary) fields.summary = params.summary;
        if (params.description) {
            fields.description = {
                type: "doc",
                version: 1,
                content: [
                    {
                        type: "paragraph",
                        content: [{ type: "text", text: params.description as string }]
                    }
                ]
            };
        }
        if (params.priority) fields.priority = { name: params.priority };
        if (params.assignee) fields.assignee = { accountId: params.assignee };
        if (params.labels) fields.labels = params.labels;

        return this.apiRequest(`/issue/${issueKey}`, {
            method: "PUT",
            body: JSON.stringify({ fields })
        });
    }

    private async addComment(params: ToolExecutionContext) {
        const issueKey = params.issueKey as string;
        return this.apiRequest(`/issue/${issueKey}/comment`, {
            method: "POST",
            body: JSON.stringify({
                body: {
                    type: "doc",
                    version: 1,
                    content: [
                        {
                            type: "paragraph",
                            content: [{ type: "text", text: params.body as string }]
                        }
                    ]
                }
            })
        });
    }

    private async getComments(params: ToolExecutionContext) {
        const issueKey = params.issueKey as string;
        const queryParams = new URLSearchParams();
        if (params.maxResults) queryParams.set("maxResults", String(params.maxResults));

        const query = queryParams.toString();
        return this.apiRequest(`/issue/${issueKey}/comment${query ? `?${query}` : ""}`);
    }

    private async transitionIssue(params: ToolExecutionContext) {
        const issueKey = params.issueKey as string;
        return this.apiRequest(`/issue/${issueKey}/transitions`, {
            method: "POST",
            body: JSON.stringify({
                transition: { id: params.transitionId }
            })
        });
    }

    private async getTransitions(issueKey: string) {
        return this.apiRequest(`/issue/${issueKey}/transitions`);
    }

    private async getProjects(params: ToolExecutionContext) {
        const queryParams = new URLSearchParams();
        if (params.maxResults) queryParams.set("maxResults", String(params.maxResults));
        if (params.startAt) queryParams.set("startAt", String(params.startAt));

        const query = queryParams.toString();
        return this.apiRequest(`/project${query ? `?${query}` : ""}`);
    }

    private async getMyself() {
        return this.apiRequest("/myself");
    }
}

export const jiraApiClient = new JiraApiClient();
