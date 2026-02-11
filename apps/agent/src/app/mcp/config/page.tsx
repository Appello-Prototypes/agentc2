"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
    buttonVariants
} from "@repo/ui";

type Provider = {
    key: string;
    name: string;
    providerType: string;
    config?: Record<string, unknown> | null;
};

type ProvidersResponse = {
    success: boolean;
    providers?: Provider[];
    error?: string;
};

type McpConfig = {
    mcpServers: Record<string, Record<string, unknown>>;
};

type ImportResult = {
    createdProviders?: string[];
    updatedProviders?: string[];
    createdConnections?: string[];
    updatedConnections?: string[];
    disabledConnections?: string[];
    warnings?: string[];
};

type McpConfigImpactAgent = {
    id: string;
    slug: string;
    name: string;
    toolCount: number;
    reason: "explicit" | "mcpEnabled";
};

type McpConfigImpactServer = {
    serverKey: string;
    serverName: string;
    affectedAgents: McpConfigImpactAgent[];
};

type McpConfigImpact = {
    serversToDisable: McpConfigImpactServer[];
    serversToAdd: string[];
    serversToUpdate: string[];
    totalAffectedAgents: number;
    hasImpact: boolean;
};

const normalizeStringArray = (value: unknown) =>
    Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];

const normalizeStringRecord = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
        (acc, [key, val]) => {
            if (typeof val === "string") {
                acc[key] = val;
                return acc;
            }
            if (val !== null && val !== undefined) {
                acc[key] = String(val);
            }
            return acc;
        },
        {}
    );
};

const getImportHints = (provider: Provider) => {
    const config = provider.config;
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        return {};
    }
    const hints = (config as Record<string, unknown>).importHints;
    if (!hints || typeof hints !== "object" || Array.isArray(hints)) {
        return {};
    }
    const hintsRecord = hints as Record<string, unknown>;
    return {
        matchNames: normalizeStringArray(hintsRecord.matchNames),
        matchArgs: normalizeStringArray(hintsRecord.matchArgs),
        matchUrls: normalizeStringArray(hintsRecord.matchUrls),
        envAliases: normalizeStringRecord(hintsRecord.envAliases),
        headerAliases: normalizeStringRecord(hintsRecord.headerAliases),
        argValueMap: normalizeStringRecord(hintsRecord.argValueMap)
    };
};

const normalizeServerConfig = (value: Record<string, unknown>) => {
    const command = typeof value.command === "string" ? value.command : undefined;
    const args = normalizeStringArray(value.args);
    const env = normalizeStringRecord(value.env);
    const url = typeof value.url === "string" ? value.url : undefined;
    const headers = normalizeStringRecord(value.headers);
    return { command, args, env, url, headers };
};

const scoreProviderMatch = (provider: Provider, serverName: string, config: McpConfig) => {
    const normalizedName = serverName.toLowerCase();
    if (provider.key.toLowerCase() === normalizedName) {
        return 100;
    }
    const server = config.mcpServers[serverName] ?? {};
    const serverConfig = normalizeServerConfig(server);
    const hints = getImportHints(provider);
    let score = 0;

    if (hints.matchNames?.some((name) => name.toLowerCase() === normalizedName)) {
        score += 3;
    }
    if (serverConfig.args.length && hints.matchArgs?.length) {
        const normalizedArgs = serverConfig.args.map((arg) => arg.toLowerCase());
        if (
            hints.matchArgs.some((match) =>
                normalizedArgs.some((arg) => arg.includes(match.toLowerCase()))
            )
        ) {
            score += 1;
        }
    }
    if (serverConfig.url && hints.matchUrls?.length) {
        const normalizedUrl = serverConfig.url.toLowerCase();
        if (hints.matchUrls.some((match) => normalizedUrl.includes(match.toLowerCase()))) {
            score += 2;
        }
    }

    return score;
};

const resolveProvider = (providers: Provider[], serverName: string, config: McpConfig) => {
    let best: { provider: Provider; score: number } | null = null;
    for (const provider of providers) {
        if (provider.providerType !== "mcp" && provider.providerType !== "custom") {
            continue;
        }
        const score = scoreProviderMatch(provider, serverName, config);
        if (score > 0 && (!best || score > best.score)) {
            best = { provider, score };
        }
    }
    return best?.provider ?? null;
};

