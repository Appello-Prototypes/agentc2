import type { McpToolDefinition, McpToolRoute } from "./types";

export const codingPipelineToolDefinitions: McpToolDefinition[] = [
    {
        name: "cursor-launch-agent",
        description:
            "Launch a Cursor Cloud Agent to implement code changes on a GitHub repository. " +
            "Provide a detailed prompt describing what to build or fix.",
        inputSchema: {
            type: "object",
            properties: {
                repository: {
                    type: "string",
                    description: "GitHub repository URL (e.g., 'https://github.com/org/repo')"
                },
                prompt: {
                    type: "string",
                    description: "Detailed implementation instructions for the coding agent"
                },
                ref: {
                    type: "string",
                    description: "Base branch or ref to work from (default: 'main')"
                }
            },
            required: ["repository", "prompt"]
        },
        invoke_url: "/api/mcp",
        category: "coding-pipeline"
    },
    {
        name: "cursor-get-status",
        description:
            "Get the current status of a Cursor Cloud Agent. " +
            "Statuses: CREATING, RUNNING, COMPLETED, FAILED.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: {
                    type: "string",
                    description: "The Cursor Cloud Agent ID"
                }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "coding-pipeline"
    },
    {
        name: "cursor-add-followup",
        description:
            "Send follow-up instructions to a running Cursor Cloud Agent. " +
            "Use to refine work or provide error context from failed builds.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: {
                    type: "string",
                    description: "The Cursor Cloud Agent ID"
                },
                prompt: {
                    type: "string",
                    description: "Follow-up instructions or error context"
                }
            },
            required: ["agentId", "prompt"]
        },
        invoke_url: "/api/mcp",
        category: "coding-pipeline"
    },
    {
        name: "cursor-get-conversation",
        description: "Retrieve the conversation history of a Cursor Cloud Agent for audit trail.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: {
                    type: "string",
                    description: "The Cursor Cloud Agent ID"
                }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "coding-pipeline"
    },
    {
        name: "cursor-poll-until-done",
        description:
            "Poll a Cursor Cloud Agent until it reaches a terminal state (COMPLETED or FAILED). " +
            "Implements exponential backoff.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: {
                    type: "string",
                    description: "The Cursor Cloud Agent ID"
                },
                maxWaitMinutes: {
                    type: "number",
                    description: "Maximum minutes to wait (default: 30)"
                }
            },
            required: ["agentId"]
        },
        invoke_url: "/api/mcp",
        category: "coding-pipeline"
    },
    {
        name: "verify-branch",
        description:
            "Verify a branch by cloning and running build commands in the sandbox. " +
            "Runs type-check, lint, and build by default.",
        inputSchema: {
            type: "object",
            properties: {
                repository: {
                    type: "string",
                    description: "GitHub repository URL or owner/repo"
                },
                branch: {
                    type: "string",
                    description: "Branch name to verify"
                },
                commands: {
                    type: "array",
                    items: { type: "string" },
                    description: "Custom verification commands (default: type-check, lint, build)"
                }
            },
            required: ["repository", "branch"]
        },
        invoke_url: "/api/mcp",
        category: "coding-pipeline"
    },
    {
        name: "wait-for-checks",
        description: "Poll GitHub Actions check suites for a branch until all checks complete.",
        inputSchema: {
            type: "object",
            properties: {
                repository: {
                    type: "string",
                    description: "GitHub repository URL or owner/repo"
                },
                ref: {
                    type: "string",
                    description: "Branch name, tag, or commit SHA to check"
                },
                maxWaitMinutes: {
                    type: "number",
                    description: "Maximum minutes to wait (default: 20)"
                }
            },
            required: ["repository", "ref"]
        },
        invoke_url: "/api/mcp",
        category: "coding-pipeline"
    }
];

export const codingPipelineToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "cursor-launch-agent" },
    { kind: "registry", name: "cursor-get-status" },
    { kind: "registry", name: "cursor-add-followup" },
    { kind: "registry", name: "cursor-get-conversation" },
    { kind: "registry", name: "cursor-poll-until-done" },
    { kind: "registry", name: "verify-branch" },
    { kind: "registry", name: "wait-for-checks" }
];
