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

interface OrganizationInfo {
    id: string;
    name: string;
    slug: string;
}

interface MembershipInfo {
    role: string;
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
    const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
    const [membership, setMembership] = useState<MembershipInfo | null>(null);
    const [mcpApiKey, setMcpApiKey] = useState("");
    const [mcpApiKeyActive, setMcpApiKeyActive] = useState(false);
    const [mcpApiKeyLoading, setMcpApiKeyLoading] = useState(false);
    const [mcpApiKeyError, setMcpApiKeyError] = useState<string | null>(null);
    const [showMcpApiKey, setShowMcpApiKey] = useState(false);

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
                        // Filter to only include agent tools (they have agent-specific metadata)
                        const agentTools = data.tools.filter(
                            (tool) => tool.name.startsWith("agent.") && tool.metadata?.agent_slug
                        );
                        setAgents(agentTools);
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

    const loadMcpApiKey = useCallback(async (orgId: string) => {
        setMcpApiKeyLoading(true);
        setMcpApiKeyError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/organizations/${orgId}/mcp-api-key`);
            const data = await res.json();
            if (res.ok && data.success) {
                setMcpApiKey(data.apiKey || "");
                setMcpApiKeyActive(Boolean(data.isActive));
            } else {
                setMcpApiKey("");
                setMcpApiKeyActive(false);
                setMcpApiKeyError(data.error || "Failed to load MCP API key");
            }
        } catch (error) {
            console.error("Failed to load MCP API key:", error);
            setMcpApiKey("");
            setMcpApiKeyActive(false);
            setMcpApiKeyError("Failed to load MCP API key");
        } finally {
            setMcpApiKeyLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchOrganization = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/user/organization`);
                const data = await res.json();
                if (res.ok && data.success) {
                    setOrganization({
                        id: data.organization.id,
                        name: data.organization.name,
                        slug: data.organization.slug
                    });
                    setMembership(data.membership);
                }
            } catch (error) {
                console.error("Failed to fetch organization:", error);
            }
        };

        fetchOrganization();
    }, []);

    useEffect(() => {
        if (organization?.id) {
            loadMcpApiKey(organization.id);
        }
    }, [organization?.id, loadMcpApiKey]);

    const handleGenerateKey = async () => {
        if (!organization?.id) {
            return;
        }
        setMcpApiKeyLoading(true);
        setMcpApiKeyError(null);
        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organization.id}/mcp-api-key`,
                {
                    method: "POST"
                }
            );
            const data = await res.json();
            if (res.ok && data.success) {
                setMcpApiKey(data.apiKey || "");
                setMcpApiKeyActive(true);
                setShowMcpApiKey(true);
            } else {
                setMcpApiKeyError(data.error || "Failed to generate MCP API key");
            }
        } catch (error) {
            console.error("Failed to generate MCP API key:", error);
            setMcpApiKeyError("Failed to generate MCP API key");
        } finally {
            setMcpApiKeyLoading(false);
        }
    };

    const handleRevokeKey = async () => {
        if (!organization?.id) {
            return;
        }
        setMcpApiKeyLoading(true);
        setMcpApiKeyError(null);
        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organization.id}/mcp-api-key`,
                {
                    method: "DELETE"
                }
            );
            const data = await res.json();
            if (res.ok && data.success) {
                setMcpApiKey("");
                setMcpApiKeyActive(false);
                setShowMcpApiKey(false);
            } else {
                setMcpApiKeyError(data.error || "Failed to revoke MCP API key");
            }
        } catch (error) {
            console.error("Failed to revoke MCP API key:", error);
            setMcpApiKeyError("Failed to revoke MCP API key");
        } finally {
            setMcpApiKeyLoading(false);
        }
    };

    // Generate MCP configuration JSON
    const generateMcpConfig = useCallback(() => {
        const apiKeyValue = mcpApiKey || "<GENERATE_MCP_API_KEY>";
        const orgSlugValue = organization?.slug || "<ORG_SLUG>";
        const config = {
            mcpServers: {
                "Mastra Agents": {
                    command: nodePath || "/usr/local/bin/node",
                    args: [serverScriptPath || "~/mastra-mcp-server/index.js"],
                    env: {
                        MASTRA_API_URL: instanceUrl,
                        MASTRA_API_KEY: apiKeyValue,
                        MASTRA_ORGANIZATION_SLUG: orgSlugValue
                    }
                }
            }
        };
        return JSON.stringify(config, null, 2);
    }, [instanceUrl, nodePath, serverScriptPath, mcpApiKey, organization?.slug]);

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
 *   MASTRA_API_KEY - MCP API key
 *   MASTRA_ORGANIZATION_SLUG - Organization slug for MCP access
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Default to production URL
const API_URL = process.env.MASTRA_API_URL || "${instanceUrl}";
const API_KEY = process.env.MASTRA_API_KEY;
const ORGANIZATION_SLUG =
    process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;