export default function McpConfigPage() {
    const [configText, setConfigText] = useState<string>('{\n  "mcpServers": {}\n}');
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [format, setFormat] = useState("cursor");
    const [parseError, setParseError] = useState<string | null>(null);
    const [parsedConfig, setParsedConfig] = useState<McpConfig | null>(null);
    const [validation, setValidation] = useState<string[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [saveResult, setSaveResult] = useState<ImportResult | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [impactResult, setImpactResult] = useState<McpConfigImpact | null>(null);
    const [impactOpen, setImpactOpen] = useState(false);
    const [pendingConfig, setPendingConfig] = useState<McpConfig | null>(null);

    const handleLoad = useCallback(async (options?: { preserveResult?: boolean }) => {
        setLoading(true);
        if (!options?.preserveResult) {
            setSaveResult(null);
            setSaveError(null);
        } else {
            setSaveError(null);
        }
        try {
            const response = await fetch(`${getApiBase()}/api/integrations/mcp-config`);
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || "Failed to load config");
            }
            setConfigText(JSON.stringify(data.config ?? { mcpServers: {} }, null, 2));
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : "Failed to load config");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const loadProviders = async () => {
            try {
                const response = await fetch(`${getApiBase()}/api/integrations/providers`);
                const data = (await response.json()) as ProvidersResponse;
                if (data.success && data.providers) {
                    setProviders(data.providers);
                }
            } catch (error) {
                console.error("Failed to load providers:", error);
            }
        };

        loadProviders();
    }, []);

    useEffect(() => {
        void handleLoad();
    }, [handleLoad]);

    useEffect(() => {
        try {
            const parsed = JSON.parse(configText) as McpConfig;
            setParsedConfig(parsed);
            setParseError(null);
        } catch (error) {
            setParsedConfig(null);
            setParseError(error instanceof Error ? error.message : "Invalid JSON");
        }
    }, [configText]);

    useEffect(() => {
        if (!parsedConfig) {
            setValidation([]);
            setWarnings([]);
            return;
        }

        const nextValidation: string[] = [];
        const nextWarnings: string[] = [];

        if (!parsedConfig.mcpServers || typeof parsedConfig.mcpServers !== "object") {
            nextValidation.push("Missing required key: mcpServers");
        } else {
            for (const [serverName, serverConfig] of Object.entries(parsedConfig.mcpServers)) {
                if (!serverConfig || typeof serverConfig !== "object") {
                    nextValidation.push(`Server '${serverName}' must be an object`);
                    continue;
                }
                const normalized = normalizeServerConfig(serverConfig);
                if (!normalized.command && !normalized.url) {
                    nextValidation.push(
                        `Server '${serverName}' must include either 'command' or 'url'`
                    );
                }
                const provider = resolveProvider(providers, serverName, parsedConfig);
                if (!provider) {
                    nextWarnings.push(`Server '${serverName}' will be created as custom`);
                    continue;
                }
                const config = provider.config;
                const required =
                    config && typeof config === "object" && !Array.isArray(config)
                        ? normalizeStringArray((config as Record<string, unknown>).requiredFields)
                        : [];
                if (required.length === 0) {
                    continue;
                }
                const hints = getImportHints(provider);
                const envAliases = hints.envAliases ?? {};
                const headerAliases = hints.headerAliases ?? {};
                const argValueMap = hints.argValueMap ?? {};
                const envKeys = Object.keys(normalized.env).map((key) => envAliases[key] ?? key);
                const headerKeys = Object.keys(normalized.headers).map(
                    (key) => headerAliases[key] ?? key
                );
                const argKeys: string[] = [];
                if (normalized.args && Object.keys(argValueMap).length > 0) {
                    normalized.args.forEach((arg, index) => {
                        const targetKey = argValueMap[arg];
                        if (targetKey && normalized.args[index + 1]) {
                            argKeys.push(targetKey);
                        }
                    });
                }
                const availableKeys = new Set([...envKeys, ...headerKeys, ...argKeys]);
                const missing = required.filter((key) => !availableKeys.has(key));
                if (missing.length > 0) {
                    nextWarnings.push(
                        `Server '${serverName}' missing required fields: ${missing.join(", ")}`
                    );
                }
            }
        }

        setValidation(nextValidation);
        setWarnings(nextWarnings);
    }, [parsedConfig, providers]);

    const runSave = async (configToSave: McpConfig) => {
        setSaving(true);
        setSaveResult(null);
        setSaveError(null);
        try {
            const response = await fetch(`${getApiBase()}/api/integrations/mcp-config`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(configToSave)
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || "Failed to save config");
            }
            setSaveResult(data as ImportResult);
            await handleLoad({ preserveResult: true });
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : "Failed to save config");
        } finally {
            setSaving(false);
        }
    };

    const handleImpactClose = (open: boolean) => {
        setImpactOpen(open);
        if (!open) {
            setImpactResult(null);
            setPendingConfig(null);
        }
    };

    const handleConfirmSave = async () => {
        if (!pendingConfig) {
            handleImpactClose(false);
            return;
        }
        const configToSave = pendingConfig;
        handleImpactClose(false);
        await runSave(configToSave);
    };

    const handleSave = async () => {
        if (!parsedConfig) {
            setSaveError("Fix JSON errors before saving.");
            return;
        }
        setSaving(true);
        setSaveResult(null);
        setSaveError(null);
        try {
            const response = await fetch(`${getApiBase()}/api/integrations/mcp-config/impact`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsedConfig)
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || "Failed to analyze MCP config");
            }
            const impact = data.impact as McpConfigImpact | undefined;
            if (impact?.hasImpact) {
                setImpactResult(impact);
                setPendingConfig(parsedConfig);
                setImpactOpen(true);
                return;
            }
            await runSave(parsedConfig);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : "Failed to save config");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="mb-2">
                            <Link
                                href="/mcp"
                                className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                                Back to Integrations
                            </Link>
                        </div>
                        <h1 className="text-3xl font-bold">MCP JSON Config</h1>
                        <p className="text-muted-foreground">
                            Paste your MCP JSON like Cursor. Save to sync connections.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={() => void handleLoad()}
                            disabled={loading}
                        >
                            {loading ? "Loading..." : "Load current config"}
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Saving..." : "Save config"}
                        </Button>
                    </div>
                </div>

                <AlertDialog open={impactOpen} onOpenChange={handleImpactClose}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm MCP config changes</AlertDialogTitle>
                            <AlertDialogDescription>
                                Saving this config will disable{" "}
                                {impactResult?.serversToDisable.length ?? 0} MCP servers and affect{" "}
                                {impactResult?.totalAffectedAgents ?? 0} agents. Tools reconnect
                                automatically if the server is re-added later.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="max-h-[320px] space-y-3 overflow-auto text-sm">
                            {impactResult?.serversToDisable.map((server) => (
                                <div
                                    key={`${server.serverKey}-${server.serverName}`}
                                    className="rounded border p-3"
                                >
                                    <div className="font-medium">{server.serverName}</div>
                                    <div className="text-muted-foreground text-xs">
                                        Server key: {server.serverKey}
                                    </div>
                                    {server.affectedAgents.length > 0 ? (
                                        <div className="mt-2 space-y-1 text-xs">
                                            {server.affectedAgents.map((agent) => (
                                                <div key={agent.id}>
                                                    {agent.name} ({agent.slug}){" "}
                                                    {agent.reason === "explicit"
                                                        ? `- ${agent.toolCount} tool${
                                                              agent.toolCount === 1 ? "" : "s"
                                                          } configured`
                                                        : "- MCP-enabled agent"}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground mt-2 text-xs">
                                            No agents are using this server.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void handleConfirmSave()}>
                                Save config
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Card>
                    <CardHeader>
                        <CardTitle>Configuration</CardTitle>
                        <CardDescription>
                            Choose a format and edit the MCP JSON directly. Cursor format is the
                            default and recommended.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Tabs defaultValue="cursor" value={format} onValueChange={setFormat}>
                            <TabsList>
                                <TabsTrigger value="cursor">Cursor format</TabsTrigger>
                                <TabsTrigger value="claude">Claude format</TabsTrigger>
                                <TabsTrigger value="raw">Raw MCP</TabsTrigger>
                            </TabsList>
                            <TabsContent value="cursor">
                                <p className="text-muted-foreground text-xs">
                                    Compatible with `.cursor/mcp.json`.
                                </p>
                            </TabsContent>
                            <TabsContent value="claude">
                                <p className="text-muted-foreground text-xs">
                                    Uses the same JSON structure as Cursor for now.
                                </p>
                            </TabsContent>
                            <TabsContent value="raw">
                                <p className="text-muted-foreground text-xs">
                                    Direct MCP server definitions.
                                </p>
                            </TabsContent>
                        </Tabs>

                        <Textarea
                            value={configText}
                            onChange={(event) => setConfigText(event.target.value)}
                            className="min-h-[420px] font-mono text-xs"
                            spellCheck={false}
                        />

                        {parseError && <div className="text-sm text-red-500">{parseError}</div>}

                        {validation.length > 0 && (
                            <div className="space-y-1 text-sm text-red-500">
                                {validation.map((message) => (
                                    <div key={message}>{message}</div>
                                ))}
                            </div>
                        )}

                        {warnings.length > 0 && (
                            <div className="space-y-1 text-sm text-yellow-600">
                                {warnings.map((message) => (
                                    <div key={message}>{message}</div>
                                ))}
                            </div>
                        )}

                        {saveError && <div className="text-sm text-red-500">{saveError}</div>}

                        {saveResult && (
                            <div className="space-y-1 text-sm text-emerald-600">
                                {saveResult.createdProviders?.length ? (
                                    <div>
                                        Providers created: {saveResult.createdProviders.length}
                                    </div>
                                ) : null}
                                {saveResult.updatedProviders?.length ? (
                                    <div>
                                        Providers updated: {saveResult.updatedProviders.length}
                                    </div>
                                ) : null}
                                {saveResult.createdConnections?.length ? (
                                    <div>
                                        Connections created: {saveResult.createdConnections.length}
                                    </div>
                                ) : null}
                                {saveResult.updatedConnections?.length ? (
                                    <div>
                                        Connections updated: {saveResult.updatedConnections.length}
                                    </div>
                                ) : null}
                                {saveResult.disabledConnections?.length ? (
                                    <div>
                                        Connections disabled:{" "}
                                        {saveResult.disabledConnections.length}
                                    </div>
                                ) : null}
                                {saveResult.warnings?.length ? (
                                    <div>Warnings: {saveResult.warnings.length}</div>
                                ) : null}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
