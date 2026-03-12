"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import {
    ArrowLeftIcon,
    CheckCircle2Icon,
    AlertTriangleIcon,
    CopyIcon,
    CheckIcon,
    Loader2Icon,
    RefreshCwIcon,
    SearchIcon,
    ShieldCheckIcon,
    XCircleIcon,
    PlugIcon,
    UnplugIcon,
    CodeIcon,
    LinkIcon,
    WrenchIcon,
    UsersIcon,
    SettingsIcon
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type ConnectionSummary = {
    id: string;
    name: string;
    scope: string;
    isDefault: boolean;
    isActive: boolean;
    connected: boolean;
    missingFields: string[];
    accessPolicy?: string;
};

type IntegrationProvider = {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    category: string;
    authType: string;
    providerType: string;
    status: string;
    connections: ConnectionSummary[];
    actions?: Record<string, unknown> | null;
    triggers?: Record<string, unknown> | null;
    config?: Record<string, unknown> | null;
};

type IntegrationToolRecord = {
    id: string;
    toolId: string;
    name: string;
    description: string | null;
    isEnabled: boolean;
    validationStatus: string;
    lastValidatedAt: string | null;
    errorMessage: string | null;
    usedByCount?: number;
};

type UsedByItem = {
    type: "agent" | "skill" | "playbook";
    id: string;
    name: string;
    slug: string;
    toolIds: string[];
};

type TestResult = {
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
};

/* -------------------------------------------------------------------------- */
/*  IntegrationManagePage                                                      */
/* -------------------------------------------------------------------------- */

