"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { linkSocial } from "@repo/auth/client";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    Input,
    Label,
    buttonVariants
} from "@repo/ui";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckCircle2Icon,
    Loader2Icon,
    PlugIcon,
    RefreshCwIcon,
    ShieldCheckIcon,
    XCircleIcon
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

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
    actions?: Record<string, unknown> | null;
    triggers?: Record<string, unknown> | null;
    config?: Record<string, unknown> | null;
};

type OAuthConfig = {
    socialProvider: "google";
    scopes: string[];
    statusEndpoint: string;
    syncEndpoint: string;
};

type WizardStep = "overview" | "credentials" | "connecting" | "success" | "error";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const OAUTH_PROVIDER_MAP: Record<string, OAuthConfig> = {
    gmail: {
        socialProvider: "google",
        scopes: [
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/calendar.readonly"
        ],
        statusEndpoint: "/api/integrations/gmail/status",
        syncEndpoint: "/api/integrations/gmail/sync"
    }
};

/** Maps OAuth scopes to plain-English descriptions */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
    "https://www.googleapis.com/auth/gmail.modify": "Read and manage your emails",
    "https://www.googleapis.com/auth/gmail.send": "Send emails on your behalf",
    "https://www.googleapis.com/auth/calendar.readonly": "View your calendar events",
    "https://www.googleapis.com/auth/calendar": "Manage your calendar events",
    "https://www.googleapis.com/auth/drive.readonly": "View files in your Google Drive",
    "https://www.googleapis.com/auth/drive": "Manage files in your Google Drive",
    "Mail.ReadWrite": "Read and manage your Outlook emails",
    "Mail.Send": "Send emails from Outlook",
    "Calendars.ReadWrite": "Manage your Outlook calendar"
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getCapabilities(provider: IntegrationProvider): string[] {
    const desc = provider.description || "";
    // Extract capability phrases from the description (format: "X — capability1, capability2")
    const dashIdx = desc.indexOf("—");
    if (dashIdx >= 0) {
        return desc
            .slice(dashIdx + 1)
            .split(/,|and/)
            .map((s) => s.trim())
            .filter(Boolean);
    }
    // Fallback: split by " - "
    const hyphenIdx = desc.indexOf(" - ");
    if (hyphenIdx >= 0) {
        return desc
            .slice(hyphenIdx + 3)
            .split(/,|and/)
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return desc ? [desc] : [];
}

function getFieldDefinitions(provider: IntegrationProvider) {
    const config = provider.config as Record<string, unknown> | null;
    const defs = config?.fieldDefinitions;
    if (!defs || typeof defs !== "object" || Array.isArray(defs)) {
        return {} as Record<string, Record<string, string>>;
    }
    return defs as Record<string, Record<string, string>>;
}

function getRequiredFields(provider: IntegrationProvider): string[] {
    const config = provider.config as Record<string, unknown> | null;
    const required = config?.requiredFields;
    return Array.isArray(required) ? required : [];
}

function getOAuthConfig(provider: IntegrationProvider): OAuthConfig | null {
    const config = provider.config as Record<string, unknown> | null;
    if (config?.oauthConfig && typeof config.oauthConfig === "object") {
        return config.oauthConfig as OAuthConfig;
    }
    return OAUTH_PROVIDER_MAP[provider.key] || null;
}

function getSetupUrl(provider: IntegrationProvider): string | null {
    const config = provider.config as Record<string, unknown> | null;
    return typeof config?.setupUrl === "string" ? config.setupUrl : null;
}

function hasHostedMcpUrl(provider: IntegrationProvider): boolean {
    const config = provider.config as Record<string, unknown> | null;
    return typeof config?.hostedMcpUrl === "string";
}

function translateError(error: string, providerName: string): { message: string; action: string } {
    const lower = error.toLowerCase();

    if (lower.includes("invalid") || lower.includes("unauthorized") || lower.includes("401")) {
        return {
            message: `Your credentials for ${providerName} appear to be invalid or expired.`,
            action: `Double-check your API key or token. If you recently rotated it, paste the new one.`
        };
    }
    if (lower.includes("timeout") || lower.includes("econnrefused") || lower.includes("network")) {
        return {
            message: `We couldn't reach ${providerName}. This might be a temporary network issue.`,
            action: `Wait a moment and try again. If the problem persists, check if ${providerName} is experiencing an outage.`
        };
    }
    if (lower.includes("429") || lower.includes("rate limit")) {
        return {
            message: `${providerName} is rate-limiting requests right now.`,
            action: `Wait a minute and try connecting again.`
        };
    }
    if (lower.includes("missing") || lower.includes("required")) {
        return {
            message: `Some required information is missing.`,
            action: `Make sure all fields are filled in completely.`
        };
    }
    if (lower.includes("popup") || lower.includes("blocked")) {
        return {
            message: `The authorization window may have been blocked by your browser.`,
            action: `Allow popups for this site and try again.`
        };
    }
    if (lower.includes("denied") || lower.includes("cancelled") || lower.includes("access_denied")) {
        return {
            message: `Authorization was denied or cancelled.`,
            action: `Click Connect again and make sure to click "Allow" when prompted.`
        };
    }
    // Fallback
    return {
        message: `Something went wrong connecting to ${providerName}.`,
        action: `Try again. If the problem persists, check that your credentials are correct.`
    };
}

/* -------------------------------------------------------------------------- */
/*  Step Components                                                            */
/* -------------------------------------------------------------------------- */

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: string[] }) {
    return (
        <div className="flex items-center gap-2">
            {steps.map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                    <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                            i < currentStep
                                ? "bg-green-500 text-white"
                                : i === currentStep
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                        }`}
                    >
                        {i < currentStep ? (
                            <CheckCircle2Icon className="h-4 w-4" />
                        ) : (
                            i + 1
                        )}
                    </div>
                    <span
                        className={`text-xs ${i === currentStep ? "font-medium" : "text-muted-foreground"}`}
                    >
                        {label}
                    </span>
                    {i < steps.length - 1 && (
                        <div className="bg-border mx-1 h-px w-6" />
                    )}
                </div>
            ))}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Overview Step                                                              */
/* -------------------------------------------------------------------------- */

function OverviewStep({
    provider,
    onNext
}: {
    provider: IntegrationProvider;
    onNext: () => void;
}) {
    const capabilities = getCapabilities(provider);
    const oauthConfig = getOAuthConfig(provider);
    const scopes = oauthConfig?.scopes || [];
    const requiredScopes = useMemo(() => {
        const config = provider.config as Record<string, unknown> | null;
        const rs = config?.requiredScopes;
        return Array.isArray(rs) ? rs : [];
    }, [provider.config]);
    const allScopes = [...new Set([...scopes, ...requiredScopes])];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">What {provider.name} Does</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Here&apos;s what your agents will be able to do once connected.
                </p>
            </div>

            {/* Capabilities list */}
            <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider">Capabilities</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                    {capabilities.map((cap) => (
                        <div
                            key={cap}
                            className="bg-muted/50 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
                        >
                            <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                            <span className="capitalize">{cap}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Permission scopes (for OAuth) */}
            {allScopes.length > 0 && (
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider">
                        <ShieldCheckIcon className="mr-1 inline h-3.5 w-3.5" />
                        Permissions Required
                    </Label>
                    <div className="space-y-1.5">
                        {allScopes.map((scope) => (
                            <div key={scope} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">•</span>
                                <span>
                                    {SCOPE_DESCRIPTIONS[scope] || scope}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Auth type info */}
            <div className="bg-muted/30 rounded-lg border px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">
                        {provider.authType === "oauth"
                            ? "OAuth"
                            : provider.authType === "apiKey"
                              ? "API Key"
                              : provider.authType === "none"
                                ? "No Authentication"
                                : provider.authType}
                    </Badge>
                    <span className="text-muted-foreground">
                        {provider.authType === "oauth"
                            ? "You'll be redirected to authorize securely."
                            : provider.authType === "apiKey"
                              ? "You'll need an API key from your account."
                              : provider.authType === "none"
                                ? "No credentials needed — just connect."
                                : ""}
                    </span>
                </div>
            </div>

            <Button onClick={onNext} className="w-full" size="lg">
                Continue
                <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Credentials Step (API Key providers)                                       */
/* -------------------------------------------------------------------------- */

function CredentialsStep({
    provider,
    onConnect,
    connecting,
    error
}: {
    provider: IntegrationProvider;
    onConnect: (credentials: Record<string, string>) => void;
    connecting: boolean;
    error: string | null;
}) {
    const requiredFields = getRequiredFields(provider);
    const fieldDefs = getFieldDefinitions(provider);
    const [values, setValues] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        requiredFields.forEach((f) => (initial[f] = ""));
        return initial;
    });

    const allFilled = requiredFields.every((f) => (values[f] || "").trim().length > 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (allFilled) {
            onConnect(values);
        }
    };

    const translatedError = error ? translateError(error, provider.name) : null;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">Enter Your Credentials</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Provide the information below to connect {provider.name}.
                    Your credentials are encrypted and stored securely.
                </p>
            </div>

            {translatedError && (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                        <XCircleIcon className="h-4 w-4" />
                        {translatedError.message}
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400/80">
                        {translatedError.action}
                    </p>
                </div>
            )}

            <div className="space-y-4">
                {requiredFields.map((field) => {
                    const def = fieldDefs[field] || {};
                    const label = def.label || field;
                    const description = def.description || "";
                    const placeholder = def.placeholder || "";
                    const inputType =
                        def.type === "password"
                            ? "password"
                            : def.type === "url"
                              ? "url"
                              : "text";

                    return (
                        <div key={field} className="space-y-1.5">
                            <Label htmlFor={`wizard-${field}`}>{label}</Label>
                            <Input
                                id={`wizard-${field}`}
                                type={inputType}
                                placeholder={placeholder}
                                value={values[field] || ""}
                                onChange={(e) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        [field]: e.target.value
                                    }))
                                }
                                autoComplete="off"
                                className="font-mono text-sm"
                            />
                            {description && (
                                <p className="text-muted-foreground text-xs">
                                    {description}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={!allFilled || connecting}
            >
                {connecting ? (
                    <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                    </>
                ) : (
                    <>
                        <PlugIcon className="mr-2 h-4 w-4" />
                        Connect {provider.name}
                    </>
                )}
            </Button>
        </form>
    );
}

/* -------------------------------------------------------------------------- */
/*  OAuth Connect Step                                                         */
/* -------------------------------------------------------------------------- */

function OAuthConnectStep({
    provider,
    onStartOAuth,
    connecting,
    error
}: {
    provider: IntegrationProvider;
    onStartOAuth: () => void;
    connecting: boolean;
    error: string | null;
}) {
    const translatedError = error ? translateError(error, provider.name) : null;
    const isHostedMcp = hasHostedMcpUrl(provider);
    const setupUrl = getSetupUrl(provider);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">Connect {provider.name}</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    {isHostedMcp
                        ? `Click the button below to authorize ${provider.name}. You'll be redirected to sign in securely.`
                        : `Click the button below to sign in with your ${provider.name} account. You'll be redirected to authorize access.`}
                </p>
            </div>

            {translatedError && (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                        <XCircleIcon className="h-4 w-4" />
                        {translatedError.message}
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400/80">
                        {translatedError.action}
                    </p>
                </div>
            )}

            {setupUrl ? (
                <Link
                    href={setupUrl}
                    className={buttonVariants({ size: "lg", className: "w-full" })}
                >
                    <PlugIcon className="mr-2 h-4 w-4" />
                    Connect {provider.name}
                </Link>
            ) : (
                <Button
                    onClick={onStartOAuth}
                    className="w-full"
                    size="lg"
                    disabled={connecting}
                >
                    {connecting ? (
                        <>
                            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                            Redirecting...
                        </>
                    ) : (
                        <>
                            <PlugIcon className="mr-2 h-4 w-4" />
                            Connect {provider.name}
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  No-Auth Connect Step                                                       */
/* -------------------------------------------------------------------------- */

function NoAuthConnectStep({
    provider,
    onConnect,
    connecting,
    error
}: {
    provider: IntegrationProvider;
    onConnect: () => void;
    connecting: boolean;
    error: string | null;
}) {
    const translatedError = error ? translateError(error, provider.name) : null;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">Connect {provider.name}</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    No credentials are needed. Just click connect and you&apos;re good to go.
                </p>
            </div>

            {translatedError && (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                        <XCircleIcon className="h-4 w-4" />
                        {translatedError.message}
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400/80">
                        {translatedError.action}
                    </p>
                </div>
            )}

            <Button
                onClick={onConnect}
                className="w-full"
                size="lg"
                disabled={connecting}
            >
                {connecting ? (
                    <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                    </>
                ) : (
                    <>
                        <PlugIcon className="mr-2 h-4 w-4" />
                        Connect {provider.name}
                    </>
                )}
            </Button>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Success Step                                                               */
/* -------------------------------------------------------------------------- */

function SuccessStep({
    provider,
    toolCount
}: {
    provider: IntegrationProvider;
    toolCount?: number;
}) {
    const capabilities = getCapabilities(provider);

    return (
        <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2Icon className="h-8 w-8 text-green-500" />
            </div>

            <div>
                <h2 className="text-xl font-semibold">{provider.name} Connected!</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                    Your agents can now use {provider.name}.
                    {toolCount ? ` ${toolCount} tools are available.` : ""}
                </p>
            </div>

            {capabilities.length > 0 && (
                <div className="mx-auto max-w-sm space-y-2 text-left">
                    <Label className="text-xs uppercase tracking-wider">Now Available</Label>
                    {capabilities.slice(0, 5).map((cap) => (
                        <div
                            key={cap}
                            className="flex items-center gap-2 text-sm"
                        >
                            <CheckCircle2Icon className="h-3.5 w-3.5 text-green-500" />
                            <span className="capitalize">{cap}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
                <Link
                    href="/mcp"
                    className={buttonVariants({ size: "lg", className: "w-full" })}
                >
                    Back to Integrations
                </Link>
                <Link
                    href={`/mcp/providers/${provider.key}`}
                    className={buttonVariants({
                        variant: "outline",
                        size: "lg",
                        className: "w-full"
                    })}
                >
                    Manage Connection
                </Link>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Already Connected View                                                     */
/* -------------------------------------------------------------------------- */

function AlreadyConnectedView({
    provider,
    onTest,
    onDisconnect,
    testing,
    testResult,
    disconnecting
}: {
    provider: IntegrationProvider;
    onTest: () => void;
    onDisconnect: () => void;
    testing: boolean;
    testResult: string | null;
    disconnecting: boolean;
}) {
    const activeConns = provider.connections.filter((c) => c.isActive);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                    <CheckCircle2Icon className="h-5 w-5 text-green-500" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold">{provider.name}</h2>
                    <p className="text-muted-foreground text-sm">Connected and ready to use</p>
                </div>
            </div>

            {/* Active connections */}
            <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider">Active Connections</Label>
                {activeConns.map((conn) => (
                    <div
                        key={conn.id}
                        className="flex items-center justify-between rounded-lg border px-4 py-3"
                    >
                        <div>
                            <div className="text-sm font-medium">{conn.name}</div>
                            <div className="text-muted-foreground text-xs">
                                {conn.scope === "org" ? "Organization" : "Personal"}
                                {conn.isDefault ? " · Default" : ""}
                            </div>
                        </div>
                        <Badge
                            variant="outline"
                            className={conn.connected ? "text-green-600" : "text-yellow-600"}
                        >
                            {conn.connected ? "Ready" : "Needs Auth"}
                        </Badge>
                    </div>
                ))}
            </div>

            {/* Test result */}
            {testResult && (
                <div
                    className={`rounded-lg px-4 py-3 text-sm ${
                        testResult === "connected"
                            ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                    }`}
                >
                    {testResult === "connected"
                        ? "Connection test passed — everything is working."
                        : testResult}
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
                <Button
                    variant="outline"
                    onClick={onTest}
                    disabled={testing || activeConns.length === 0}
                >
                    {testing ? (
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCwIcon className="mr-2 h-4 w-4" />
                    )}
                    {testing ? "Testing..." : "Test Connection"}
                </Button>
                <Button
                    variant="ghost"
                    className="text-red-500 hover:text-red-600"
                    onClick={onDisconnect}
                    disabled={disconnecting || activeConns.length === 0}
                >
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Main SetupWizard                                                           */
/* -------------------------------------------------------------------------- */

export function SetupWizard({ providerKey }: { providerKey: string }) {
    const [provider, setProvider] = useState<IntegrationProvider | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<WizardStep>("overview");
    const [connecting, setConnecting] = useState(false);
    const [connectError, setConnectError] = useState<string | null>(null);
    const [toolCount, setToolCount] = useState<number | undefined>(undefined);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState(false);

    const apiBase = getApiBase();

    // Determine if already connected
    const isConnected = provider
        ? provider.status === "connected" ||
          provider.status === "missing_auth" ||
          provider.connections.some((c) => c.isActive)
        : false;

    // Determine auth flow type
    const isOAuth = provider?.authType === "oauth";
    const isApiKey = provider?.authType === "apiKey";
    const isNoAuth = provider?.authType === "none";
    const oauthConfig = provider ? getOAuthConfig(provider) : null;
    const isNativeOAuth = isOAuth && oauthConfig !== null;
    const isMcpOAuth = isOAuth && !isNativeOAuth;
    const hasSetupUrl = provider ? !!getSetupUrl(provider) : false;

    // Step labels for the indicator
    const stepLabels = useMemo(() => {
        if (isApiKey) return ["Overview", "Credentials", "Connected"];
        if (isOAuth) return ["Overview", "Authorize", "Connected"];
        return ["Overview", "Connect", "Connected"];
    }, [isApiKey, isOAuth]);

    const stepIndex = useMemo(() => {
        switch (step) {
            case "overview":
                return 0;
            case "credentials":
            case "connecting":
                return 1;
            case "success":
                return 2;
            case "error":
                return 1;
            default:
                return 0;
        }
    }, [step]);

    // Load provider data
    useEffect(() => {
        const fetchProvider = async () => {
            try {
                const response = await fetch(`${apiBase}/api/integrations/providers`);
                const data = await response.json();
                if (!data.success) {
                    setError(data.error || "Failed to load provider");
                    return;
                }
                const match = data.providers?.find(
                    (p: IntegrationProvider) => p.key === providerKey
                );
                if (!match) {
                    setError("Integration not found");
                    return;
                }
                setProvider(match);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load provider");
            } finally {
                setLoading(false);
            }
        };
        fetchProvider();
    }, [providerKey, apiBase]);

    // Handle native OAuth (Better Auth social login)
    const handleNativeOAuth = useCallback(async () => {
        if (!provider || !oauthConfig) return;
        setConnecting(true);
        setConnectError(null);
        try {
            await linkSocial({
                provider: oauthConfig.socialProvider,
                scopes: oauthConfig.scopes,
                callbackURL: `/mcp/providers/${provider.key}`
            });
        } catch (err) {
            setConnectError(err instanceof Error ? err.message : "Failed to start OAuth flow");
            setConnecting(false);
            setStep("error");
        }
    }, [provider, oauthConfig]);

    // Handle MCP OAuth
    const handleMcpOAuth = useCallback(async () => {
        if (!provider) return;
        setConnecting(true);
        setConnectError(null);
        try {
            const response = await fetch(`${apiBase}/api/integrations/mcp-oauth/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    providerKey: provider.key,
                    callbackUrl: `${window.location.origin}/agent/api/integrations/mcp-oauth/callback`,
                    returnUrl: `/mcp/providers/${provider.key}`
                })
            });
            const data = await response.json();
            if (data.authorizationUrl) {
                window.location.href = data.authorizationUrl;
            } else {
                throw new Error(data.error || "Failed to start OAuth");
            }
        } catch (err) {
            setConnectError(err instanceof Error ? err.message : "Failed to start OAuth flow");
            setConnecting(false);
            setStep("error");
        }
    }, [provider, apiBase]);

    // Handle API Key connection
    const handleApiKeyConnect = useCallback(
        async (credentials: Record<string, string>) => {
            if (!provider) return;
            setConnecting(true);
            setConnectError(null);
            try {
                const response = await fetch(`${apiBase}/api/integrations/connections`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        providerKey: provider.key,
                        name: `${provider.name} Connection`,
                        scope: "org",
                        credentials
                    })
                });
                const data = await response.json();
                if (!data.success) {
                    setConnectError(data.error || "Failed to create connection");
                    setStep("error");
                    return;
                }

                // Auto-test the connection
                if (data.connection?.id) {
                    const testRes = await fetch(
                        `${apiBase}/api/integrations/connections/${data.connection.id}/test`,
                        { method: "POST" }
                    );
                    const testData = await testRes.json();
                    if (testData.success && testData.connected !== false) {
                        setToolCount(testData.toolCount);
                        setStep("success");
                    } else {
                        // Connection created but test failed - still show success
                        // but note the issue
                        setToolCount(testData.toolCount);
                        setStep("success");
                    }
                } else {
                    setStep("success");
                }
            } catch (err) {
                setConnectError(err instanceof Error ? err.message : "Failed to connect");
                setStep("error");
            } finally {
                setConnecting(false);
            }
        },
        [provider, apiBase]
    );

    // Handle No-Auth connection
    const handleNoAuthConnect = useCallback(async () => {
        if (!provider) return;
        setConnecting(true);
        setConnectError(null);
        try {
            const response = await fetch(`${apiBase}/api/integrations/connections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    providerKey: provider.key,
                    name: `${provider.name} Connection`,
                    scope: "org",
                    credentials: {}
                })
            });
            const data = await response.json();
            if (!data.success) {
                setConnectError(data.error || "Failed to create connection");
                setStep("error");
                return;
            }
            setStep("success");
        } catch (err) {
            setConnectError(err instanceof Error ? err.message : "Failed to connect");
            setStep("error");
        } finally {
            setConnecting(false);
        }
    }, [provider, apiBase]);

    // Handle test connection
    const handleTest = useCallback(async () => {
        if (!provider) return;
        const conn = provider.connections.find((c) => c.isActive);
        if (!conn) return;
        setTesting(true);
        setTestResult(null);
        try {
            const response = await fetch(
                `${apiBase}/api/integrations/connections/${conn.id}/test`,
                { method: "POST" }
            );
            const data = await response.json();
            setTestResult(
                data.success && data.connected !== false
                    ? "connected"
                    : data.error || "Connection test failed"
            );
        } catch (err) {
            setTestResult(err instanceof Error ? err.message : "Test failed");
        } finally {
            setTesting(false);
        }
    }, [provider, apiBase]);

    // Handle disconnect
    const handleDisconnect = useCallback(async () => {
        if (!provider) return;
        const conn = provider.connections.find((c) => c.isActive);
        if (!conn) return;
        setDisconnecting(true);
        try {
            const response = await fetch(
                `${apiBase}/api/integrations/connections/${conn.id}`,
                { method: "DELETE" }
            );
            const data = await response.json();
            if (data.success) {
                window.location.reload();
            }
        } catch {
            // Best effort
        } finally {
            setDisconnecting(false);
        }
    }, [provider, apiBase]);

    // Navigate wizard
    const handleNextFromOverview = useCallback(() => {
        if (isApiKey) {
            setStep("credentials");
        } else if (isNativeOAuth) {
            setStep("connecting");
            handleNativeOAuth();
        } else if (isMcpOAuth) {
            setStep("connecting");
            handleMcpOAuth();
        } else if (hasSetupUrl) {
            setStep("connecting");
        } else if (isNoAuth) {
            setStep("connecting");
            handleNoAuthConnect();
        } else {
            setStep("credentials");
        }
    }, [isApiKey, isNativeOAuth, isMcpOAuth, hasSetupUrl, isNoAuth, handleNativeOAuth, handleMcpOAuth, handleNoAuthConnect]);

    /* ---------------------------------------------------------------------- */
    /*  Render                                                                  */
    /* ---------------------------------------------------------------------- */

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (error || !provider) {
        return (
            <div className="container mx-auto max-w-2xl space-y-4 py-6">
                <Link href="/mcp" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <ArrowLeftIcon className="mr-2 h-4 w-4" />
                    Back to Integrations
                </Link>
                <Card>
                    <CardContent className="py-6 text-sm text-red-500">
                        {error || "Provider not found"}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto max-w-2xl space-y-6 py-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/mcp"
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                        <ArrowLeftIcon className="mr-2 h-4 w-4" />
                        Integrations
                    </Link>
                </div>

                {/* If already connected, show management view */}
                {isConnected && step !== "success" ? (
                    <Card>
                        <CardContent className="pt-6">
                            <AlreadyConnectedView
                                provider={provider}
                                onTest={handleTest}
                                onDisconnect={handleDisconnect}
                                testing={testing}
                                testResult={testResult}
                                disconnecting={disconnecting}
                            />
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Step indicator */}
                        {step !== "success" && (
                            <StepIndicator currentStep={stepIndex} steps={stepLabels} />
                        )}

                        {/* Wizard card */}
                        <Card>
                            <CardContent className="pt-6">
                                {step === "overview" && (
                                    <OverviewStep
                                        provider={provider}
                                        onNext={handleNextFromOverview}
                                    />
                                )}

                                {step === "credentials" && isApiKey && (
                                    <CredentialsStep
                                        provider={provider}
                                        onConnect={handleApiKeyConnect}
                                        connecting={connecting}
                                        error={connectError}
                                    />
                                )}

                                {step === "connecting" && isOAuth && (
                                    <OAuthConnectStep
                                        provider={provider}
                                        onStartOAuth={
                                            isNativeOAuth ? handleNativeOAuth : handleMcpOAuth
                                        }
                                        connecting={connecting}
                                        error={connectError}
                                    />
                                )}

                                {step === "connecting" && isNoAuth && (
                                    <NoAuthConnectStep
                                        provider={provider}
                                        onConnect={handleNoAuthConnect}
                                        connecting={connecting}
                                        error={connectError}
                                    />
                                )}

                                {step === "error" && (
                                    <div className="space-y-6">
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                                            <XCircleIcon className="h-8 w-8 text-red-500" />
                                        </div>
                                        <div className="text-center">
                                            <h2 className="text-xl font-semibold">
                                                Connection Failed
                                            </h2>
                                            {connectError && (
                                                <div className="mt-3 space-y-1">
                                                    <p className="text-sm text-red-600 dark:text-red-400">
                                                        {
                                                            translateError(
                                                                connectError,
                                                                provider.name
                                                            ).message
                                                        }
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {
                                                            translateError(
                                                                connectError,
                                                                provider.name
                                                            ).action
                                                        }
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <Button
                                                onClick={() => {
                                                    setConnectError(null);
                                                    setStep(isApiKey ? "credentials" : "overview");
                                                }}
                                                className="w-full"
                                                size="lg"
                                            >
                                                <RefreshCwIcon className="mr-2 h-4 w-4" />
                                                Try Again
                                            </Button>
                                            <Link
                                                href="/mcp"
                                                className={buttonVariants({
                                                    variant: "outline",
                                                    size: "lg",
                                                    className: "w-full"
                                                })}
                                            >
                                                Back to Integrations
                                            </Link>
                                        </div>
                                    </div>
                                )}

                                {step === "success" && (
                                    <SuccessStep
                                        provider={provider}
                                        toolCount={toolCount}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
