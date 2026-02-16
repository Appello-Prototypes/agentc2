import { McpToolDefinition, McpToolRoute } from "./types";

export const sandboxToolDefinitions: McpToolDefinition[] = [
    {
        name: "execute-code",
        description:
            "Execute code (bash, Python, or TypeScript) in a sandboxed environment. Returns stdout, stderr, and exit code.",
        inputSchema: {
            type: "object",
            properties: {
                language: {
                    type: "string",
                    enum: ["bash", "python", "typescript"],
                    description: "Language to execute"
                },
                code: { type: "string", description: "The code to execute" },
                timeout: {
                    type: "number",
                    description: "Timeout in seconds (default: 30, max: 120)"
                },
                agentId: {
                    type: "string",
                    description: "Agent ID for workspace isolation. Defaults to 'default'."
                }
            },
            required: ["language", "code"]
        },
        invoke_url: "/api/mcp",
        category: "sandbox"
    },
    {
        name: "write-workspace-file",
        description:
            "Write a file to the agent's persistent workspace. Files survive between runs.",
        inputSchema: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Relative path within the workspace"
                },
                content: { type: "string", description: "File content to write" },
                agentId: {
                    type: "string",
                    description: "Agent ID for workspace isolation. Defaults to 'default'."
                }
            },
            required: ["path", "content"]
        },
        invoke_url: "/api/mcp",
        category: "sandbox"
    },
    {
        name: "read-workspace-file",
        description: "Read a file from the agent's persistent workspace.",
        inputSchema: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Relative path within the workspace"
                },
                agentId: {
                    type: "string",
                    description: "Agent ID for workspace isolation. Defaults to 'default'."
                }
            },
            required: ["path"]
        },
        invoke_url: "/api/mcp",
        category: "sandbox"
    },
    {
        name: "list-workspace-files",
        description: "List files in the agent's persistent workspace directory.",
        inputSchema: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Relative directory path (default: workspace root)"
                },
                agentId: {
                    type: "string",
                    description: "Agent ID for workspace isolation. Defaults to 'default'."
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "sandbox"
    }
];

export const sandboxToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "execute-code" },
    { kind: "registry", name: "write-workspace-file" },
    { kind: "registry", name: "read-workspace-file" },
    { kind: "registry", name: "list-workspace-files" }
];