export function IntegrationManagePage({ providerKey }: { providerKey: string }) {
    const [provider, setProvider] = useState<IntegrationProvider | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");

    const fetchProvider = useCallback(async () => {
        try {
            const res = await fetch(
                `${getApiBase()}/api/integrations/providers?key=${providerKey}`
            );
            const data = await res.json();
            if (data.success && data.providers?.length > 0) {
                setProvider(data.providers[0]);
            }
        } catch (err) {
            console.error("Failed to fetch provider:", err);
        } finally {
            setLoading(false);
        }
    }, [providerKey]);

    useEffect(() => {
        fetchProvider();
    }, [fetchProvider]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (!provider) {
        return <div className="text-muted-foreground py-20 text-center">Provider not found</div>;
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link
                    href="/mcp"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold">{provider.name}</h1>
                        <IntegrationStatusBadge provider={provider} />
                    </div>
                    {provider.description && (
                        <p className="text-muted-foreground mt-1 text-sm">{provider.description}</p>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview" className="gap-1.5">
                        <SettingsIcon className="h-3.5 w-3.5" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="gap-1.5">
                        <WrenchIcon className="h-3.5 w-3.5" />
                        Tools
                    </TabsTrigger>
                    <TabsTrigger value="used-by" className="gap-1.5">
                        <UsersIcon className="h-3.5 w-3.5" />
                        Used By
                    </TabsTrigger>
                    <TabsTrigger value="runtime" className="gap-1.5">
                        <CodeIcon className="h-3.5 w-3.5" />
                        Runtime
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                    <OverviewTab provider={provider} onRefresh={fetchProvider} />
                </TabsContent>
                <TabsContent value="tools" className="mt-4">
                    <ToolsTab providerKey={providerKey} />
                </TabsContent>
                <TabsContent value="used-by" className="mt-4">
                    <UsedByTab providerKey={providerKey} />
                </TabsContent>
                <TabsContent value="runtime" className="mt-4">
                    <RuntimeTab provider={provider} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Status Badge                                                               */
/* -------------------------------------------------------------------------- */

function IntegrationStatusBadge({ provider }: { provider: IntegrationProvider }) {
    switch (provider.status) {
        case "connected":
            return (
                <Badge className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2Icon className="h-3 w-3" />
                    Connected
                </Badge>
            );
        case "needs_auth":
        case "missing_auth":
            return (
                <Badge className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600">
                    <AlertTriangleIcon className="h-3 w-3" />
                    Needs Auth
                </Badge>
            );
        case "needs_validation":
            return (
                <Badge className="gap-1 border-blue-500/20 bg-blue-500/10 text-blue-600">
                    <AlertTriangleIcon className="h-3 w-3" />
                    Needs Validation
                </Badge>
            );
        case "degraded":
            return (
                <Badge className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600">
                    <AlertTriangleIcon className="h-3 w-3" />
                    Degraded
                </Badge>
            );
        case "error":
            return (
                <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                    <XCircleIcon className="h-3 w-3" />
                    Error
                </Badge>
            );
        default:
            return (
                <Badge variant="secondary" className="gap-1">
                    <XCircleIcon className="h-3 w-3" />
                    Disconnected
                </Badge>
            );
    }
}

/* -------------------------------------------------------------------------- */
/*  Overview Tab                                                               */
/* -------------------------------------------------------------------------- */

function OverviewTab({
    provider,
    onRefresh
}: {
    provider: IntegrationProvider;
    onRefresh: () => void;
}) {
    const [testLoading, setTestLoading] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
    const [disconnecting, setDisconnecting] = useState<string | null>(null);

    const handleTest = async (connectionId: string) => {
        setTestLoading(connectionId);
        try {
            const res = await fetch(
                `${getApiBase()}/api/integrations/connections/${connectionId}/test`,
                { method: "POST" }
            );
            const data = await res.json();
            setTestResults((prev) => ({
                ...prev,
                [connectionId]: {
                    success: data.success,
                    message:
                        data.message || (data.success ? "Connection is healthy" : "Test failed"),
                    details: data
                }
            }));
        } catch {
            setTestResults((prev) => ({
                ...prev,
                [connectionId]: { success: false, message: "Network error during test" }
            }));
        } finally {
            setTestLoading(null);
        }
    };

    const handleDisconnect = async (connectionId: string) => {
        if (!confirm("Are you sure you want to disconnect this integration?")) return;
        setDisconnecting(connectionId);
        try {
            await fetch(`${getApiBase()}/api/integrations/connections/${connectionId}`, {
                method: "DELETE"
            });
            onRefresh();
        } catch {
            console.error("Failed to disconnect");
        } finally {
            setDisconnecting(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Connection Status */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <PlugIcon className="h-4 w-4" />
                        Connection Status
                    </CardTitle>
                    <CardDescription>
                        {provider.authType === "apiKey"
                            ? "API key authentication"
                            : provider.authType === "oauth"
                              ? "OAuth authentication"
                              : provider.authType === "none"
                                ? "No authentication required"
                                : `${provider.authType} authentication`}
                        {" · "}
                        {provider.providerType} integration
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {provider.connections.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No active connections.</p>
                    ) : (
                        <div className="space-y-3">
                            {provider.connections.map((conn) => {
                                const result = testResults[conn.id];
                                return (
                                    <div key={conn.id} className="space-y-3 rounded-lg border p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className={`h-2 w-2 rounded-full ${conn.connected ? "bg-emerald-500" : "bg-amber-500"}`}
                                                />
                                                <span className="text-sm font-medium">
                                                    {conn.name}
                                                </span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {conn.scope === "org"
                                                        ? "Organization"
                                                        : "Personal"}
                                                </Badge>
                                                {conn.isDefault && (
                                                    <Badge className="border-blue-500/20 bg-blue-500/10 text-xs text-blue-600">
                                                        Default
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleTest(conn.id)}
                                                    disabled={testLoading === conn.id}
                                                >
                                                    {testLoading === conn.id ? (
                                                        <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <ShieldCheckIcon className="h-3.5 w-3.5" />
                                                    )}
                                                    Test
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDisconnect(conn.id)}
                                                    disabled={disconnecting === conn.id}
                                                >
                                                    {disconnecting === conn.id ? (
                                                        <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <UnplugIcon className="h-3.5 w-3.5" />
                                                    )}
                                                    Disconnect
                                                </Button>
                                            </div>
                                        </div>

                                        {conn.missingFields.length > 0 && (
                                            <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
                                                <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                                                Missing fields: {conn.missingFields.join(", ")}
                                            </div>
                                        )}

                                        {result && (
                                            <div
                                                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                                                    result.success
                                                        ? "bg-emerald-500/10 text-emerald-600"
                                                        : "bg-destructive/10 text-destructive"
                                                }`}
                                            >
                                                {result.success ? (
                                                    <CheckCircle2Icon className="h-4 w-4 shrink-0" />
                                                ) : (
                                                    <XCircleIcon className="h-4 w-4 shrink-0" />
                                                )}
                                                {result.message}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 pt-1">
                                            <span className="text-muted-foreground text-xs">
                                                Access Policy
                                            </span>
                                            <Select
                                                value={conn.accessPolicy || "org-wide"}
                                                onValueChange={async (value) => {
                                                    try {
                                                        const res = await fetch(
                                                            `${getApiBase()}/api/integrations/connections/${conn.id}`,
                                                            {
                                                                method: "PATCH",
                                                                headers: {
                                                                    "Content-Type":
                                                                        "application/json"
                                                                },
                                                                credentials: "include",
                                                                body: JSON.stringify({
                                                                    accessPolicy: value
                                                                })
                                                            }
                                                        );
                                                        if (res.ok) {
                                                            onRefresh();
                                                        }
                                                    } catch {
                                                        /* ignore */
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-7 w-52 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="org-wide">
                                                        All org agents
                                                    </SelectItem>
                                                    <SelectItem value="owner-only">
                                                        Owner only
                                                    </SelectItem>
                                                    <SelectItem value="role-restricted">
                                                        Admins only
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Webhook Configuration (only for providers with a dedicated webhook endpoint) */}
            <WebhookEndpointCard provider={provider} />

            {/* Integration Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Integration Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Provider Key</span>
                            <p className="mt-0.5 font-mono text-xs">{provider.key}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Category</span>
                            <p className="mt-0.5 capitalize">{provider.category}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Auth Type</span>
                            <p className="mt-0.5 capitalize">{provider.authType}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Provider Type</span>
                            <p className="mt-0.5 capitalize">{provider.providerType}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Webhook Endpoint Card                                                      */
/* -------------------------------------------------------------------------- */

function WebhookEndpointCard({ provider }: { provider: IntegrationProvider }) {
    const [copied, setCopied] = useState(false);

    const webhookEndpoint = (provider.config as Record<string, unknown> | null)?.webhookEndpoint as
        | string
        | undefined;
    const webhookSetupInstructions = (provider.config as Record<string, unknown> | null)
        ?.webhookSetupInstructions as string | undefined;

    if (!webhookEndpoint || provider.connections.length === 0) return null;

    const connection = provider.connections.find((c) => c.isDefault) || provider.connections[0];
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const fullUrl = `${origin}${webhookEndpoint}?connectionId=${connection.id}`;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <LinkIcon className="h-4 w-4" />
                    Webhook Configuration
                </CardTitle>
                <CardDescription>
                    {webhookSetupInstructions ||
                        `Configure ${provider.name} to send webhook events to this URL.`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-1.5">
                    <span className="text-muted-foreground text-xs">Webhook URL</span>
                    <div className="bg-muted flex items-center gap-2 rounded-md border px-3 py-2">
                        <code className="flex-1 text-xs break-all">{fullUrl}</code>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={handleCopy}
                        >
                            {copied ? (
                                <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                                <CopyIcon className="text-muted-foreground h-3.5 w-3.5" />
                            )}
                        </Button>
                    </div>
                </div>
                {provider.connections.length > 1 && (
                    <p className="text-muted-foreground text-xs">
                        Showing URL for connection &ldquo;{connection.name}&rdquo;. Each connection
                        has its own unique webhook URL.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

/* -------------------------------------------------------------------------- */
/*  Tools Tab                                                                  */
/* -------------------------------------------------------------------------- */

function ToolsTab({ providerKey }: { providerKey: string }) {
    const [tools, setTools] = useState<IntegrationToolRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [rediscovering, setRediscovering] = useState(false);
    const [togglingTool, setTogglingTool] = useState<string | null>(null);
    const [totalTools, setTotalTools] = useState(0);
    const [enabledTools, setEnabledTools] = useState(0);

    const fetchTools = useCallback(async () => {
        try {
            const res = await fetch(
                `${getApiBase()}/api/integrations/providers/${providerKey}/tools`
            );
            const data = await res.json();
            if (data.success && data.tools) {
                setTools(data.tools);
                setTotalTools(data.totalTools ?? data.tools.length);
                setEnabledTools(
                    data.enabledTools ??
                        data.tools.filter((t: IntegrationToolRecord) => t.isEnabled).length
                );
            }
        } catch (err) {
            console.error("Failed to fetch tools:", err);
        } finally {
            setLoading(false);
        }
    }, [providerKey]);

    useEffect(() => {
        fetchTools();
    }, [fetchTools]);

    const handleRediscover = async () => {
        setRediscovering(true);
        try {
            await fetch(`${getApiBase()}/api/integrations/providers/${providerKey}/tools`, {
                method: "POST"
            });
            await fetchTools();
        } catch (err) {
            console.error("Rediscovery failed:", err);
        } finally {
            setRediscovering(false);
        }
    };

    const handleToggle = async (toolId: string, enabled: boolean) => {
        setTogglingTool(toolId);
        try {
            const res = await fetch(
                `${getApiBase()}/api/integrations/providers/${providerKey}/tools`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ toolIds: [toolId], isEnabled: enabled })
                }
            );
            if (res.ok) {
                setTools((prev) =>
                    prev.map((t) => (t.toolId === toolId ? { ...t, isEnabled: enabled } : t))
                );
                setEnabledTools((prev) => prev + (enabled ? 1 : -1));
            }
        } catch (err) {
            console.error("Toggle failed:", err);
        } finally {
            setTogglingTool(null);
        }
    };

    const handleBulkToggle = async (enabled: boolean) => {
        const toolIds = filteredTools.map((t) => t.toolId);
        if (toolIds.length === 0) return;
        try {
            const res = await fetch(
                `${getApiBase()}/api/integrations/providers/${providerKey}/tools`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ toolIds, isEnabled: enabled })
                }
            );
            if (res.ok) {
                setTools((prev) =>
                    prev.map((t) => (toolIds.includes(t.toolId) ? { ...t, isEnabled: enabled } : t))
                );
                await fetchTools();
            }
        } catch (err) {
            console.error("Bulk toggle failed:", err);
        }
    };

    const filteredTools = tools.filter(
        (t) =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.toolId.toLowerCase().includes(search.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2Icon className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">
                        {totalTools} tool{totalTools !== 1 ? "s" : ""} discovered
                        {" · "}
                        {enabledTools} enabled
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkToggle(true)}
                        disabled={filteredTools.every((t) => t.isEnabled)}
                    >
                        Enable All
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkToggle(false)}
                        disabled={filteredTools.every((t) => !t.isEnabled)}
                    >
                        Disable All
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRediscover}
                        disabled={rediscovering}
                    >
                        {rediscovering ? (
                            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                        )}
                        Rediscover
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                    placeholder="Search tools..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Tools list */}
            {filteredTools.length === 0 ? (
                <Card>
                    <CardContent className="text-muted-foreground py-8 text-center text-sm">
                        {tools.length === 0
                            ? 'No tools discovered yet. Click "Rediscover" to fetch tools from this integration.'
                            : "No tools match your search."}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filteredTools.map((tool) => (
                        <div
                            key={tool.toolId}
                            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                                tool.isEnabled ? "bg-card" : "bg-muted/30"
                            }`}
                        >
                            <div className="mr-4 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">
                                        {tool.name}
                                    </span>
                                    <ToolHealthBadge status={tool.validationStatus} />
                                    {tool.usedByCount !== undefined && tool.usedByCount > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                            Used by {tool.usedByCount}
                                        </Badge>
                                    )}
                                </div>
                                {tool.description && (
                                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                                        {tool.description}
                                    </p>
                                )}
                                <p className="text-muted-foreground/60 mt-0.5 font-mono text-[10px]">
                                    {tool.toolId}
                                </p>
                            </div>
                            <Switch
                                checked={tool.isEnabled}
                                onCheckedChange={(checked) => handleToggle(tool.toolId, checked)}
                                disabled={togglingTool === tool.toolId}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ToolHealthBadge({ status }: { status: string }) {
    switch (status) {
        case "healthy":
            return (
                <Badge className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600">
                    <CheckCircle2Icon className="h-2.5 w-2.5" />
                    Healthy
                </Badge>
            );
        case "degraded":
            return (
                <Badge className="gap-1 border-amber-500/20 bg-amber-500/10 text-xs text-amber-600">
                    <AlertTriangleIcon className="h-2.5 w-2.5" />
                    Degraded
                </Badge>
            );
        case "error":
            return (
                <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1 text-xs">
                    <XCircleIcon className="h-2.5 w-2.5" />
                    Error
                </Badge>
            );
        default:
            return (
                <Badge variant="secondary" className="text-xs">
                    Unknown
                </Badge>
            );
    }
}

/* -------------------------------------------------------------------------- */
/*  Used By Tab                                                                */
/* -------------------------------------------------------------------------- */

function UsedByTab({ providerKey }: { providerKey: string }) {
    const [items, setItems] = useState<UsedByItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `${getApiBase()}/api/integrations/providers/${providerKey}/used-by`
                );
                const data = await res.json();
                if (data.success) {
                    setItems(data.items ?? []);
                }
            } catch (err) {
                console.error("Failed to fetch used-by:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [providerKey]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2Icon className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <Card>
                <CardContent className="text-muted-foreground py-8 text-center text-sm">
                    No agents, skills, or playbooks are currently using tools from this integration.
                </CardContent>
            </Card>
        );
    }

    const agents = items.filter((i) => i.type === "agent");
    const skills = items.filter((i) => i.type === "skill");
    const playbooks = items.filter((i) => i.type === "playbook");

    return (
        <div className="space-y-4">
            {agents.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Agents ({agents.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {agents.map((item) => (
                            <UsedByRow key={item.id} item={item} basePath="/workspace" />
                        ))}
                    </CardContent>
                </Card>
            )}

            {skills.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Skills ({skills.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {skills.map((item) => (
                            <UsedByRow key={item.id} item={item} basePath="/skills" />
                        ))}
                    </CardContent>
                </Card>
            )}

            {playbooks.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Playbooks ({playbooks.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {playbooks.map((item) => (
                            <UsedByRow key={item.id} item={item} basePath="/playbooks" />
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function UsedByRow({ item, basePath }: { item: UsedByItem; basePath: string }) {
    return (
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
                <Link
                    href={`${basePath}/${item.slug}`}
                    className="text-sm font-medium hover:underline"
                >
                    {item.name}
                </Link>
                <p className="text-muted-foreground text-xs">
                    {item.toolIds.length} tool{item.toolIds.length !== 1 ? "s" : ""}
                </p>
            </div>
            <Badge variant="secondary" className="text-xs capitalize">
                {item.type}
            </Badge>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Runtime Tab                                                                */
/* -------------------------------------------------------------------------- */

function RuntimeTab({ provider }: { provider: IntegrationProvider }) {
    const [runtimeConfig, setRuntimeConfig] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const defaultConnection =
        provider.connections.find((c) => c.isDefault) || provider.connections[0];

    useEffect(() => {
        if (!defaultConnection) return;
        setLoading(true);
        (async () => {
            try {
                const res = await fetch(
                    `${getApiBase()}/api/integrations/connections/${defaultConnection.id}/runtime`
                );
                const data = await res.json();
                if (data.success) {
                    setRuntimeConfig(data.config);
                } else {
                    setError(data.error || "Failed to load runtime config");
                }
            } catch (err) {
                setError("Network error loading runtime config");
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [defaultConnection]);

    if (!defaultConnection) {
        return (
            <Card>
                <CardContent className="text-muted-foreground py-8 text-center text-sm">
                    No active connection to display runtime configuration for.
                </CardContent>
            </Card>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2Icon className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <CodeIcon className="h-4 w-4" />
                        Compiled Configuration
                    </CardTitle>
                    <CardDescription>
                        Runtime MCP server definition for connection &ldquo;{defaultConnection.name}
                        &rdquo;. Sensitive values are redacted.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                            <XCircleIcon className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    ) : runtimeConfig ? (
                        <pre className="bg-muted max-h-[500px] overflow-auto rounded-md p-4 font-mono text-xs leading-relaxed">
                            {JSON.stringify(runtimeConfig, null, 2)}
                        </pre>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            No runtime configuration available.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Connection metadata */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Connection Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Connection ID</span>
                            <p className="mt-0.5 font-mono text-xs">{defaultConnection.id}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Scope</span>
                            <p className="mt-0.5 capitalize">{defaultConnection.scope}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Status</span>
                            <p className="mt-0.5">
                                {defaultConnection.connected ? "Active" : "Inactive"}
                            </p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Default</span>
                            <p className="mt-0.5">{defaultConnection.isDefault ? "Yes" : "No"}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
