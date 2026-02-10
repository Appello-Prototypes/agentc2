"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getApiBase } from "@/lib/utils";
import WebhookChat from "@/components/webhooks/WebhookChat";
import WebhookDetail from "@/components/webhooks/WebhookDetail";
import type { WebhookTrigger } from "@/components/webhooks/types";
import { ChannelsTab } from "@/components/channels/ChannelsTab";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    buttonVariants
} from "@repo/ui";

/* ================================================================== */
/*  Types                                                             */
/* ================================================================== */

type ProviderStatus = "connected" | "disconnected" | "missing_auth";

type ConnectionSummary = {
    id: string;
    name: string;
    scope: string;
    isDefault: boolean;
    isActive: boolean;
    connected: boolean;
    missingFields: string[];
};

type IntegrationProvider = {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    category: string;
    authType: string;
    providerType: string;
    status: ProviderStatus;
    connections: ConnectionSummary[];
    toolCount?: number;
    actions?: Record<string, unknown> | null;
    triggers?: Record<string, unknown> | null;
    config?: Record<string, unknown> | null;
};

type ProvidersResponse = {
    success: boolean;
    providers?: IntegrationProvider[];
    error?: string;
};

type McpTestPhase = {
    name: string;
    status: "pass" | "fail";
    ms: number;
    detail: string;
};

type McpTestResult = {
    success: boolean;
    phases: McpTestPhase[];
    toolCount?: number;
    sampleTools?: string[];
    totalMs: number;
};

type DebugLogEntry = {
    id: string;
    timestamp: string;
    level: "info" | "success" | "error";
    message: string;
};

/* ================================================================== */
/*  Shared components                                                 */
/* ================================================================== */

const StatusBadge = ({ status }: { status: ProviderStatus }) => {
    const variants: Record<ProviderStatus, { label: string; className: string }> = {
        connected: {
            label: "Connected",
            className: "bg-green-500/10 text-green-600 border-green-500/20"
        },
        disconnected: {
            label: "Disconnected",
            className: "bg-gray-500/10 text-gray-600 border-gray-500/20"
        },
        missing_auth: {
            label: "Missing Auth",
            className: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
        }
    };
    const variant = variants[status];
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${variant.className}`}
        >
            {variant.label}
        </span>
    );
};

const CategoryBadge = ({ category }: { category: string }) => {
    const colors: Record<string, string> = {
        knowledge: "bg-blue-500/10 text-blue-600",
        web: "bg-purple-500/10 text-purple-600",
        crm: "bg-orange-500/10 text-orange-600",
        productivity: "bg-green-500/10 text-green-600",
        communication: "bg-pink-500/10 text-pink-600",
        automation: "bg-cyan-500/10 text-cyan-600"
    };
    return (
        <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${colors[category] || "bg-gray-500/10 text-gray-600"}`}
        >
            {category}
        </span>
    );
};

const ConnectionBadge = ({ connected }: { connected: boolean }) => (
    <Badge variant="outline" className={connected ? "text-green-600" : "text-gray-500"}>
        {connected ? "Ready" : "Needs auth"}
    </Badge>
);

const getServerId = (providerKey: string, connection: ConnectionSummary) =>
    connection.isDefault ? providerKey : `${providerKey}__${connection.id.slice(0, 8)}`;

/* ================================================================== */
/*  Provider table                                                    */
/* ================================================================== */

