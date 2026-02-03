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
    Badge,
    Input,
    Label,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Separator
} from "@repo/ui";
import { CheckIcon, CopyIcon, ExternalLinkIcon, DownloadIcon } from "lucide-react";

interface AgentTool {
    name: string;
    description: string;
    version: string;
    metadata: {
        agent_id: string;
        agent_slug: string;
        agent_name: string;
        model: string;
        is_active: boolean;
        is_public: boolean;
        workspace?: string;
    };
    inputSchema: {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
    };
}

interface McpApiResponse {
    success: boolean;
    protocol: string;
    server_info: {
        name: string;
        version: string;
        capabilities: string[];
    };
    tools: AgentTool[];
    total: number;
}

// Copy button with feedback
function CopyButton({ text, className = "" }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleCopy} className={className}>
            {copied ? (
                <>
                    <CheckIcon className="mr-2 h-4 w-4" />
                    Copied!
                </>
            ) : (
                <>
                    <CopyIcon className="mr-2 h-4 w-4" />
                    Copy
                </>
            )}
        </Button>
    );
}

// Code block with copy functionality
function CodeBlock({
    code,
    language = "json",
    showCopy = true
}: {
    code: string;
    language?: string;
    showCopy?: boolean;
}) {
    return (
        <div className="relative">
            <pre className="bg-muted overflow-auto rounded-lg border p-4 text-sm">
                <code className={`language-${language}`}>{code}</code>
            </pre>
            {showCopy && (
                <div className="absolute top-2 right-2">
                    <CopyButton text={code} />
                </div>
            )}
        </div>
    );
}

