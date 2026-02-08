"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { linkSocial } from "@repo/auth/client";
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
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Textarea,
    buttonVariants
} from "@repo/ui";

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

type ConnectionDetail = {
    id: string;
    name: string;
    scope: string;
    isDefault: boolean;
    isActive: boolean;
    credentials?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    errorMessage?: string | null;
};

type ConnectionFormState = {
    name: string;
    isDefault: boolean;
    isActive: boolean;
    credentialsJson: string;
    metadataJson: string;
    requiredValues: Record<string, string>;
    errorMessage?: string | null;
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
    actions?: Record<string, unknown> | null;
    triggers?: Record<string, unknown> | null;
    config?: Record<string, unknown> | null;
};

type ProvidersResponse = {
    success: boolean;
    providers?: IntegrationProvider[];
    error?: string;
};

/* -------------------------------------------------------------------------- */
/*  OAuth status types (used by the simplified OAuth view)                     */
/* -------------------------------------------------------------------------- */

type OAuthStatus = {
    connected: boolean;
    gmailAddress: string | null;
    scope: string | null;
    missingScopes: string[];
    hasGoogleAccount: boolean;
    needsReauth: boolean;
};

type OAuthConfig = {
    socialProvider: "google";
    scopes: string[];
    statusEndpoint: string;
    syncEndpoint: string;
};

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

const ConnectionBadge = ({ connected }: { connected: boolean }) => {
    return (
        <Badge variant="outline" className={connected ? "text-green-600" : "text-gray-500"}>
            {connected ? "Ready" : "Needs auth"}
        </Badge>
    );
};

const formatJson = (value: unknown) => {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const parseJson = (value: string, label: string, onError: (message: string) => void) => {
    try {
        if (!value.trim()) return {};
        return JSON.parse(value) as Record<string, unknown>;
    } catch {
        onError(`${label} must be valid JSON`);
        return null;
    }
};

const mergeRequiredValues = (
    base: Record<string, unknown>,
    required: Record<string, string>,
    requiredFields: string[]
) => {
    const merged = { ...base };
    requiredFields.forEach((field) => {
        const value = required[field];
        if (value !== undefined && value !== "") {
            merged[field] = value;
        }
    });
    return merged;
};

const extractRequiredValues = (credentials: Record<string, unknown>, requiredFields: string[]) => {
    const values: Record<string, string> = {};
    requiredFields.forEach((field) => {
        const value = credentials[field];
        if (value !== undefined && value !== null) {
            values[field] = String(value);
        }
    });
    return values;
};

/* -------------------------------------------------------------------------- */
/*  OAuth-specific provider mapping                                           */
/* -------------------------------------------------------------------------- */

/** Maps provider keys to their Better Auth social provider names and scopes. */
const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send"
        ],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};

/* -------------------------------------------------------------------------- */
/*  OAuthProviderView – clean, SaaS-style OAuth connection page               */
/* -------------------------------------------------------------------------- */

