import { McpToolDefinition, McpToolRoute } from "./types";

export const sessionOpsToolDefinitions: McpToolDefinition[] = [
    {
        name: "session-create",
        description:
            "Create a collaborative multi-agent session with shared memory. All participating agents can read/write a shared scratchpad and invoke each other as peers.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Short name for the session" },
                agentSlugs: {
                    type: "array",
                    items: { type: "string" },
                    description: "Agent slugs to participate (minimum 2)"
                },
                task: { type: "string", description: "Task description for the scratchpad" },
                orchestratorSlug: {
                    type: "string",
                    description: "Agent slug of the orchestrator (optional)"
                },
                scratchpadTemplate: {
                    type: "string",
                    description: "Custom scratchpad template (markdown)"
                },
                maxPeerCalls: {
                    type: "number",
                    description: "Max peer-to-peer invocations (default: 20)"
                },
                maxDepth: {
                    type: "number",
                    description: "Max invocation depth (default: 5)"
                }
            },
            required: ["name", "agentSlugs", "task"]
        },
        invoke_url: "/api/mcp",
        category: "sessions"
    },
    {
        name: "session-invoke-peer",
        description:
            "Invoke a peer agent within a collaborative session. Shared memory and communication policies are enforced automatically.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: { type: "string", description: "Session ID" },
                targetAgentSlug: { type: "string", description: "Peer agent slug" },
                message: { type: "string", description: "Message to send to the peer" },
                context: { type: "object", description: "Additional context (optional)" }
            },
            required: ["sessionId", "targetAgentSlug", "message"]
        },
        invoke_url: "/api/mcp",
        category: "sessions"
    },
    {
        name: "session-read-scratchpad",
        description:
            "Read the shared scratchpad for a collaborative session, including participant stats.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: { type: "string", description: "Session ID" }
            },
            required: ["sessionId"]
        },
        invoke_url: "/api/mcp",
        category: "sessions"
    },
    {
        name: "session-write-scratchpad",
        description:
            "Write to the shared session scratchpad. Append adds a timestamped entry; replace overwrites.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: { type: "string", description: "Session ID" },
                content: { type: "string", description: "Content to write" },
                mode: {
                    type: "string",
                    enum: ["append", "replace"],
                    description: "Write mode (default: append)"
                }
            },
            required: ["sessionId", "content"]
        },
        invoke_url: "/api/mcp",
        category: "sessions"
    }
];

export const sessionOpsToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "session-create" },
    { kind: "registry", name: "session-invoke-peer" },
    { kind: "registry", name: "session-read-scratchpad" },
    { kind: "registry", name: "session-write-scratchpad" }
];