// Cache for tools
let toolsCache = null;
let toolsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch available tools from the Mastra API
 */
async function fetchTools() {
    const now = Date.now();
    if (toolsCache && now - toolsCacheTime < CACHE_TTL) {
        return toolsCache;
    }

    try {
        const headers = {
            "Content-Type": "application/json"
        };
        if (API_KEY) {
            headers["X-API-Key"] = API_KEY;
        }
        if (ORGANIZATION_SLUG) {
            headers["X-Organization-Slug"] = ORGANIZATION_SLUG;
        }
        const response = await fetch(\`\${API_URL}/api/mcp\`, { headers });
        const data = await response.json();

        if (!data.success) {
            console.error("Failed to fetch tools:", data.error);
            return [];
        }

        toolsCache = data.tools;
        toolsCacheTime = now;
        return data.tools;
    } catch (error) {
        console.error("Error fetching tools:", error.message);
        return toolsCache || [];
    }
}

/**
 * Invoke a tool via the Mastra MCP gateway
 */
async function invokeTool(toolName, params) {
    const headers = {
        "Content-Type": "application/json"
    };
    if (API_KEY) {
        headers["X-API-Key"] = API_KEY;
    }
    if (ORGANIZATION_SLUG) {
        headers["X-Organization-Slug"] = ORGANIZATION_SLUG;
    }
    const response = await fetch(\`\${API_URL}/api/mcp\`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            method: "tools/call",
            tool: toolName,
            params
        })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || "Tool invocation failed");
    }

    return data.result;
}

// Create server
const server = new Server(
    {
        name: "mastra-agents",
        version: "1.0.0"
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

// Handle list tools request
const toolNameMap = new Map();

server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = await fetchTools();
    toolNameMap.clear();

    return {
        tools: tools.map((tool) => {
            const safeName = tool.name.replace(/[.-]/g, "_");
            toolNameMap.set(safeName, tool.name);

            return {
                name: safeName,
                description: tool.description || \`Invoke \${tool.name}\`,
                inputSchema: tool.inputSchema || {
                    type: "object",
                    properties: {},
                    required: []
                },
                outputSchema: tool.outputSchema
            };
        })
    };
});

// Handle tool call request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const originalName = toolNameMap.get(name) || name;

    try {
        const result = await invokeTool(originalName, args || {});

        let outputText = "";
        if (typeof result === "string") {
            outputText = result;
        } else if (result?.output) {
            outputText =
                typeof result.output === "string"
                    ? result.output
                    : JSON.stringify(result.output, null, 2);
        } else if (result?.outputText) {
            outputText = result.outputText;
        } else {
            outputText = JSON.stringify(result, null, 2);
        }

        const content = [
            {
                type: "text",
                text: outputText
            }
        ];

        const runId = result?.runId || result?.run_id;
        if (runId || result?.status || result?.duration_ms || result?.durationMs) {
            content.push({
                type: "text",
                text: \`\\n---\\nRun ID: \${runId || "n/a"}\\nStatus: \${result?.status || "n/a"}\`
            });
        }

        return { content };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: \`Error invoking tool: \${error.message}\`
                }
            ],
            isError: true
        };
    }
});

// Start server
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

    const canManageKeys = membership?.role === "owner" || membership?.role === "admin";

    const [platform, setPlatform] = useState<"cursor" | "claude-cowork">("cursor");

    // Remote MCP server URL for Claude CoWork (org-scoped)
    const remoteMcpUrl =
        instanceUrl && organization?.slug
            ? `${instanceUrl}/api/mcp/server/${organization.slug}`
            : "";

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto max-w-5xl space-y-6 p-6">
                {/* Header */}
                <div>
                    <h1 className="mb-2 text-3xl font-bold">MCP Setup</h1>
                    <p className="text-muted-foreground">
                        Connect external clients to your Mastra agents via MCP (Model Context
                        Protocol). Choose your platform below.
                    </p>
                </div>

                {/* Platform Selector */}
                <Tabs
                    defaultValue="cursor"
                    value={platform}
                    onValueChange={(v) => setPlatform(v as "cursor" | "claude-cowork")}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="cursor">Cursor IDE</TabsTrigger>
                        <TabsTrigger value="claude-cowork">Claude CoWork</TabsTrigger>
                    </TabsList>

                    {/* ─── Claude CoWork Tab ─── */}
                    <TabsContent value="claude-cowork" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Connect Claude CoWork</CardTitle>
                                <CardDescription>
                                    Add your Mastra agents as a Custom Connector in Claude CoWork.
                                    Claude will be able to call your agents directly via the remote
                                    MCP server.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Step 1 */}
                                <div className="space-y-3">
                                    <h4 className="flex items-center gap-2 font-medium">
                                        <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                            1
                                        </span>
                                        Copy Remote MCP Server URL
                                    </h4>
                                    <p className="text-muted-foreground text-sm">
                                        This URL is unique to your organization and exposes only
                                        your agents via the MCP Streamable HTTP protocol.
                                    </p>
                                    <div className="flex gap-2">
                                        <Input
                                            value={remoteMcpUrl}
                                            readOnly
                                            className="bg-muted flex-1 font-mono text-sm"
                                        />
                                        {remoteMcpUrl && <CopyButton text={remoteMcpUrl} />}
                                    </div>
                                </div>

                                <Separator />

                                {/* Step 2 */}
                                <div className="space-y-3">
                                    <h4 className="flex items-center gap-2 font-medium">
                                        <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                            2
                                        </span>
                                        Generate MCP API Key
                                    </h4>
                                    <p className="text-muted-foreground text-sm">
                                        Generate an API key below and use it as the{" "}
                                        <strong>OAuth Client Secret</strong> in Claude. This ensures
                                        only authorized users can access your organization&apos;s
                                        agents. The key works the same way as the Cursor MCP API
                                        key.
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        Use the <strong>Organization MCP Access</strong> section
                                        below to generate or view your API key.
                                    </p>
                                </div>

                                <Separator />

                                {/* Step 3 */}
                                <div className="space-y-3">
                                    <h4 className="flex items-center gap-2 font-medium">
                                        <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                            3
                                        </span>
                                        Add Custom Connector in Claude
                                    </h4>
                                    <p className="text-muted-foreground text-sm">
                                        In Claude, go to{" "}
                                        <strong>
                                            Settings &gt; Connectors &gt; Add Custom Connector
                                        </strong>{" "}
                                        and fill in the following:
                                    </p>
                                    <div className="bg-muted space-y-2 rounded-lg border p-4 text-sm">
                                        <div className="grid grid-cols-[140px_1fr] gap-2">
                                            <span className="text-muted-foreground font-medium">
                                                Name:
                                            </span>
                                            <span>Mastra Agents</span>
                                        </div>
                                        <div className="grid grid-cols-[140px_1fr] gap-2">
                                            <span className="text-muted-foreground font-medium">
                                                Remote MCP URL:
                                            </span>
                                            <code className="break-all">{remoteMcpUrl}</code>
                                        </div>
                                        <div className="grid grid-cols-[140px_1fr] gap-2">
                                            <span className="text-muted-foreground font-medium">
                                                OAuth Client ID:
                                            </span>
                                            <code>{organization?.slug || "<org-slug>"}</code>
                                        </div>
                                        <div className="grid grid-cols-[140px_1fr] gap-2">
                                            <span className="text-muted-foreground font-medium">
                                                OAuth Client Secret:
                                            </span>
                                            <span>
                                                {mcpApiKey ? (
                                                    <code className="text-xs break-all">
                                                        {showMcpApiKey
                                                            ? mcpApiKey
                                                            : mcpApiKey.substring(0, 8) + "..."}
                                                    </code>
                                                ) : (
                                                    <span className="text-muted-foreground italic">
                                                        (generate a key in Step 2 first)
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        Click <strong>Add</strong>. Claude will complete the OAuth
                                        flow automatically using your credentials, then connect to
                                        your Mastra agents. You can verify by asking Claude to list
                                        available tools.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>How It Works</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-muted-foreground text-sm">
                                    Claude CoWork connects to your Mastra instance using the{" "}
                                    <strong>MCP Streamable HTTP</strong> transport protocol. Unlike
                                    Cursor (which runs a local MCP server via stdio), Claude CoWork
                                    connects directly to your server over HTTPS.
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    Your agents, workflows, and networks are exposed as MCP tools
                                    that Claude can call. Each agent becomes a tool like{" "}
                                    <code className="bg-muted rounded px-1">ask_assistant</code>,
                                    workflows become{" "}
                                    <code className="bg-muted rounded px-1">
                                        run_workflow_my_workflow
                                    </code>
                                    , and networks become{" "}
                                    <code className="bg-muted rounded px-1">
                                        route_network_my_network
                                    </code>
                                    .
                                </p>
                                <div className="flex gap-2">
                                    <a
                                        href="https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                    >
                                        <ExternalLinkIcon className="h-4 w-4" />
                                        Claude Connectors Guide
                                    </a>
                                    <a
                                        href="https://modelcontextprotocol.io/specification/2025-03-26/basic/transports"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                    >
                                        <ExternalLinkIcon className="h-4 w-4" />
                                        MCP Transport Spec
                                    </a>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ─── Cursor IDE Tab ─── */}
                    <TabsContent value="cursor" className="space-y-6">
                        <p className="text-muted-foreground text-sm">
                            Configure your Cursor IDE to use your Mastra agents as MCP tools. This
                            allows Claude in Cursor to call your agents directly.
                        </p>
                    </TabsContent>
                </Tabs>

                {/* Organization MCP Access -- shared across both tabs */}
                <Card>
                    <CardHeader>
                        <CardTitle>Organization MCP Access</CardTitle>
                        <CardDescription>
                            Use this slug and API key in your Cursor MCP configuration
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="orgName">Organization</Label>
                                <Input
                                    id="orgName"
                                    value={organization?.name || ""}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="orgSlug">Organization Slug</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="orgSlug"
                                        value={organization?.slug || ""}
                                        disabled
                                        className="bg-muted flex-1"
                                    />
                                    {organization?.slug && <CopyButton text={organization.slug} />}
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    Use this for <code>MASTRA_ORGANIZATION_SLUG</code>
                                </p>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="mcpApiKey">MCP API Key</Label>
                                <Badge variant={mcpApiKeyActive ? "default" : "secondary"}>
                                    {mcpApiKeyActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    id="mcpApiKey"
                                    value={mcpApiKey}
                                    type={showMcpApiKey ? "text" : "password"}
                                    placeholder="No MCP API key generated yet"
                                    disabled
                                    className="bg-muted min-w-[240px] flex-1"
                                />
                                {mcpApiKey && <CopyButton text={mcpApiKey} />}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowMcpApiKey((current) => !current)}
                                    disabled={!mcpApiKey}
                                >
                                    {showMcpApiKey ? "Hide" : "Show"}
                                </Button>
                            </div>
                            {mcpApiKeyError && (
                                <p className="text-destructive text-xs">{mcpApiKeyError}</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {canManageKeys ? (
                                    <>
                                        <Button
                                            onClick={handleGenerateKey}
                                            disabled={mcpApiKeyLoading}
                                        >
                                            {mcpApiKey ? "Rotate Key" : "Generate Key"}
                                        </Button>
                                        {mcpApiKey && (
                                            <Button
                                                variant="destructive"
                                                onClick={handleRevokeKey}
                                                disabled={mcpApiKeyLoading}
                                            >
                                                Revoke Key
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-muted-foreground text-xs">
                                        Only organization owners or admins can manage MCP API keys.
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Instance Configuration + Setup Instructions -- Cursor only */}
                {platform === "cursor" && (
                    <>
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
                                            Run{" "}
                                            <code className="bg-muted rounded px-1">
                                                which node
                                            </code>{" "}
                                            to find your path
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
                                            <code className="bg-muted rounded px-1">
                                                ~/mastra-mcp-server/
                                            </code>
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                                2
                                            </span>
                                            Generate MCP API Key
                                        </CardTitle>
                                        <CardDescription>
                                            Create or rotate the key for this organization
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground text-sm">
                                            Use the controls above to generate your MCP API key,
                                            then copy the organization slug shown in the same
                                            section.
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                                3
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
                                                4
                                            </span>
                                            Add to Cursor MCP Config
                                        </CardTitle>
                                        <CardDescription>
                                            Add the following to your{" "}
                                            <code className="bg-muted rounded px-1">
                                                ~/.cursor/mcp.json
                                            </code>
                                            . It includes your organization slug and API key.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <CodeBlock code={generateMcpConfig()} language="json" />
                                        <p className="text-muted-foreground mt-3 text-sm">
                                            If the file already has content, merge the{" "}
                                            <code className="bg-muted rounded px-1">
                                                mcpServers
                                            </code>{" "}
                                            entries.
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm">
                                                5
                                            </span>
                                            Restart Cursor
                                        </CardTitle>
                                        <CardDescription>
                                            Restart Cursor to load the new MCP server
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground text-sm">
                                            After restarting, Claude in Cursor will be able to use
                                            your agents as tools. You can verify by asking Claude to
                                            list available tools.
                                        </p>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="manual" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>MCP Server Script</CardTitle>
                                        <CardDescription>
                                            Create a file called <code>index.js</code> with this
                                            content
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
                    </>
                )}

                {/* Available Agents */}
                <Card>
                    <CardHeader>
                        <CardTitle>Available Agents</CardTitle>
                        <CardDescription>
                            These agents will be available as MCP tools
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
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-xs"
                                                        >
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
                                    your terminal to find the full path to your Node.js
                                    installation.
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
                                    <strong>Unauthorized errors:</strong> Confirm your MCP API key
                                    and organization slug match the values shown above
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
        </div>
    );
}
