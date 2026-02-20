import { McpToolDefinition, McpToolRoute } from "./types";

export const platformDocsToolDefinitions: McpToolDefinition[] = [
    {
        name: "platform-docs",
        description:
            "RECOMMENDED FIRST CALL: Get structured documentation about what the AgentC2 platform can do. Returns capability domains, available tools, key concepts, and step-by-step recipes for success. Call with topic='overview' for the full index, or a specific domain for detailed documentation.",
        inputSchema: {
            type: "object",
            properties: {
                topic: {
                    type: "string",
                    description:
                        "Topic to get documentation for. Use 'overview' for the full capabilities index, or a domain name like 'agents', 'workflows', 'networks', 'campaigns', 'coding-pipeline', 'skills', 'rag', 'triggers', 'learning', 'quality', 'monitoring', 'integrations'. Defaults to 'overview'."
                }
            }
        },
        invoke_url: "/api/mcp",
        category: "platform"
    }
];

export const platformDocsToolRoutes: McpToolRoute[] = [{ kind: "registry", name: "platform-docs" }];