function ProviderTable({
    providers,
    onTest,
    testResults,
    testingServers,
    showManage = true
}: {
    providers: IntegrationProvider[];
    onTest?: (serverId: string, label: string) => void;
    testResults?: Record<string, McpTestResult | undefined>;
    testingServers?: Record<string, boolean>;
    showManage?: boolean;
}) {
    if (providers.length === 0) {
        return (
            <Card>
                <CardContent className="text-muted-foreground py-6 text-sm">
                    No providers in this category yet.
                </CardContent>
            </Card>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Connections</TableHead>
                    <TableHead>Auth</TableHead>
                    <TableHead>Actions / Triggers</TableHead>
                    {showManage && <TableHead className="text-right">Manage</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {providers.map((provider) => (
                    <TableRow key={provider.id}>
                        <TableCell className="whitespace-normal">
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-muted-foreground text-xs">
                                {provider.description}
                            </div>
                        </TableCell>
                        <TableCell>
                            <CategoryBadge category={provider.category} />
                        </TableCell>
                        <TableCell>
                            <StatusBadge status={provider.status} />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                            {provider.connections.length === 0 ? (
                                <span className="text-muted-foreground text-xs">
                                    No connections
                                </span>
                            ) : (
                                <div className="space-y-2">
                                    {provider.connections.map((connection) => {
                                        const serverId = getServerId(provider.key, connection);
                                        const isTesting = Boolean(testingServers?.[serverId]);
                                        const testResult = testResults?.[serverId];

                                        return (
                                            <div
                                                key={connection.id}
                                                className="flex flex-wrap items-center gap-2 text-xs"
                                            >
                                                <span className="font-medium">
                                                    {connection.name}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {connection.scope}
                                                    {connection.isDefault ? " · default" : ""}
                                                    {!connection.isActive ? " · disabled" : ""}
                                                </span>
                                                <ConnectionBadge connected={connection.connected} />
                                                {connection.missingFields.length > 0 && (
                                                    <span className="text-yellow-600">
                                                        Missing:{" "}
                                                        {connection.missingFields.join(", ")}
                                                    </span>
                                                )}
                                                {(provider.providerType === "mcp" ||
                                                    provider.providerType === "custom") &&
                                                    onTest && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={
                                                                !connection.isActive ||
                                                                connection.missingFields.length >
                                                                    0 ||
                                                                isTesting
                                                            }
                                                            onClick={() => {
                                                                onTest(
                                                                    serverId,
                                                                    `${provider.name} · ${connection.name}`
                                                                );
                                                            }}
                                                        >
                                                            {isTesting ? "Testing..." : "Test"}
                                                        </Button>
                                                    )}
                                                {(provider.providerType === "mcp" ||
                                                    provider.providerType === "custom") &&
                                                    testResult && (
                                                        <div className="w-full space-y-1 text-xs">
                                                            {testResult.phases.map((phase) => (
                                                                <div
                                                                    key={`${connection.id}-${phase.name}`}
                                                                    className={
                                                                        phase.status === "pass"
                                                                            ? "text-emerald-600"
                                                                            : "text-red-500"
                                                                    }
                                                                >
                                                                    {phase.status === "pass"
                                                                        ? "✓"
                                                                        : "✕"}{" "}
                                                                    {phase.name} ({phase.ms}ms) —{" "}
                                                                    {phase.detail}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </TableCell>
                        <TableCell className="text-xs uppercase">{provider.authType}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                            {provider.toolCount ??
                                (Array.isArray(provider.actions?.["actions"])
                                    ? (provider.actions?.["actions"] as unknown[]).length
                                    : provider.actions
                                      ? Object.keys(provider.actions).length
                                      : 0)}
                            {" / "}
                            {Array.isArray(provider.triggers?.["triggers"])
                                ? (provider.triggers?.["triggers"] as unknown[]).length
                                : provider.triggers
                                  ? Object.keys(provider.triggers).length
                                  : 0}
                        </TableCell>
                        {showManage && (
                            <TableCell className="text-right">
                                <Link
                                    href={`/mcp/providers/${provider.key}`}
                                    className={buttonVariants({ variant: "outline", size: "sm" })}
                                >
                                    Manage
                                </Link>
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

/* ================================================================== */
/*  Webhook detail panel                                              */
/* ================================================================== */

/* ================================================================== */
/*  Webhooks tab (chat 1/3 + table 2/3)                               */
/* ================================================================== */

function WebhooksTab({
    webhooks,
    origin,
    onRefresh
}: {
    webhooks: WebhookTrigger[];
    origin: string;
    onRefresh: () => void;
}) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const selectedWebhook = webhooks.find((wh) => wh.id === selectedId) || null;

    const handleToggleActive = async (target: WebhookTrigger) => {
        try {
            await fetch(`${getApiBase()}/api/triggers/${target.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !target.isActive })
            });
            await onRefresh();
        } catch (error) {
            console.error("Failed to update webhook:", error);
        }
    };

    const handleDelete = async (target: WebhookTrigger) => {
        const confirmed = window.confirm(`Delete "${target.name}"? This cannot be undone.`);
        if (!confirmed) return;
        try {
            await fetch(`${getApiBase()}/api/triggers/${target.id}`, { method: "DELETE" });
            setSelectedId(null);
            await onRefresh();
        } catch (error) {
            console.error("Failed to delete webhook:", error);
        }
    };

    return (
        <div className="flex gap-6" style={{ height: "calc(100vh - 18rem)" }}>
            {/* Left 1/3: Chat */}
            <WebhookChat
                webhooksCount={webhooks.length}
                onRefresh={onRefresh}
                showHeader
                headerTitle="Webhook Setup"
                className="w-1/3"
            />

            {/* Right 2/3: Detail or table */}
            <div className="flex min-h-0 w-2/3 flex-col gap-4 overflow-auto">
                {selectedWebhook ? (
                    /* Detail panel (when a webhook is selected) */
                    <WebhookDetail
                        webhook={selectedWebhook}
                        origin={origin}
                        onClose={() => setSelectedId(null)}
                        onToggleActive={handleToggleActive}
                        onDelete={handleDelete}
                    />
                ) : (
                    /* Table (when no webhook is selected) */
                    <Card className="flex-1">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">All Webhooks</CardTitle>
                                <button
                                    onClick={onRefresh}
                                    className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
                                >
                                    Refresh
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {webhooks.length === 0 ? (
                                <div className="text-muted-foreground px-6 py-8 text-center text-sm">
                                    No webhooks yet. Use the chat to create one.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Agent</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Triggered</TableHead>
                                            <TableHead>Created</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {webhooks.map((wh) => (
                                            <TableRow
                                                key={wh.id}
                                                className={`cursor-pointer transition-colors ${selectedId === wh.id ? "bg-muted" : "hover:bg-muted/50"}`}
                                                onClick={() =>
                                                    setSelectedId(
                                                        selectedId === wh.id ? null : wh.id
                                                    )
                                                }
                                            >
                                                <TableCell className="text-xs font-medium whitespace-nowrap">
                                                    {wh.name}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs">
                                                    {wh.agent?.name || "Unknown"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            wh.isActive ? "default" : "secondary"
                                                        }
                                                    >
                                                        {wh.isActive ? "Active" : "Disabled"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs">
                                                    {wh.triggerCount > 0
                                                        ? `${wh.triggerCount}x`
                                                        : "--"}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                                    {new Date(wh.createdAt).toLocaleDateString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

/* ================================================================== */
/*  Main page                                                         */
/* ================================================================== */

export default function IntegrationsHubPage() {
    const [providers, setProviders] = useState<IntegrationProvider[]>([]);
    const [webhooks, setWebhooks] = useState<WebhookTrigger[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, McpTestResult>>({});
    const [testingServers, setTestingServers] = useState<Record<string, boolean>>({});
    const [testAllRunning, setTestAllRunning] = useState(false);
    const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const appendLog = useCallback((level: DebugLogEntry["level"], message: string) => {
        setDebugLogs((prev) => [
            ...prev,
            {
                id: `${Date.now()}-${Math.random()}`,
                timestamp: new Date().toLocaleTimeString(),
                level,
                message
            }
        ]);
    }, []);

    const loadWebhooks = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/triggers?type=webhook`);
            const data = await res.json();
            if (data.success) {
                setWebhooks(data.triggers || []);
            }
        } catch (err) {
            console.error("Failed to load webhooks:", err);
        }
    }, []);

    const handleTestServer = useCallback(
        async (serverId: string, label: string) => {
            setTestingServers((prev) => ({ ...prev, [serverId]: true }));
            appendLog("info", `Testing ${label}`);
            try {
                const response = await fetch(
                    `${getApiBase()}/api/integrations/servers/${serverId}/test`,
                    { method: "POST" }
                );
                const data = await response.json();
                if (!response.ok || !data) {
                    throw new Error(data?.error || "Failed to test server");
                }
                const result = data as McpTestResult;
                setTestResults((prev) => ({ ...prev, [serverId]: result }));
                appendLog(
                    result.success ? "success" : "error",
                    `${label} ${result.success ? "passed" : "failed"} (${result.totalMs}ms)`
                );
            } catch (err) {
                appendLog(
                    "error",
                    `${label} failed: ${err instanceof Error ? err.message : "Unknown error"}`
                );
            } finally {
                setTestingServers((prev) => ({ ...prev, [serverId]: false }));
            }
        },
        [appendLog]
    );

    useEffect(() => {
        const fetchProviders = async () => {
            try {
                const response = await fetch(`${getApiBase()}/api/integrations/providers`);
                const data = (await response.json()) as ProvidersResponse;
                if (!data.success) {
                    setError(data.error || "Failed to load providers");
                    return;
                }
                setProviders(data.providers || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load providers");
            } finally {
                setLoading(false);
            }
        };

        fetchProviders();
        loadWebhooks();
    }, [loadWebhooks]);

    const sortProviders = (list: IntegrationProvider[]) =>
        [...list].sort((a, b) => {
            const categoryCompare = a.category.localeCompare(b.category);
            if (categoryCompare !== 0) return categoryCompare;
            return a.name.localeCompare(b.name);
        });

    const mcpProviders = useMemo(() => {
        const withConnections = providers
            .filter(
                (provider) => provider.providerType === "mcp" || provider.providerType === "custom"
            )
            .map((provider) => ({
                ...provider,
                connections: provider.connections.filter((connection) => connection.isActive)
            }))
            .filter((provider) => provider.connections.length > 0);
        return sortProviders(withConnections);
    }, [providers]);

    const oauthProviders = useMemo(
        () => sortProviders(providers.filter((p) => p.providerType === "oauth")),
        [providers]
    );

    const handleTestAll = useCallback(async () => {
        const targets = mcpProviders.flatMap((provider) =>
            provider.connections.map((connection) => ({
                serverId: getServerId(provider.key, connection),
                label: `${provider.name} · ${connection.name}`
            }))
        );
        if (targets.length === 0) {
            appendLog("info", "No MCP servers available to test.");
            return;
        }
        setTestAllRunning(true);
        appendLog("info", `Testing ${targets.length} MCP servers...`);
        for (const target of targets) {
            await handleTestServer(target.serverId, target.label);
        }
        setTestAllRunning(false);
    }, [appendLog, handleTestServer, mcpProviders]);

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">Integrations Hub</h1>
                        <p className="text-muted-foreground">
                            Manage MCP servers, webhooks, and OAuth integrations in one place.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/mcp/setup" className={buttonVariants({ variant: "outline" })}>
                            Setup &amp; Debug
                        </Link>
                    </div>
                </div>

                {loading && (
                    <div className="text-muted-foreground text-sm">Loading integrations...</div>
                )}

                {error && (
                    <Card>
                        <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                    </Card>
                )}

                {!loading && !error && (
                    <Tabs defaultValue="mcp" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="webhooks">
                                Webhooks
                                {webhooks.length > 0 && (
                                    <Badge variant="secondary" className="ml-2">
                                        {webhooks.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="mcp">
                                MCP Servers
                                {mcpProviders.length > 0 && (
                                    <Badge variant="secondary" className="ml-2">
                                        {mcpProviders.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="oauth">
                                OAuth Platforms
                                {oauthProviders.length > 0 && (
                                    <Badge variant="secondary" className="ml-2">
                                        {oauthProviders.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="channels">Channels</TabsTrigger>
                        </TabsList>

                        <TabsContent value="webhooks" className="mt-4">
                            <WebhooksTab
                                webhooks={webhooks}
                                origin={origin}
                                onRefresh={loadWebhooks}
                            />
                        </TabsContent>

                        <TabsContent value="mcp" className="mt-4">
                            <Card>
                                <CardHeader className="flex flex-row items-start justify-between gap-4">
                                    <div>
                                        <CardTitle>MCP Servers</CardTitle>
                                        <CardDescription>
                                            Model Context Protocol servers defined in your MCP JSON.
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={handleTestAll}
                                            disabled={testAllRunning}
                                        >
                                            {testAllRunning ? "Testing..." : "Test all"}
                                        </Button>
                                        <Link
                                            href="/mcp/config"
                                            className={buttonVariants({ variant: "default" })}
                                        >
                                            <PlusIcon className="mr-2 h-4 w-4" />
                                            New MCP Server
                                        </Link>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ProviderTable
                                        providers={mcpProviders}
                                        onTest={handleTestServer}
                                        testResults={testResults}
                                        testingServers={testingServers}
                                        showManage={false}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="oauth" className="mt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>OAuth Platforms</CardTitle>
                                    <CardDescription>
                                        One-click OAuth integrations that connect directly to
                                        platforms.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ProviderTable providers={oauthProviders} />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="channels" className="mt-4">
                            <ChannelsTab />
                        </TabsContent>
                    </Tabs>
                )}

                {debugLogs.length > 0 && (
                    <Collapsible defaultOpen className="mt-6">
                        <Card className="border-dashed">
                            <CollapsibleTrigger className="w-full">
                                <CardHeader className="hover:bg-muted/50 flex cursor-pointer flex-row items-center justify-between py-4">
                                    <div className="text-left">
                                        <CardTitle className="text-base">Debug log</CardTitle>
                                        <CardDescription>
                                            Recent MCP test activity and errors.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline" className="shrink-0">
                                        {debugLogs.length} entries
                                    </Badge>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="border-t pt-4">
                                    <div className="max-h-64 space-y-1 overflow-auto font-mono text-xs">
                                        {debugLogs.map((entry) => (
                                            <div
                                                key={entry.id}
                                                className={
                                                    entry.level === "error"
                                                        ? "text-red-500"
                                                        : entry.level === "success"
                                                          ? "text-emerald-600"
                                                          : "text-muted-foreground"
                                                }
                                            >
                                                [{entry.timestamp}] {entry.message}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                )}
            </div>
        </div>
    );
}
