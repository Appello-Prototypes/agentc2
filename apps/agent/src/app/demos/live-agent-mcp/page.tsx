"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/utils";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Badge,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import { useElevenLabsAgent } from "@/hooks/useElevenLabsAgent";

// ============================================================================
// Types
// ============================================================================

interface AgentOption {
    key: string;
    name: string;
    description: string;
}

interface McpServerStatus {
    id: string;
    name: string;
    description: string;
    category: string;
    available: boolean;
}

interface McpToolDefinition {
    name: string;
    description: string;
    server: string;
    parameters: Record<string, unknown>;
}

interface ToolsResponse {
    tools: McpToolDefinition[];
    servers: McpServerStatus[];
    total: number;
}

// ============================================================================
// MCP Tools Panel Component
// ============================================================================

function McpToolsPanel() {
    const [toolsData, setToolsData] = useState<ToolsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [webhookUrl, setWebhookUrl] = useState<string>("");

    useEffect(() => {
        const fetchTools = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/demos/live-agent-mcp/tools`);
                if (!res.ok) throw new Error("Failed to fetch tools");
                const data = await res.json();
                setToolsData(data);

                // Construct webhook URL
                const origin = window.location.origin;
                setWebhookUrl(`${origin}/api/demos/live-agent-mcp/tools`);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchTools();
    }, []);

    const copyWebhookUrl = useCallback(() => {
        navigator.clipboard.writeText(webhookUrl);
    }, [webhookUrl]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                Error loading MCP tools: {error}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Webhook URL */}
            <div className="rounded-lg border p-4">
                <h4 className="mb-2 font-medium">Webhook URL for ElevenLabs</h4>
                <p className="text-muted-foreground mb-3 text-sm">
                    Configure this URL as a server tool in your ElevenLabs agent dashboard.
                </p>
                <div className="flex items-center gap-2">
                    <code className="bg-muted flex-1 truncate rounded px-3 py-2 text-sm">
                        {webhookUrl}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                        Copy
                    </Button>
                </div>
            </div>

            {/* Server Status */}
            <div>
                <h4 className="mb-3 font-medium">MCP Servers</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                    {toolsData?.servers.map((server) => (
                        <div
                            key={server.id}
                            className={`flex items-center gap-3 rounded-lg border p-3 ${
                                server.available
                                    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                                    : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                            }`}
                        >
                            <div
                                className={`h-2 w-2 rounded-full ${
                                    server.available ? "bg-green-500" : "bg-gray-400"
                                }`}
                            />
                            <div className="flex-1 truncate">
                                <p className="text-sm font-medium">{server.name}</p>
                                <p className="text-muted-foreground truncate text-xs">
                                    {server.description}
                                </p>
                            </div>
                            <Badge variant={server.available ? "default" : "secondary"}>
                                {server.category}
                            </Badge>
                        </div>
                    ))}
                </div>
            </div>

            {/* Available Tools */}
            <div>
                <h4 className="mb-3 font-medium">Available Tools ({toolsData?.total || 0})</h4>
                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                    {toolsData?.tools.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                            No MCP servers are connected. Configure environment variables for the
                            servers you want to use.
                        </p>
                    ) : (
                        toolsData?.tools.map((tool) => (
                            <div key={tool.name} className="bg-muted/50 rounded-lg border p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <code className="text-sm font-medium">{tool.name}</code>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {tool.description}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        {tool.server}
                                    </Badge>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Voice Agent Panel Component
// ============================================================================

function VoiceAgentPanel() {
    const [selectedAgentId, setSelectedAgentId] = useState<string>("");
    const [availableAgents, setAvailableAgents] = useState<AgentOption[]>([]);
    const [isLoadingAgents, setIsLoadingAgents] = useState(true);

    const {
        status,
        agentState,
        messages,
        currentUserTranscript,
        currentAgentResponse,
        latencyMs,
        error,
        isConnected,
        isConnecting,
        startConversation,
        stopConversation,
        clearMessages
    } = useElevenLabsAgent({
        agentId: selectedAgentId || undefined
    });

    // Fetch available agents
    useEffect(() => {
        let isMounted = true;
        const fetchAgents = async () => {
            try {
                const res = await fetch(
                    `${getApiBase()}/api/demos/live-agent-mcp/signed-url?list=true`
                );
                const data = await res.json();
                if (isMounted && data.agents && data.agents.length > 0) {
                    setAvailableAgents(data.agents);
                    setSelectedAgentId((prev) => prev || data.agents[0].key);
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (isMounted) {
                    setIsLoadingAgents(false);
                }
            }
        };
        fetchAgents();
        return () => {
            isMounted = false;
        };
    }, []);

    const getStatusColor = () => {
        switch (status) {
            case "connected":
                return "bg-green-500";
            case "connecting":
                return "bg-yellow-500 animate-pulse";
            case "error":
                return "bg-red-500";
            default:
                return "bg-gray-400";
        }
    };

    const getAgentStateLabel = () => {
        switch (agentState) {
            case "listening":
                return "Listening...";
            case "thinking":
                return "Thinking...";
            case "speaking":
                return "Speaking...";
            default:
                return "Idle";
        }
    };

    return (
        <div className="space-y-6">
            {/* Status Bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
                    <span className="text-sm capitalize">{status}</span>
                </div>
                {latencyMs !== null && (
                    <div className="text-muted-foreground text-sm">
                        RTT: <span className="font-mono">{latencyMs}ms</span>
                    </div>
                )}
            </div>

            {/* Agent Selection */}
            {!isConnected && (
                <div>
                    <label className="mb-2 block text-sm font-medium">Select Agent</label>
                    {isLoadingAgents ? (
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Loading agents...
                        </div>
                    ) : availableAgents.length === 0 ? (
                        <div className="text-muted-foreground text-sm">
                            No agents found. Create one with MCP tools in the{" "}
                            <a
                                href="https://elevenlabs.io/app/agents"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                            >
                                ElevenLabs Dashboard
                            </a>
                        </div>
                    ) : (
                        <Select
                            value={selectedAgentId}
                            onValueChange={(value) => value && setSelectedAgentId(value)}
                            disabled={isConnecting}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select an agent...">
                                    {availableAgents.find((a) => a.key === selectedAgentId)?.name ||
                                        "Select an agent..."}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {availableAgents.map((agent) => (
                                    <SelectItem key={agent.key} value={agent.key}>
                                        {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="rounded-md bg-red-50 p-4 text-sm dark:bg-red-900/20">
                    <p className="font-medium text-red-600 dark:text-red-400">Connection Error</p>
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Conversation Display */}
            <div className="bg-muted/30 min-h-[300px] rounded-lg border p-4">
                {messages.length === 0 && !currentUserTranscript && !currentAgentResponse ? (
                    <div className="text-muted-foreground flex h-[280px] flex-col items-center justify-center text-center">
                        <svg
                            className="mb-4 h-12 w-12 opacity-50"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                            />
                        </svg>
                        <p className="text-lg font-medium">
                            {isConnected ? "Start speaking..." : "Connect to start a conversation"}
                        </p>
                        <p className="mt-2 text-sm">
                            {isConnected
                                ? "The agent is listening. Ask about CRM data, projects, or anything your MCP tools can help with."
                                : "Select an agent with MCP tools configured and click Connect."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Message History */}
                        {messages.map((message) => (
                            <div key={message.id} className="flex gap-3">
                                <div
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                                        message.role === "user"
                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                            : "bg-primary/10 text-primary"
                                    }`}
                                >
                                    {message.role === "user" ? "You" : "AI"}
                                </div>
                                <div
                                    className={`flex-1 rounded-lg p-3 ${
                                        message.role === "user" ? "bg-muted" : "bg-primary/5"
                                    }`}
                                >
                                    <p>{message.content}</p>
                                </div>
                            </div>
                        ))}

                        {/* Current User Transcript */}
                        {currentUserTranscript && (
                            <div className="flex gap-3 opacity-70">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                    You
                                </div>
                                <div className="bg-muted flex-1 rounded-lg p-3">
                                    <p>{currentUserTranscript}</p>
                                    <span className="text-muted-foreground text-xs">
                                        (transcribing...)
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Current Agent Response */}
                        {currentAgentResponse && (
                            <div className="flex gap-3">
                                <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                                    AI
                                </div>
                                <div className="bg-primary/5 flex-1 rounded-lg p-3">
                                    <p>{currentAgentResponse}</p>
                                    {agentState === "speaking" && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="flex gap-1">
                                                <span className="h-2 w-1 animate-pulse rounded bg-current" />
                                                <span
                                                    className="h-3 w-1 animate-pulse rounded bg-current"
                                                    style={{ animationDelay: "0.1s" }}
                                                />
                                                <span
                                                    className="h-2 w-1 animate-pulse rounded bg-current"
                                                    style={{ animationDelay: "0.2s" }}
                                                />
                                            </div>
                                            <span className="text-muted-foreground text-xs">
                                                Speaking...
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Agent State Indicator */}
            {isConnected && (
                <div className="flex items-center justify-center gap-2">
                    <span
                        className={`h-3 w-3 rounded-full ${
                            agentState === "listening"
                                ? "animate-pulse bg-green-500"
                                : agentState === "thinking"
                                  ? "animate-pulse bg-yellow-500"
                                  : agentState === "speaking"
                                    ? "animate-pulse bg-blue-500"
                                    : "bg-gray-400"
                        }`}
                    />
                    <span className="text-muted-foreground text-sm">{getAgentStateLabel()}</span>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
                {!isConnected ? (
                    <Button
                        size="lg"
                        onClick={startConversation}
                        disabled={isConnecting || !selectedAgentId}
                        className="min-w-[200px]"
                    >
                        {isConnecting ? (
                            <>
                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <svg
                                    className="mr-2 h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                    />
                                </svg>
                                Connect
                            </>
                        )}
                    </Button>
                ) : (
                    <>
                        <Button
                            size="lg"
                            variant="destructive"
                            onClick={stopConversation}
                            className="min-w-[150px]"
                        >
                            Disconnect
                        </Button>
                        <Button
                            variant="outline"
                            onClick={clearMessages}
                            disabled={messages.length === 0}
                        >
                            Clear History
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export default function LiveAgentMcpPage() {
    return (
        <div className="container mx-auto max-w-6xl space-y-6 p-6">
            <div>
                <h1 className="text-3xl font-bold">Live Agent (MCP Access)</h1>
                <p className="text-muted-foreground mt-2">
                    Real-time voice agent with access to Mastra MCP tools. The agent can query CRM
                    data, project information, browse the web, and more.
                </p>
            </div>

            <Tabs defaultValue="conversation" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="conversation">Voice Conversation</TabsTrigger>
                    <TabsTrigger value="tools">MCP Tools</TabsTrigger>
                    <TabsTrigger value="setup">Setup Guide</TabsTrigger>
                </TabsList>

                <TabsContent value="conversation">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Voice Agent
                                <Badge variant="secondary" className="text-xs">
                                    MCP-Enabled
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Connect to an ElevenLabs agent configured with MCP tools. The agent
                                can access HubSpot, Jira, web scraping, and more.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <VoiceAgentPanel />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="tools">
                    <Card>
                        <CardHeader>
                            <CardTitle>Available MCP Tools</CardTitle>
                            <CardDescription>
                                These tools are available for your ElevenLabs agents to use via
                                webhook. Configure them in your agent&apos;s tool settings.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <McpToolsPanel />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="setup">
                    <Card>
                        <CardHeader>
                            <CardTitle>Setup Guide</CardTitle>
                            <CardDescription>
                                Follow these steps to configure your ElevenLabs agent with MCP
                                tools.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                                    <h4 className="mb-2 font-medium">
                                        1. Configure Backend Agent (Recommended First)
                                    </h4>
                                    <p className="text-muted-foreground text-sm">
                                        Go to{" "}
                                        <a
                                            href="/demos/agents/manage"
                                            className="text-primary underline"
                                        >
                                            Agent Management
                                        </a>{" "}
                                        to configure the backend agent that handles ElevenLabs
                                        requests. The default agent is &quot;MCP-Enabled Agent&quot;
                                        (slug: mcp-agent). You can edit its instructions, model, and
                                        tools.
                                    </p>
                                </div>

                                <div className="rounded-lg border p-4">
                                    <h4 className="mb-2 font-medium">
                                        2. Create an ElevenLabs Agent
                                    </h4>
                                    <p className="text-muted-foreground text-sm">
                                        Go to the{" "}
                                        <a
                                            href="https://elevenlabs.io/app/agents"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary underline"
                                        >
                                            ElevenLabs Agents Dashboard
                                        </a>{" "}
                                        and create a new agent. Choose a voice (like Grace or James)
                                        and configure the system prompt.
                                    </p>
                                </div>

                                <div className="rounded-lg border p-4">
                                    <h4 className="mb-2 font-medium">3. Add Server Tools</h4>
                                    <p className="text-muted-foreground mb-3 text-sm">
                                        In your agent&apos;s Tools section, add new webhook tools.
                                        Use the webhook URL from the MCP Tools tab.
                                    </p>
                                    <div className="bg-muted rounded p-3 text-sm">
                                        <p className="font-medium">Example Tool Configuration:</p>
                                        <ul className="text-muted-foreground mt-2 space-y-1">
                                            <li>
                                                <strong>Name:</strong> ask_assistant
                                            </li>
                                            <li>
                                                <strong>Type:</strong> Webhook (Server)
                                            </li>
                                            <li>
                                                <strong>Method:</strong> POST
                                            </li>
                                            <li>
                                                <strong>URL:</strong>{" "}
                                                https://your-domain/api/demos/live-agent-mcp/assistant
                                            </li>
                                            <li>
                                                <strong>Auth:</strong> Bearer token (your
                                                ELEVENLABS_WEBHOOK_SECRET)
                                            </li>
                                        </ul>
                                    </div>
                                    <p className="text-muted-foreground mt-3 text-xs">
                                        Optional: Add <code>?agent=your-agent-slug</code> to the URL
                                        to use a different backend agent.
                                    </p>
                                </div>

                                <div className="rounded-lg border p-4">
                                    <h4 className="mb-2 font-medium">
                                        4. Configure Tool Parameters
                                    </h4>
                                    <p className="text-muted-foreground text-sm">
                                        For the ask_assistant tool, configure the request body:
                                    </p>
                                    <pre className="bg-muted mt-3 overflow-x-auto rounded p-3 text-sm">
                                        {`{
  "question": "{{user_message}}"
}`}
                                    </pre>
                                </div>

                                <div className="rounded-lg border p-4">
                                    <h4 className="mb-2 font-medium">5. Tag Your Agent</h4>
                                    <p className="text-muted-foreground text-sm">
                                        Add &quot;mcp&quot; or &quot;tools&quot; as a tag to your
                                        ElevenLabs agent so it appears in this demo&apos;s agent
                                        list.
                                    </p>
                                </div>

                                <div className="rounded-lg border p-4">
                                    <h4 className="mb-2 font-medium">
                                        6. Set Environment Variables
                                    </h4>
                                    <p className="text-muted-foreground text-sm">
                                        Add these environment variables to your deployment:
                                    </p>
                                    <pre className="bg-muted mt-3 overflow-x-auto rounded p-3 text-sm">
                                        {`ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_WEBHOOK_SECRET=a_secure_random_string

# Optional: Override default backend agent (default: mcp-agent)
ELEVENLABS_DEFAULT_AGENT_SLUG=your-custom-agent`}
                                    </pre>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