function OAuthProviderView({
    provider,
    onError
}: {
    provider: IntegrationProvider;
    onError: (message: string | null) => void;
}) {
    const oauthConfig =
        (provider.config && typeof provider.config === "object" && !Array.isArray(provider.config)
            ? (provider.config as { oauthConfig?: OAuthConfig }).oauthConfig
            : undefined) || OAUTH_PROVIDER_MAP[provider.key];
    const [status, setStatus] = useState<OAuthStatus | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    const callbackPath = `/mcp/providers/${provider.key}`;

    const loadStatus = useCallback(async () => {
        if (!oauthConfig) return;
        try {
            const response = await fetch(`${getApiBase()}${oauthConfig.statusEndpoint}`);
            const data = await response.json();
            if (data.success) {
                setStatus(data as OAuthStatus);
            }
        } catch {
            // Status check is best-effort
        } finally {
            setStatusLoading(false);
        }
    }, [oauthConfig]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    // After OAuth redirect, auto-sync credentials
    useEffect(() => {
        if (!oauthConfig || statusLoading) return;
        if (status?.hasGoogleAccount && !status?.connected) {
            handleSync();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusLoading]);

    const handleConnect = async () => {
        if (!oauthConfig) return;
        setConnecting(true);
        onError(null);
        try {
            await linkSocial({
                provider: oauthConfig.socialProvider,
                scopes: oauthConfig.scopes,
                callbackURL: callbackPath
            });
        } catch (err) {
            onError(err instanceof Error ? err.message : "Failed to start OAuth flow");
            setConnecting(false);
        }
    };

    const handleSync = async () => {
        if (!oauthConfig) return;
        setSyncing(true);
        onError(null);
        try {
            const response = await fetch(`${getApiBase()}${oauthConfig.syncEndpoint}`, {
                method: "POST"
            });
            const data = await response.json();
            if (data.success) {
                setLastSynced(new Date());
                await loadStatus();
            } else if (data.error) {
                onError(data.error);
            }
        } catch (err) {
            onError(err instanceof Error ? err.message : "Failed to sync credentials");
        } finally {
            setSyncing(false);
        }
    };

    const handleTest = async () => {
        const connection = provider.connections[0];
        if (!connection) {
            setTestResult("No connection found");
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            const response = await fetch(
                `${getApiBase()}/api/integrations/connections/${connection.id}/test`,
                { method: "POST" }
            );
            const data = await response.json();
            if (data.success && data.connected !== false) {
                setTestResult("connected");
            } else {
                setTestResult(data.error || "Connection test failed");
            }
        } catch (err) {
            setTestResult(err instanceof Error ? err.message : "Test failed");
        } finally {
            setTesting(false);
        }
    };

    const handleDisconnect = async () => {
        const connection = provider.connections[0];
        if (!connection) return;
        setDisconnecting(true);
        onError(null);
        try {
            const response = await fetch(
                `${getApiBase()}/api/integrations/connections/${connection.id}`,
                { method: "DELETE" }
            );
            const data = await response.json();
            if (data.success) {
                setStatus((prev) =>
                    prev ? { ...prev, connected: false, gmailAddress: null } : prev
                );
                setTestResult(null);
                setLastSynced(null);
                await loadStatus();
                // Force a full page data refresh
                window.location.reload();
            } else {
                onError(data.error || "Failed to disconnect");
            }
        } catch (err) {
            onError(err instanceof Error ? err.message : "Failed to disconnect");
        } finally {
            setDisconnecting(false);
        }
    };

    const isConnected = status?.connected ?? false;
    const connectedAddress = status?.gmailAddress;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Connection</CardTitle>
                <CardDescription>
                    {isConnected
                        ? `${provider.name} is connected and ready to use.`
                        : `Connect your ${provider.name} account to get started.`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Status indicator */}
                <div className="flex items-center gap-4">
                    <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            isConnected ? "bg-green-500/10" : "bg-muted"
                        }`}
                    >
                        <div
                            className={`h-3 w-3 rounded-full ${
                                isConnected ? "bg-green-500" : "bg-gray-400"
                            }`}
                        />
                    </div>
                    <div>
                        <div className="font-medium">
                            {statusLoading
                                ? "Checking status..."
                                : isConnected
                                  ? "Connected"
                                  : "Not connected"}
                        </div>
                        {isConnected && connectedAddress && (
                            <div className="text-muted-foreground text-sm">{connectedAddress}</div>
                        )}
                        {!isConnected && !statusLoading && (
                            <div className="text-muted-foreground text-sm">
                                Click connect to authorize access.
                            </div>
                        )}
                    </div>
                </div>

                {/* Test result */}
                {testResult && (
                    <div
                        className={`rounded-md px-4 py-3 text-sm ${
                            testResult === "connected"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-red-500/10 text-red-500"
                        }`}
                    >
                        {testResult === "connected"
                            ? "Connection test passed. Everything is working."
                            : testResult}
                    </div>
                )}

                {/* Last synced */}
                {lastSynced && (
                    <div className="text-muted-foreground text-xs">
                        Credentials synced {lastSynced.toLocaleTimeString()}
                    </div>
                )}

                {/* Missing scopes warning */}
                {status?.needsReauth && status.missingScopes.length > 0 && (
                    <div className="rounded-md bg-yellow-500/10 px-4 py-3 text-sm text-yellow-600">
                        Some permissions are missing. Please reconnect to grant full access.
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                    {!isConnected ? (
                        <Button onClick={handleConnect} disabled={connecting || statusLoading}>
                            {connecting ? "Connecting..." : `Connect ${provider.name}`}
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleTest}
                                disabled={testing || provider.connections.length === 0}
                            >
                                {testing ? "Testing..." : "Test Connection"}
                            </Button>
                            <Button variant="outline" onClick={handleSync} disabled={syncing}>
                                {syncing ? "Syncing..." : "Sync Credentials"}
                            </Button>
                            <Button variant="outline" onClick={handleConnect} disabled={connecting}>
                                {connecting ? "Reconnecting..." : "Reconnect"}
                            </Button>
                            <Button
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                onClick={handleDisconnect}
                                disabled={disconnecting || provider.connections.length === 0}
                            >
                                {disconnecting ? "Disconnecting..." : "Disconnect"}
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/* -------------------------------------------------------------------------- */
/*  Main page component                                                       */
/* -------------------------------------------------------------------------- */

export default function ProviderDetailPage() {
    const params = useParams();
    const providerKey = typeof params.providerKey === "string" ? params.providerKey : "";
    const [provider, setProvider] = useState<IntegrationProvider | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        scope: "org",
        credentials: "",
        metadata: ""
    });
    const [requiredValues, setRequiredValues] = useState<Record<string, string>>({});
    const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testAfterSave, setTestAfterSave] = useState(true);
    const [testStatus, setTestStatus] = useState<Record<string, string>>({});
    const [actionsByConnection, setActionsByConnection] = useState<Record<string, unknown>>({});
    const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
    const [connectionForms, setConnectionForms] = useState<Record<string, ConnectionFormState>>({});
    const [showAdvancedEdit, setShowAdvancedEdit] = useState<Record<string, boolean>>({});
    const [loadingConnectionId, setLoadingConnectionId] = useState<string | null>(null);
    const [savingConnectionId, setSavingConnectionId] = useState<string | null>(null);

    const isOAuthProvider = provider?.authType === "oauth" && OAUTH_PROVIDER_MAP[provider.key];

    const requiredFields = useMemo(() => {
        const required = provider?.config?.requiredFields;
        return Array.isArray(required) ? required : [];
    }, [provider?.config]);
    const fieldDefinitions = useMemo(() => {
        const defs = provider?.config?.fieldDefinitions;
        if (!defs || typeof defs !== "object" || Array.isArray(defs)) {
            return {} as Record<string, Record<string, string>>;
        }
        return defs as Record<string, Record<string, string>>;
    }, [provider?.config]);
    const setupUrl =
        provider?.config && typeof provider.config.setupUrl === "string"
            ? provider.config.setupUrl
            : null;
    const setupLabel =
        provider?.config && typeof provider.config.setupLabel === "string"
            ? provider.config.setupLabel
            : "Open Setup";
    const requiredScopes = useMemo(() => {
        const scopes = provider?.config?.requiredScopes;
        return Array.isArray(scopes) ? scopes : [];
    }, [provider?.config]);
    const showAdvancedCreateFields = showAdvancedCreate || requiredFields.length === 0;

    useEffect(() => {
        if (requiredFields.length === 0) {
            setRequiredValues({});
            return;
        }
        setRequiredValues((prev) => {
            const next: Record<string, string> = {};
            requiredFields.forEach((field) => {
                next[field] = prev[field] ?? "";
            });
            return next;
        });
    }, [requiredFields]);

    useEffect(() => {
        const fetchProvider = async () => {
            try {
                const response = await fetch(`${getApiBase()}/api/integrations/providers`);
                const data = (await response.json()) as ProvidersResponse;
                if (!data.success) {
                    setError(data.error || "Failed to load provider");
                    return;
                }
                const match = data.providers?.find((entry) => entry.key === providerKey) || null;
                if (!match) {
                    setError("Provider not found");
                    return;
                }
                setProvider(match);
                setForm((prev) => ({
                    ...prev,
                    name: match.name ? `${match.name} Connection` : prev.name
                }));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load provider");
            } finally {
                setLoading(false);
            }
        };

        if (providerKey) {
            fetchProvider();
        }
    }, [providerKey]);

    const refreshProvider = async () => {
        const response = await fetch(`${getApiBase()}/api/integrations/providers`);
        const data = (await response.json()) as ProvidersResponse;
        if (!data.success) {
            setError(data.error || "Failed to refresh provider");
            return;
        }
        const match = data.providers?.find((entry) => entry.key === providerKey) || null;
        setProvider(match);
    };

    const handleCreateConnection = async () => {
        if (!provider) return;
        setSaving(true);
        setError(null);
        try {
            const parsedCredentials = parseJson(form.credentials, "Credentials JSON", setError);
            if (!parsedCredentials) return;
            const mergedCredentials = mergeRequiredValues(
                parsedCredentials,
                requiredValues,
                requiredFields
            );
            const parsedMetadata = parseJson(form.metadata, "Metadata JSON", setError);
            if (!parsedMetadata) return;
            const response = await fetch(`${getApiBase()}/api/integrations/connections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    providerKey: provider.key,
                    name: form.name,
                    scope: form.scope,
                    credentials: mergedCredentials,
                    metadata: parsedMetadata
                })
            });
            const data = await response.json();
            if (!data.success) {
                setError(data.error || "Failed to create connection");
                return;
            }
            await refreshProvider();
            if (testAfterSave && data.connection?.id) {
                await handleTestConnection(data.connection.id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create connection");
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async (connectionId: string) => {
        setTestStatus((prev) => ({ ...prev, [connectionId]: "Testing..." }));
        try {
            const response = await fetch(
                `${getApiBase()}/api/integrations/connections/${connectionId}/test`,
                { method: "POST" }
            );
            const data = await response.json();
            if (!data.success) {
                setTestStatus((prev) => ({
                    ...prev,
                    [connectionId]: data.error || "Test failed"
                }));
                return;
            }
            setTestStatus((prev) => ({
                ...prev,
                [connectionId]: data.connected ? "Connected" : "Missing auth"
            }));
        } catch (err) {
            setTestStatus((prev) => ({
                ...prev,
                [connectionId]: err instanceof Error ? err.message : "Test failed"
            }));
        }
    };

    const handleLoadActions = async (connectionId: string) => {
        try {
            const response = await fetch(
                `${getApiBase()}/api/integrations/connections/${connectionId}/actions`
            );
            const data = await response.json();
            if (!data.success) {
                setError(data.error || "Failed to load actions");
                return;
            }
            setActionsByConnection((prev) => ({
                ...prev,
                [connectionId]: data
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load actions");
        }
    };

    const loadConnectionDetails = async (connectionId: string) => {
        setLoadingConnectionId(connectionId);
        setError(null);
        try {
            const response = await fetch(
                `${getApiBase()}/api/integrations/connections/${connectionId}`
            );
            const data = (await response.json()) as {
                success: boolean;
                connection?: ConnectionDetail;
                error?: string;
            };
            if (!data.success || !data.connection) {
                setError(data.error || "Failed to load connection details");
                return;
            }
            const connection = data.connection;
            const credentials =
                connection.credentials && typeof connection.credentials === "object"
                    ? connection.credentials
                    : {};
            const metadata =
                connection.metadata && typeof connection.metadata === "object"
                    ? connection.metadata
                    : {};
            setConnectionForms((prev) => ({
                ...prev,
                [connectionId]: {
                    name: connection.name,
                    isDefault: connection.isDefault,
                    isActive: connection.isActive,
                    credentialsJson: formatJson(credentials),
                    metadataJson: formatJson(metadata),
                    requiredValues: extractRequiredValues(credentials, requiredFields),
                    errorMessage: connection.errorMessage || null
                }
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load connection details");
        } finally {
            setLoadingConnectionId(null);
        }
    };

    const handleToggleEdit = async (connectionId: string) => {
        if (editingConnectionId === connectionId) {
            setEditingConnectionId(null);
            return;
        }
        setEditingConnectionId(connectionId);
        if (!connectionForms[connectionId]) {
            await loadConnectionDetails(connectionId);
        }
    };

    const handleUpdateConnection = async (connectionId: string) => {
        const formState = connectionForms[connectionId];
        if (!formState) return;
        setSavingConnectionId(connectionId);
        setError(null);
        try {
            const parsedCredentials = parseJson(
                formState.credentialsJson,
                "Credentials JSON",
                setError
            );
            if (!parsedCredentials) return;
            const mergedCredentials = mergeRequiredValues(
                parsedCredentials,
                formState.requiredValues,
                requiredFields
            );
            const parsedMetadata = parseJson(formState.metadataJson, "Metadata JSON", setError);
            if (!parsedMetadata) return;
            const response = await fetch(
                `${getApiBase()}/api/integrations/connections/${connectionId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formState.name,
                        isDefault: formState.isDefault,
                        isActive: formState.isActive,
                        credentials: mergedCredentials,
                        metadata: parsedMetadata
                    })
                }
            );
            const data = await response.json();
            if (!data.success) {
                setError(data.error || "Failed to update connection");
                return;
            }
            await refreshProvider();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update connection");
        } finally {
            setSavingConnectionId(null);
        }
    };

    if (loading) {
        return (
            <div className="text-muted-foreground container mx-auto py-6 text-sm">Loading...</div>
        );
    }

    if (!provider) {
        return (
            <div className="container mx-auto space-y-4 py-6">
                <Link href="/mcp" className={buttonVariants({ variant: "outline" })}>
                    Back to Integrations
                </Link>
                <Card>
                    <CardContent className="py-6 text-sm text-red-500">{error}</CardContent>
                </Card>
            </div>
        );
    }

    /* ====================================================================== */
    /*  OAuth providers get a simplified, SaaS-style page                      */
    /* ====================================================================== */

    if (isOAuthProvider) {
        return (
            <div className="container mx-auto max-w-2xl space-y-6 py-6">
                <div>
                    <Link
                        href="/mcp"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Back to Integrations
                    </Link>
                    <h1 className="mt-3 text-2xl font-semibold">{provider.name}</h1>
                    <p className="text-muted-foreground text-sm">{provider.description}</p>
                </div>

                {error && (
                    <div className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-500">
                        {error}
                    </div>
                )}

                <OAuthProviderView provider={provider} onError={setError} />
            </div>
        );
    }

    /* ====================================================================== */
    /*  Non-OAuth providers keep the full generic form                         */
    /* ====================================================================== */

    return (
        <div className="container mx-auto space-y-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <Link
                        href="/mcp"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Back to Integrations
                    </Link>
                    <h1 className="mt-3 text-2xl font-semibold">{provider.name}</h1>
                    <p className="text-muted-foreground text-sm">{provider.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="uppercase">
                        {provider.authType}
                    </Badge>
                    <Badge variant="outline" className="uppercase">
                        {provider.providerType}
                    </Badge>
                </div>
            </div>

            {error && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                </Card>
            )}

            {(requiredFields.length > 0 || requiredScopes.length > 0 || setupUrl) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Provider Requirements</CardTitle>
                        <CardDescription>
                            Requirements are driven by the provider configuration.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-muted-foreground space-y-3 text-sm">
                        {requiredFields.length > 0 && (
                            <div>
                                <div className="text-xs font-medium uppercase">Required Fields</div>
                                <div>{requiredFields.join(", ")}</div>
                            </div>
                        )}
                        {requiredScopes.length > 0 && (
                            <div>
                                <div className="text-xs font-medium uppercase">Required Scopes</div>
                                <div>{requiredScopes.join(", ")}</div>
                            </div>
                        )}
                        {setupUrl && (
                            <div>
                                <Link
                                    href={setupUrl}
                                    className={buttonVariants({ variant: "outline", size: "sm" })}
                                >
                                    {setupLabel}
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Create Connection</CardTitle>
                    <CardDescription>
                        Store credentials and metadata for this provider.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="connection-name">Connection Name</Label>
                        <Input
                            id="connection-name"
                            value={form.name}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, name: event.target.value }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Scope</Label>
                        <Select
                            value={form.scope}
                            onValueChange={(value) =>
                                setForm((prev) => ({ ...prev, scope: value || "org" }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select scope" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="org">Organization</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {requiredFields.length > 0 && (
                        <div className="grid gap-3 md:grid-cols-2">
                            {requiredFields.map((field) => {
                                const definition = fieldDefinitions[field] || {};
                                const label = definition.label || field;
                                const description = definition.description;
                                const placeholder = definition.placeholder || "";
                                const type =
                                    definition.type === "password"
                                        ? "password"
                                        : definition.type === "url"
                                          ? "url"
                                          : "text";

                                return (
                                    <div key={field} className="space-y-2">
                                        <Label htmlFor={`required-${field}`}>{label}</Label>
                                        <Input
                                            id={`required-${field}`}
                                            type={type}
                                            placeholder={placeholder}
                                            value={requiredValues[field] || ""}
                                            onChange={(event) =>
                                                setRequiredValues((prev) => ({
                                                    ...prev,
                                                    [field]: event.target.value
                                                }))
                                            }
                                        />
                                        {description && (
                                            <div className="text-muted-foreground text-xs">
                                                {description}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {requiredFields.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAdvancedCreate((prev) => !prev)}
                        >
                            {showAdvancedCreate ? "Hide Advanced JSON" : "Show Advanced JSON"}
                        </Button>
                    )}
                    {showAdvancedCreateFields && (
                        <>
                            <div className="space-y-2">
                                <Label>Credentials (JSON)</Label>
                                <Textarea
                                    value={form.credentials}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            credentials: event.target.value
                                        }))
                                    }
                                    className="min-h-[140px] font-mono text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Metadata (JSON)</Label>
                                <Textarea
                                    value={form.metadata}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            metadata: event.target.value
                                        }))
                                    }
                                    className="min-h-[140px] font-mono text-xs"
                                />
                            </div>
                        </>
                    )}
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={testAfterSave}
                            onCheckedChange={(checked) => setTestAfterSave(checked)}
                        />
                        <Label>Test connection after saving</Label>
                    </div>
                    <Button onClick={handleCreateConnection} disabled={saving}>
                        {saving ? "Saving..." : "Save Connection"}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Connections</CardTitle>
                    <CardDescription>
                        Test connections and view available actions/triggers.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {provider.connections.length === 0 && (
                        <div className="text-muted-foreground text-sm">
                            No connections configured for this provider.
                        </div>
                    )}
                    {provider.connections.map((connection) => (
                        <div key={connection.id} className="space-y-3 rounded-md border px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="font-medium">{connection.name}</div>
                                    <div className="text-muted-foreground text-xs">
                                        {connection.scope}
                                        {connection.isDefault ? " · default" : ""}
                                        {!connection.isActive ? " · disabled" : ""}
                                    </div>
                                    {connection.missingFields.length > 0 && (
                                        <div className="text-xs text-yellow-600">
                                            Missing: {connection.missingFields.join(", ")}
                                        </div>
                                    )}
                                </div>
                                <ConnectionBadge connected={connection.connected} />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTestConnection(connection.id)}
                                >
                                    Test Connection
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleLoadActions(connection.id)}
                                >
                                    Load Actions
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleToggleEdit(connection.id)}
                                >
                                    {editingConnectionId === connection.id ? "Close" : "Edit"}
                                </Button>
                                {testStatus[connection.id] && (
                                    <span className="text-muted-foreground text-xs">
                                        {testStatus[connection.id]}
                                    </span>
                                )}
                            </div>
                            {editingConnectionId === connection.id && (
                                <div className="bg-muted/40 space-y-4 rounded-md border p-4 text-sm">
                                    {loadingConnectionId === connection.id && (
                                        <div className="text-muted-foreground text-xs">
                                            Loading connection details...
                                        </div>
                                    )}
                                    {connectionForms[connection.id] && (
                                        <>
                                            {connectionForms[connection.id].errorMessage && (
                                                <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-500">
                                                    {connectionForms[connection.id].errorMessage}
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <Label htmlFor={`edit-name-${connection.id}`}>
                                                    Connection Name
                                                </Label>
                                                <Input
                                                    id={`edit-name-${connection.id}`}
                                                    value={connectionForms[connection.id].name}
                                                    onChange={(event) =>
                                                        setConnectionForms((prev) => ({
                                                            ...prev,
                                                            [connection.id]: {
                                                                ...prev[connection.id],
                                                                name: event.target.value
                                                            }
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-6">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={
                                                            connectionForms[connection.id].isDefault
                                                        }
                                                        onCheckedChange={(checked) =>
                                                            setConnectionForms((prev) => ({
                                                                ...prev,
                                                                [connection.id]: {
                                                                    ...prev[connection.id],
                                                                    isDefault: checked
                                                                }
                                                            }))
                                                        }
                                                    />
                                                    <Label>Default</Label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={
                                                            connectionForms[connection.id].isActive
                                                        }
                                                        onCheckedChange={(checked) =>
                                                            setConnectionForms((prev) => ({
                                                                ...prev,
                                                                [connection.id]: {
                                                                    ...prev[connection.id],
                                                                    isActive: checked
                                                                }
                                                            }))
                                                        }
                                                    />
                                                    <Label>Active</Label>
                                                </div>
                                            </div>
                                            {requiredFields.length > 0 && (
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    {requiredFields.map((field) => {
                                                        const definition =
                                                            fieldDefinitions[field] || {};
                                                        const label = definition.label || field;
                                                        const description = definition.description;
                                                        const placeholder =
                                                            definition.placeholder || "";
                                                        const type =
                                                            definition.type === "password"
                                                                ? "password"
                                                                : definition.type === "url"
                                                                  ? "url"
                                                                  : "text";

                                                        return (
                                                            <div key={field} className="space-y-2">
                                                                <Label
                                                                    htmlFor={`edit-${connection.id}-${field}`}
                                                                >
                                                                    {label}
                                                                </Label>
                                                                <Input
                                                                    id={`edit-${connection.id}-${field}`}
                                                                    type={type}
                                                                    placeholder={placeholder}
                                                                    value={
                                                                        connectionForms[
                                                                            connection.id
                                                                        ].requiredValues[field] ||
                                                                        ""
                                                                    }
                                                                    onChange={(event) =>
                                                                        setConnectionForms(
                                                                            (prev) => ({
                                                                                ...prev,
                                                                                [connection.id]: {
                                                                                    ...prev[
                                                                                        connection
                                                                                            .id
                                                                                    ],
                                                                                    requiredValues:
                                                                                        {
                                                                                            ...prev[
                                                                                                connection
                                                                                                    .id
                                                                                            ]
                                                                                                .requiredValues,
                                                                                            [field]:
                                                                                                event
                                                                                                    .target
                                                                                                    .value
                                                                                        }
                                                                                }
                                                                            })
                                                                        )
                                                                    }
                                                                />
                                                                {description && (
                                                                    <div className="text-muted-foreground text-xs">
                                                                        {description}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {requiredFields.length > 0 && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setShowAdvancedEdit((prev) => ({
                                                            ...prev,
                                                            [connection.id]: !prev[connection.id]
                                                        }))
                                                    }
                                                >
                                                    {showAdvancedEdit[connection.id]
                                                        ? "Hide Advanced JSON"
                                                        : "Show Advanced JSON"}
                                                </Button>
                                            )}
                                            {(showAdvancedEdit[connection.id] ||
                                                requiredFields.length === 0) && (
                                                <>
                                                    <div className="space-y-2">
                                                        <Label>Credentials (JSON)</Label>
                                                        <Textarea
                                                            value={
                                                                connectionForms[connection.id]
                                                                    .credentialsJson
                                                            }
                                                            onChange={(event) =>
                                                                setConnectionForms((prev) => ({
                                                                    ...prev,
                                                                    [connection.id]: {
                                                                        ...prev[connection.id],
                                                                        credentialsJson:
                                                                            event.target.value
                                                                    }
                                                                }))
                                                            }
                                                            className="min-h-[140px] font-mono text-xs"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Metadata (JSON)</Label>
                                                        <Textarea
                                                            value={
                                                                connectionForms[connection.id]
                                                                    .metadataJson
                                                            }
                                                            onChange={(event) =>
                                                                setConnectionForms((prev) => ({
                                                                    ...prev,
                                                                    [connection.id]: {
                                                                        ...prev[connection.id],
                                                                        metadataJson:
                                                                            event.target.value
                                                                    }
                                                                }))
                                                            }
                                                            className="min-h-[140px] font-mono text-xs"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                            <Button
                                                onClick={() =>
                                                    handleUpdateConnection(connection.id)
                                                }
                                                disabled={savingConnectionId === connection.id}
                                            >
                                                {savingConnectionId === connection.id
                                                    ? "Saving..."
                                                    : "Save Changes"}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            )}
                            {Boolean(actionsByConnection[connection.id]) ? (
                                <pre className="bg-muted/40 max-h-64 overflow-auto rounded p-3 text-xs">
                                    {formatJson(actionsByConnection[connection.id])}
                                </pre>
                            ) : null}
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Provider Metadata</CardTitle>
                    <CardDescription>
                        Actions and triggers registered for this provider.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                            Actions
                        </div>
                        <pre className="bg-muted/40 max-h-64 overflow-auto rounded p-3 text-xs">
                            {formatJson(provider.actions || {})}
                        </pre>
                    </div>
                    <div>
                        <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                            Triggers
                        </div>
                        <pre className="bg-muted/40 max-h-64 overflow-auto rounded p-3 text-xs">
                            {formatJson(provider.triggers || {})}
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