export default function McpSetupPage() {
    const [loading, setLoading] = useState(true);
    const [agents, setAgents] = useState<AgentTool[]>([]);
    const [instanceUrl, setInstanceUrl] = useState("");
    const [nodePath, setNodePath] = useState("");
    const [serverScriptPath, setServerScriptPath] = useState("");

    // Detect the current instance URL
    useEffect(() => {
        if (typeof window !== "undefined") {
            const protocol = window.location.protocol;
            const host = window.location.host;
            setInstanceUrl(`${protocol}//${host}`);
        }
    }, []);

    // Fetch available agents
    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/mcp`);
                if (res.ok) {
                    const data: McpApiResponse = await res.json();
                    if (data.success) {
                        setAgents(data.tools);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch agents:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAgents();
    }, []);

    // Detect node path (show a reasonable default)
    useEffect(() => {
        // Common node paths
        const defaultNodePath =
            process.env.NODE_ENV === "production" ? "/usr/local/bin/node" : "$(which node)";
        setNodePath(defaultNodePath);

        // Default script path (user will need to customize)
        setServerScriptPath("~/mastra-mcp-server/index.js");
    }, []);

    // Generate MCP configuration JSON
    const generateMcpConfig = useCallback(() => {
        const config = {
            mcpServers: {
                "Mastra Agents": {
                    command: nodePath || "/usr/local/bin/node",
                    args: [serverScriptPath || "~/mastra-mcp-server/index.js"],
                    env: {
                        MASTRA_API_URL: instanceUrl
                    }
                }
            }
        };
        return JSON.stringify(config, null, 2);
    }, [instanceUrl, nodePath, serverScriptPath]);

    // Generate the server script download
    const serverScript = `#!/usr/bin/env node

/**
 * Mastra Agent MCP Server
 *
 * Exposes all Mastra agents as MCP tools that can be called from Cursor.
 *
 * Usage:
 *   node index.js
 *
 * Environment:
 *   MASTRA_API_URL - Base URL for the Mastra API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.MASTRA_API_URL || "${instanceUrl}";

// Cache for tools
let toolsCache = null;
let toolsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

async function fetchAgents() {
    const now = Date.now();
    if (toolsCache && now - toolsCacheTime < CACHE_TTL) {
        return toolsCache;
    }

    try {
        const response = await fetch(\`\${API_URL}/api/mcp\`);
        const data = await response.json();

        if (!data.success) {
            console.error("Failed to fetch agents:", data.error);
            return [];
        }

        toolsCache = data.tools;
        toolsCacheTime = now;
        return data.tools;
    } catch (error) {
        console.error("Error fetching agents:", error.message);
        return toolsCache || [];
    }
}

async function invokeAgent(agentSlug, input, context) {
    const response = await fetch(\`\${API_URL}/api/agents/\${agentSlug}/invoke\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, context, mode: "sync" })
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error || "Agent invocation failed");
    }
    return data;
}

const server = new Server(
    { name: "mastra-agents", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    const agents = await fetchAgents();
    return {
        tools: agents.map((agent) => {
            const rawName = agent.name.startsWith("agent.") ? agent.name.slice(6) : agent.name;
            const toolName = rawName.replace(/-/g, "_");
            return {
                name: toolName,
                description: agent.description || \`Invoke the \${agent.metadata?.agent_name || agent.name} agent\`,
                inputSchema: {
                    type: "object",
                    properties: {
                        input: { type: "string", description: "The message or task to send to the agent" },
                        context: { type: "object", description: "Optional context variables", additionalProperties: true }
                    },
                    required: ["input"]
                }
            };
        })
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const agentSlug = name.replace(/_/g, "-");

    try {
        const result = await invokeAgent(agentSlug, args.input, args.context);
        const content = [{ type: "text", text: result.output }];
        if (result.usage || result.cost_usd || result.duration_ms) {
            content.push({
                type: "text",
                text: \`\\n---\\nRun ID: \${result.run_id}\\nModel: \${result.model}\\nTokens: \${result.usage?.total_tokens || 0}\\nCost: $\${result.cost_usd?.toFixed(5) || 0}\\nDuration: \${result.duration_ms}ms\`
            });
        }
        return { content };
    } catch (error) {
        return { content: [{ type: "text", text: \`Error invoking agent: \${error.message}\` }], isError: true };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Mastra Agent MCP Server started");
}

main().catch(console.error);
`;

    const packageJson = `{
  "name": "mastra-agent-mcp-server",
  "version": "1.0.0",
  "description": "MCP server that exposes Mastra agents as callable tools",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
`;

    const downloadServerFiles = () => {
        // Create a zip-like download with both files
        const blob = new Blob([serverScript], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "index.js";
        a.click();
        URL.revokeObjectURL(url);

        // Also download package.json
        setTimeout(() => {
            const pkgBlob = new Blob([packageJson], { type: "application/json" });
            const pkgUrl = URL.createObjectURL(pkgBlob);
            const pkgA = document.createElement("a");
            pkgA.href = pkgUrl;
            pkgA.download = "package.json";
            pkgA.click();
            URL.revokeObjectURL(pkgUrl);
        }, 500);
    };

    return (
        <div className="container mx-auto max-w-5xl space-y-6 p-6">
            {/* Header */}
            <div>
                <h1 className="mb-2 text-3xl font-bold">MCP Setup for Cursor</h1>
                <p className="text-muted-foreground">
                    Configure your Cursor IDE to use your Mastra agents as MCP tools. This allows
                    Claude in Cursor to call your agents directly.
                </p>
            </div>

            {/* Instance Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Your Instance</CardTitle>
                    <CardDescription>
                        Configure the connection to your Mastra instance
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="instanceUrl">Instance URL</Label>
                            <Input
                                id="instanceUrl"
                                value={instanceUrl}
                                onChange={(e) => setInstanceUrl(e.target.value)}
                                placeholder="https://your-instance.com/agent"
                            />
                            <p className="text-muted-foreground text-xs">
                                The base URL of your Mastra deployment
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nodePath">Node.js Path</Label>
                            <Input
                                id="nodePath"
                                value={nodePath}
                                onChange={(e) => setNodePath(e.target.value)}
                                placeholder="/usr/local/bin/node"
                            />
                            <p className="text-muted-foreground text-xs">
                                Run <code className="bg-muted rounded px-1">which node</code> to
                                find your path
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="serverScriptPath">Server Script Path</Label>
                        <Input
                            id="serverScriptPath"
                            value={serverScriptPath}
                            onChange={(e) => setServerScriptPath(e.target.value)}
                            placeholder="~/mastra-mcp-server/index.js"
                        />
                        <p className="text-muted-foreground text-xs">
                            Where you will save the MCP server script
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Setup Instructions */}
            <Tabs defaultValue="quick" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="quick">Quick Setup</TabsTrigger>
                    <TabsTrigger value="manual">Manual Setup</TabsTrigger>
                </TabsList>

                <TabsContent value="quick" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                    1
                                </span>
                                Download Server Files
                            </CardTitle>
                            <CardDescription>
                                Download the MCP server script and package.json
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={downloadServerFiles}>
                                <DownloadIcon className="mr-2 h-4 w-4" />
                                Download Server Files
                            </Button>
                            <p className="text-muted-foreground mt-2 text-sm">
                                Save these files to a folder like{" "}
                                <code className="bg-muted rounded px-1">~/mastra-mcp-server/</code>
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                    2
                                </span>
                                Install Dependencies
                            </CardTitle>
                            <CardDescription>
                                Navigate to the folder and install the required package
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock
                                code={`cd ~/mastra-mcp-server
npm install`}
                                language="bash"
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                    3
                                </span>
                                Add to Cursor MCP Config
                            </CardTitle>
                            <CardDescription>
                                Add the following to your{" "}
                                <code className="bg-muted rounded px-1">~/.cursor/mcp.json</code>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock code={generateMcpConfig()} language="json" />
                            <p className="text-muted-foreground mt-3 text-sm">
                                If the file already has content, merge the{" "}
                                <code className="bg-muted rounded px-1">mcpServers</code> entries.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                    4
                                </span>
                                Restart Cursor
                            </CardTitle>
                            <CardDescription>
                                Restart Cursor to load the new MCP server
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-sm">
                                After restarting, Claude in Cursor will be able to use your agents
                                as tools. You can verify by asking Claude to list available tools.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>MCP Server Script</CardTitle>
                            <CardDescription>
                                Create a file called <code>index.js</code> with this content
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="max-h-96 overflow-auto">
                                <CodeBlock code={serverScript} language="javascript" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Package Configuration</CardTitle>
                            <CardDescription>
                                Create a <code>package.json</code> in the same folder
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock code={packageJson} language="json" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Cursor MCP Configuration</CardTitle>
                            <CardDescription>
                                Add to <code>~/.cursor/mcp.json</code>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CodeBlock code={generateMcpConfig()} language="json" />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Available Agents */}
            <Card>
                <CardHeader>
                    <CardTitle>Available Agents</CardTitle>
                    <CardDescription>
                        These agents will be available as MCP tools in Cursor
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
                        </div>
                    ) : agents.length > 0 ? (
                        <div className="grid gap-3">
                            {agents.map((agent) => {
                                const toolName = agent.metadata.agent_slug.replace(/-/g, "_");
                                return (
                                    <div
                                        key={agent.metadata.agent_id}
                                        className="bg-muted/30 flex items-start justify-between rounded-lg border p-4"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <code className="text-primary font-mono text-sm font-medium">
                                                    {toolName}
                                                </code>
                                                <Badge variant="outline" className="text-xs">
                                                    {agent.metadata.model}
                                                </Badge>
                                                {agent.metadata.is_public && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Public
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                {agent.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground py-4 text-center">
                            No agents available. Create some agents first.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Help Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Need Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <h4 className="mb-2 font-medium">Finding your Node.js path</h4>
                            <p className="text-muted-foreground text-sm">
                                Run <code className="bg-muted rounded px-1">which node</code> in
                                your terminal to find the full path to your Node.js installation.
                            </p>
                        </div>
                        <div>
                            <h4 className="mb-2 font-medium">Testing the connection</h4>
                            <p className="text-muted-foreground text-sm">
                                After setup, ask Claude in Cursor:{" "}
                                <em>&quot;What MCP tools do you have available?&quot;</em>
                            </p>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h4 className="mb-2 font-medium">Troubleshooting</h4>
                        <ul className="text-muted-foreground space-y-1 text-sm">
                            <li>
                                <strong>Tools not appearing:</strong> Make sure Cursor is fully
                                restarted after editing mcp.json
                            </li>
                            <li>
                                <strong>Connection errors:</strong> Verify your instance URL is
                                accessible from your machine
                            </li>
                            <li>
                                <strong>CORS issues:</strong> Your Mastra instance may need CORS
                                configured for MCP access
                            </li>
                        </ul>
                    </div>

                    <div className="flex gap-2">
                        <a
                            href="https://docs.cursor.com/mcp"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            <ExternalLinkIcon className="h-4 w-4" />
                            Cursor MCP Docs
                        </a>
                        <a
                            href="https://modelcontextprotocol.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            <ExternalLinkIcon className="h-4 w-4" />
                            MCP Specification
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
