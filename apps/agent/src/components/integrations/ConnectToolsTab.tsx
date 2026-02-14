"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Input,
    Label,
    Separator
} from "@repo/ui";
import {
    CheckIcon,
    ChevronDownIcon,
    CopyIcon,
    DownloadIcon,
    ExternalLinkIcon,
    MonitorIcon,
    CloudIcon
} from "lucide-react";

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* noop */
        }
    };
    return (
        <Button variant="outline" size="sm" onClick={handleCopy} className={className}>
            {copied ? (
                <>
                    <CheckIcon className="mr-1.5 h-3.5 w-3.5" />
                    Copied
                </>
            ) : (
                <>
                    <CopyIcon className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                </>
            )}
        </Button>
    );
}

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
    return (
        <div className="relative">
            <pre className="bg-muted overflow-auto rounded-lg border p-4 text-sm">
                <code className={`language-${language}`}>{code}</code>
            </pre>
            <div className="absolute top-2 right-2">
                <CopyButton text={code} />
            </div>
        </div>
    );
}

function StepNumber({ n }: { n: number }) {
    return (
        <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-medium">
            {n}
        </span>
    );
}

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

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

interface OrganizationInfo {
    id: string;
    name: string;
    slug: string;
}

interface MembershipInfo {
    role: string;
}

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */

export function ConnectToolsTab() {
    const [loading, setLoading] = useState(true);
    const [agents, setAgents] = useState<AgentTool[]>([]);
    const [instanceUrl, setInstanceUrl] = useState("");
    const [nodePath, setNodePath] = useState("/usr/local/bin/node");
    const [serverScriptPath, setServerScriptPath] = useState("~/mastra-mcp-server/index.js");
    const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
    const [membership, setMembership] = useState<MembershipInfo | null>(null);
    const [mcpApiKey, setMcpApiKey] = useState("");
    const [mcpApiKeyActive, setMcpApiKeyActive] = useState(false);
    const [mcpApiKeyLoading, setMcpApiKeyLoading] = useState(false);
    const [mcpApiKeyError, setMcpApiKeyError] = useState<string | null>(null);
    const [showMcpApiKey, setShowMcpApiKey] = useState(false);

    // ── Detect instance URL ──────────────────────────────────────────
    useEffect(() => {
        if (typeof window !== "undefined") {
            setInstanceUrl(`${window.location.protocol}//${window.location.host}`);
        }
    }, []);

    // ── Fetch agents ──────────────────────────────────────────────────
    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/mcp`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        setAgents(
                            (data.tools || []).filter(
                                (t: AgentTool) =>
                                    t.name.startsWith("agent.") && t.metadata?.agent_slug
                            )
                        );
                    }
                }
            } catch {
                /* noop */
            } finally {
                setLoading(false);
            }
        };
        fetchAgents();
    }, []);

    // ── Fetch organization ─────────────────────────────────────────────
    useEffect(() => {
        const fetchOrg = async () => {
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
            } catch {
                /* noop */
            }
        };
        fetchOrg();
    }, []);

    // ── Load MCP API key ──────────────────────────────────────────────
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
            }
        } catch {
            setMcpApiKey("");
            setMcpApiKeyActive(false);
        } finally {
            setMcpApiKeyLoading(false);
        }
    }, []);

    useEffect(() => {
        if (organization?.id) loadMcpApiKey(organization.id);
    }, [organization?.id, loadMcpApiKey]);

    const handleGenerateKey = async () => {
        if (!organization?.id) return;
        setMcpApiKeyLoading(true);
        setMcpApiKeyError(null);
        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organization.id}/mcp-api-key`,
                { method: "POST" }
            );
            const data = await res.json();
            if (res.ok && data.success) {
                setMcpApiKey(data.apiKey || "");
                setMcpApiKeyActive(true);
                setShowMcpApiKey(true);
            } else {
                setMcpApiKeyError(data.error || "Failed to generate MCP API key");
            }
        } catch {
            setMcpApiKeyError("Failed to generate MCP API key");
        } finally {
            setMcpApiKeyLoading(false);
        }
    };

    const handleRevokeKey = async () => {
        if (!organization?.id) return;
        setMcpApiKeyLoading(true);
        setMcpApiKeyError(null);
        try {
            const res = await fetch(
                `${getApiBase()}/api/organizations/${organization.id}/mcp-api-key`,
                { method: "DELETE" }
            );
            const data = await res.json();
            if (res.ok && data.success) {
                setMcpApiKey("");
                setMcpApiKeyActive(false);
                setShowMcpApiKey(false);
            } else {
                setMcpApiKeyError(data.error || "Failed to revoke MCP API key");
            }
        } catch {
            setMcpApiKeyError("Failed to revoke MCP API key");
        } finally {
            setMcpApiKeyLoading(false);
        }
    };

    const canManageKeys = membership?.role === "owner" || membership?.role === "admin";

    // ── MCP config JSON ──────────────────────────────────────────────
    const generateMcpConfig = useCallback(() => {
        const config = {
            mcpServers: {
                "Mastra Agents": {
                    command: nodePath || "/usr/local/bin/node",
                    args: [serverScriptPath || "~/mastra-mcp-server/index.js"],
                    env: {
                        MASTRA_API_URL: instanceUrl,
                        MASTRA_API_KEY: mcpApiKey || "<GENERATE_MCP_API_KEY>",
                        MASTRA_ORGANIZATION_SLUG: organization?.slug || "<ORG_SLUG>"
                    }
                }
            }
        };
        return JSON.stringify(config, null, 2);
    }, [instanceUrl, nodePath, serverScriptPath, mcpApiKey, organization?.slug]);

    // ── Server script for download ──────────────────────────────────
    const serverScript = `#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.MASTRA_API_URL || "${instanceUrl}";
const API_KEY = process.env.MASTRA_API_KEY;
const ORG_SLUG = process.env.MASTRA_ORGANIZATION_SLUG || process.env.MCP_API_ORGANIZATION_SLUG;
let toolsCache = null, toolsCacheTime = 0;

async function fetchTools() {
    if (toolsCache && Date.now() - toolsCacheTime < 60000) return toolsCache;
    const headers = { "Content-Type": "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;
    if (ORG_SLUG) headers["X-Organization-Slug"] = ORG_SLUG;
    const res = await fetch(\`\${API_URL}/api/mcp\`, { headers });
    const data = await res.json();
    if (!data.success) return toolsCache || [];
    toolsCache = data.tools; toolsCacheTime = Date.now();
    return data.tools;
}

async function invokeTool(name, params) {
    const headers = { "Content-Type": "application/json" };
    if (API_KEY) headers["X-API-Key"] = API_KEY;
    if (ORG_SLUG) headers["X-Organization-Slug"] = ORG_SLUG;
    const res = await fetch(\`\${API_URL}/api/mcp\`, {
        method: "POST", headers,
        body: JSON.stringify({ method: "tools/call", tool: name, params })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Tool invocation failed");
    return data.result;
}

const server = new Server({ name: "mastra-agents", version: "1.0.0" }, { capabilities: { tools: {} } });
const nameMap = new Map();

server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = await fetchTools(); nameMap.clear();
    return { tools: tools.map(t => {
        const safe = t.name.replace(/[.-]/g, "_"); nameMap.set(safe, t.name);
        return { name: safe, description: t.description || \`Invoke \${t.name}\`, inputSchema: t.inputSchema || { type: "object", properties: {}, required: [] } };
    }) };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
        const result = await invokeTool(nameMap.get(name) || name, args || {});
        const text = typeof result === "string" ? result : result?.output ? (typeof result.output === "string" ? result.output : JSON.stringify(result.output, null, 2)) : JSON.stringify(result, null, 2);
        return { content: [{ type: "text", text }] };
    } catch (e) { return { content: [{ type: "text", text: "Error: " + e.message }], isError: true }; }
});

const transport = new StdioServerTransport();
await server.connect(transport);
`;

    const packageJson = `{
  "name": "mastra-agent-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}`;

    const downloadServerFiles = () => {
        const blob = new Blob([serverScript], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "index.js";
        a.click();
        URL.revokeObjectURL(url);
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

    const remoteMcpUrl =
        instanceUrl && organization?.slug
            ? `${instanceUrl}/api/mcp/server/${organization.slug}`
            : "";

    /* ================================================================ */
    /*  Render                                                          */
    /* ================================================================ */

    return (
        <div className="space-y-6">
            {/* ── Hero ─────────────────────────────────────────────── */}
            <div>
                <h3 className="text-lg font-semibold tracking-tight">Connect Your AI Tools</h3>
                <p className="text-muted-foreground text-sm">
                    Use your Mastra agents directly from Cursor IDE or Claude CoWork. Pick your
                    platform and follow the steps below.
                </p>
            </div>

            {/* ── Platform cards ────────────────────────────────────── */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* ─── Cursor IDE ─── */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                                <MonitorIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Cursor IDE</CardTitle>
                                <CardDescription>Local MCP server via stdio</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                        {/* Step 1 */}
                        <Collapsible>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
                                <StepNumber n={1} />
                                Download server files
                                <ChevronDownIcon className="text-muted-foreground ml-auto h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-3 pl-8">
                                <p className="text-muted-foreground text-sm">
                                    Download <code className="bg-muted rounded px-1">index.js</code>{" "}
                                    and <code className="bg-muted rounded px-1">package.json</code>,
                                    then save them to a folder like{" "}
                                    <code className="bg-muted rounded px-1">
                                        ~/mastra-mcp-server/
                                    </code>
                                    .
                                </p>
                                <Button size="sm" onClick={downloadServerFiles}>
                                    <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                                    Download Server Files
                                </Button>
                            </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Step 2 */}
                        <Collapsible>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
                                <StepNumber n={2} />
                                Install dependencies
                                <ChevronDownIcon className="text-muted-foreground ml-auto h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 pl-8">
                                <CodeBlock
                                    code={`cd ~/mastra-mcp-server\nnpm install`}
                                    language="bash"
                                />
                            </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Step 3 */}
                        <Collapsible>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
                                <StepNumber n={3} />
                                Generate MCP API key
                                <ChevronDownIcon className="text-muted-foreground ml-auto h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-2 pl-8">
                                <p className="text-muted-foreground text-sm">
                                    Use the <strong>Organization MCP Access</strong> section below
                                    to generate or view your API key and org slug.
                                </p>
                            </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Step 4 */}
                        <Collapsible>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
                                <StepNumber n={4} />
                                Add to Cursor config
                                <ChevronDownIcon className="text-muted-foreground ml-auto h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-3 pl-8">
                                <p className="text-muted-foreground text-sm">
                                    Add this to{" "}
                                    <code className="bg-muted rounded px-1">
                                        ~/.cursor/mcp.json
                                    </code>
                                    . If the file already exists, merge the{" "}
                                    <code className="bg-muted rounded px-1">mcpServers</code>{" "}
                                    entries.
                                </p>
                                <div className="space-y-2">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Node.js Path</Label>
                                            <Input
                                                value={nodePath}
                                                onChange={(e) => setNodePath(e.target.value)}
                                                placeholder="/usr/local/bin/node"
                                                className="text-xs"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Server Script Path</Label>
                                            <Input
                                                value={serverScriptPath}
                                                onChange={(e) =>
                                                    setServerScriptPath(e.target.value)
                                                }
                                                placeholder="~/mastra-mcp-server/index.js"
                                                className="text-xs"
                                            />
                                        </div>
                                    </div>
                                    <CodeBlock code={generateMcpConfig()} language="json" />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Step 5 */}
                        <Collapsible>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
                                <StepNumber n={5} />
                                Restart Cursor
                                <ChevronDownIcon className="text-muted-foreground ml-auto h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 pl-8">
                                <p className="text-muted-foreground text-sm">
                                    Restart Cursor to load the new MCP server. Then ask Claude:{" "}
                                    <em>&quot;What MCP tools do you have available?&quot;</em>
                                </p>
                            </CollapsibleContent>
                        </Collapsible>
                    </CardContent>
                </Card>

                {/* ─── Claude CoWork ─── */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                                <CloudIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Claude CoWork</CardTitle>
                                <CardDescription>
                                    Remote MCP server via Streamable HTTP
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                        {/* Step 1 */}
                        <Collapsible>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
                                <StepNumber n={1} />
                                Copy Remote MCP Server URL
                                <ChevronDownIcon className="text-muted-foreground ml-auto h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-2 pl-8">
                                <p className="text-muted-foreground text-sm">
                                    This URL is unique to your organization and uses MCP Streamable
                                    HTTP transport.
                                </p>
                                <div className="flex gap-2">
                                    <Input
                                        value={remoteMcpUrl}
                                        readOnly
                                        className="bg-muted flex-1 font-mono text-xs"
                                    />
                                    {remoteMcpUrl && <CopyButton text={remoteMcpUrl} />}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Step 2 */}
                        <Collapsible>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
                                <StepNumber n={2} />
                                Generate MCP API key
                                <ChevronDownIcon className="text-muted-foreground ml-auto h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-2 pl-8">
                                <p className="text-muted-foreground text-sm">
                                    Use the <strong>Organization MCP Access</strong> section below.
                                    The API key is used as the <strong>OAuth Client Secret</strong>{" "}
                                    in Claude.
                                </p>
                            </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Step 3 */}
                        <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
                                <StepNumber n={3} />
                                Add Custom Connector in Claude
                                <ChevronDownIcon className="text-muted-foreground ml-auto h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-3 pl-8">
                                <p className="text-muted-foreground text-sm">
                                    In Claude, go to{" "}
                                    <strong>
                                        Settings &gt; Connectors &gt; Add Custom Connector
                                    </strong>{" "}
                                    and fill in:
                                </p>
                                <div className="bg-muted space-y-2 rounded-lg border p-4 text-sm">
                                    <div className="grid grid-cols-[120px_1fr] gap-2">
                                        <span className="text-muted-foreground font-medium">
                                            Name:
                                        </span>
                                        <span>Mastra Agents</span>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr] gap-2">
                                        <span className="text-muted-foreground font-medium">
                                            Remote MCP URL:
                                        </span>
                                        <code className="text-xs break-all">
                                            {remoteMcpUrl || "<generate url above>"}
                                        </code>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr] gap-2">
                                        <span className="text-muted-foreground font-medium">
                                            OAuth Client ID:
                                        </span>
                                        <code className="text-xs">
                                            {organization?.slug || "<org-slug>"}
                                        </code>
                                    </div>
                                    <div className="grid grid-cols-[120px_1fr] gap-2">
                                        <span className="text-muted-foreground font-medium">
                                            OAuth Client Secret:
                                        </span>
                                        {mcpApiKey ? (
                                            <code className="text-xs break-all">
                                                {showMcpApiKey
                                                    ? mcpApiKey
                                                    : mcpApiKey.substring(0, 8) + "..."}
                                            </code>
                                        ) : (
                                            <span className="text-muted-foreground text-xs italic">
                                                (generate key below first)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    Click <strong>Add</strong>. Claude completes the OAuth flow
                                    automatically and connects to your agents.
                                </p>
                            </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        <div className="flex gap-2">
                            <a
                                href="https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors"
                            >
                                <ExternalLinkIcon className="h-3.5 w-3.5" />
                                Claude Connectors Guide
                            </a>
                            <a
                                href="https://docs.cursor.com/mcp"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors"
                            >
                                <ExternalLinkIcon className="h-3.5 w-3.5" />
                                Cursor MCP Docs
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Organization MCP Access (shared) ──────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle>Organization MCP Access</CardTitle>
                    <CardDescription>
                        Your organization slug and API key are used by both Cursor and Claude
                        CoWork.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                            <Label className="text-xs">Organization</Label>
                            <Input value={organization?.name || ""} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Organization Slug</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={organization?.slug || ""}
                                    disabled
                                    className="bg-muted flex-1"
                                />
                                {organization?.slug && <CopyButton text={organization.slug} />}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                Use for <code>MASTRA_ORGANIZATION_SLUG</code>
                            </p>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">MCP API Key</Label>
                            <Badge variant={mcpApiKeyActive ? "default" : "secondary"}>
                                {mcpApiKeyActive ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Input
                                value={mcpApiKey}
                                type={showMcpApiKey ? "text" : "password"}
                                placeholder="No MCP API key generated yet"
                                disabled
                                className="bg-muted min-w-0 flex-1 text-xs sm:min-w-[200px]"
                            />
                            {mcpApiKey && <CopyButton text={mcpApiKey} />}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowMcpApiKey((c) => !c)}
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
                                        size="sm"
                                        onClick={handleGenerateKey}
                                        disabled={mcpApiKeyLoading}
                                    >
                                        {mcpApiKey ? "Rotate Key" : "Generate Key"}
                                    </Button>
                                    {mcpApiKey && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
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

            {/* ── Available Agents ──────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle>Available Agents</CardTitle>
                    <CardDescription>
                        These agents will be accessible as MCP tools from Cursor and Claude
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-6">
                            <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
                        </div>
                    ) : agents.length > 0 ? (
                        <div className="grid gap-2">
                            {agents.map((agent) => (
                                <div
                                    key={agent.metadata.agent_id}
                                    className="bg-muted/30 flex items-center justify-between rounded-lg border px-4 py-3"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <code className="text-primary text-sm font-medium">
                                                {agent.metadata.agent_slug.replace(/-/g, "_")}
                                            </code>
                                            <Badge variant="outline" className="text-[10px]">
                                                {agent.metadata.model}
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                            {agent.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                            No agents available. Create some agents first.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
