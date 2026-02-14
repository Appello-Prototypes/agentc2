"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Separator,
    buttonVariants
} from "@repo/ui";
import {
    BotIcon,
    CheckCircle2Icon,
    MessageSquareIcon,
    MinusCircleIcon,
    PlugIcon,
    RefreshCwIcon,
    SparklesIcon,
    WrenchIcon,
    XCircleIcon
} from "lucide-react";
import { getApiBase } from "@/lib/utils";

/* ================================================================== */
/*  Types                                                              */
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

type ProvisionedResource = {
    skill: {
        id: string;
        slug: string;
        name: string;
        toolCount: number;
        deactivated: boolean;
    } | null;
    agent: { id: string; slug: string; name: string; isActive: boolean } | null;
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
    provisioned?: ProvisionedResource | null;
    healthStatus?: string | null;
};

interface DiagnosticsResult {
    timestamp: string;
    summary: { total: number; passed: number; failed: number; skipped: number };
    integrations: Record<
        string,
        {
            status: "pass" | "fail" | "skip";
            checks: { name: string; status: string; message: string; durationMs: number }[];
            config: Record<string, string | boolean | null>;
            credentialSource?: string;
        }
    >;
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

const CATEGORY_COLORS: Record<string, string> = {
    ai: "bg-indigo-500/10 text-indigo-600",
    knowledge: "bg-blue-500/10 text-blue-600",
    web: "bg-purple-500/10 text-purple-600",
    crm: "bg-orange-500/10 text-orange-600",
    productivity: "bg-green-500/10 text-green-600",
    communication: "bg-pink-500/10 text-pink-600",
    automation: "bg-cyan-500/10 text-cyan-600",
    payments: "bg-teal-500/10 text-teal-600",
    ecommerce: "bg-lime-500/10 text-lime-600",
    support: "bg-rose-500/10 text-rose-600",
    design: "bg-violet-500/10 text-violet-600",
    data: "bg-amber-500/10 text-amber-600"
};

function CategoryBadge({ category }: { category: string }) {
    return (
        <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[category] || "bg-gray-500/10 text-gray-600"}`}
        >
            {category}
        </span>
    );
}

function AuthBadge({ authType }: { authType: string }) {
    const label =
        authType === "oauth"
            ? "OAuth"
            : authType === "apiKey"
              ? "API Key"
              : authType === "none"
                ? "No Auth"
                : authType;
    return (
        <Badge variant="outline" className="text-[10px]">
            {label}
        </Badge>
    );
}

function StatusDot({ status }: { status: ProviderStatus }) {
    const color =
        status === "connected"
            ? "bg-green-500"
            : status === "missing_auth"
              ? "bg-yellow-500"
              : "bg-gray-400";
    return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function DiagStatusIcon({ status }: { status: string }) {
    if (status === "pass") return <CheckCircle2Icon className="h-3.5 w-3.5 text-green-500" />;
    if (status === "fail") return <XCircleIcon className="h-3.5 w-3.5 text-red-500" />;
    return <MinusCircleIcon className="text-muted-foreground h-3.5 w-3.5" />;
}

function HealthIndicator({ status }: { status: string | null | undefined }) {
    if (!status) return null;
    const config =
        status === "healthy"
            ? { color: "bg-green-500", label: "Healthy" }
            : status === "no-tools"
              ? { color: "bg-yellow-500", label: "No tools" }
              : status === "unhealthy"
                ? { color: "bg-red-500", label: "Unhealthy" }
                : { color: "bg-gray-400", label: status };
    return (
        <span className="inline-flex items-center gap-1 text-[10px]">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.color}`} />
            <span className="text-muted-foreground">{config.label}</span>
        </span>
    );
}

/* ================================================================== */
/*  Connected Platform Card                                            */
/* ================================================================== */

function ConnectedPlatformCard({
    provider,
    diagnostics
}: {
    provider: IntegrationProvider;
    diagnostics?: DiagnosticsResult["integrations"][string] | null;
}) {
    const activeConns = provider.connections.filter((c) => c.isActive);
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <StatusDot status={provider.status} />
                            <CardTitle className="text-base">{provider.name}</CardTitle>
                        </div>
                        <CardDescription className="mt-1 line-clamp-2 text-xs">
                            {provider.description}
                        </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <CategoryBadge category={provider.category} />
                        <AuthBadge authType={provider.authType} />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Connections */}
                {activeConns.length > 0 && (
                    <div className="space-y-1">
                        {activeConns.map((conn) => (
                            <div key={conn.id} className="flex items-center gap-2 text-xs">
                                <span className="font-medium">{conn.name}</span>
                                <span className="text-muted-foreground">
                                    {conn.scope}
                                    {conn.isDefault ? " · default" : ""}
                                </span>
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] ${conn.connected ? "text-green-600" : "text-gray-500"}`}
                                >
                                    {conn.connected ? "Ready" : "Needs auth"}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}

                {/* Health status */}
                {provider.healthStatus && <HealthIndicator status={provider.healthStatus} />}

                {/* Provisioned resources */}
                {provider.provisioned && (
                    <>
                        <Separator />
                        <div className="space-y-1.5">
                            {provider.provisioned.skill && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <SparklesIcon className="h-3 w-3 text-blue-500" />
                                    <span className="font-medium">
                                        {provider.provisioned.skill.name}
                                    </span>
                                    <span className="text-muted-foreground">
                                        <WrenchIcon className="inline h-2.5 w-2.5" />{" "}
                                        {provider.provisioned.skill.toolCount} tools
                                    </span>
                                    {provider.provisioned.skill.deactivated && (
                                        <Badge
                                            variant="outline"
                                            className="text-[9px] text-orange-500"
                                        >
                                            Inactive
                                        </Badge>
                                    )}
                                </div>
                            )}
                            {provider.provisioned.agent && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <BotIcon className="h-3 w-3 text-purple-500" />
                                    <span className="font-medium">
                                        {provider.provisioned.agent.name}
                                    </span>
                                    {!provider.provisioned.agent.isActive && (
                                        <Badge
                                            variant="outline"
                                            className="text-[9px] text-orange-500"
                                        >
                                            Inactive
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Channel diagnostics (if available) */}
                {diagnostics && diagnostics.checks.length > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-1">
                            {diagnostics.checks.slice(0, 3).map((check, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs">
                                    <DiagStatusIcon status={check.status} />
                                    <span className="font-medium">{check.name}</span>
                                    {check.durationMs > 0 && (
                                        <span className="text-muted-foreground">
                                            {check.durationMs}ms
                                        </span>
                                    )}
                                </div>
                            ))}
                            {diagnostics.checks.length > 3 && (
                                <p className="text-muted-foreground text-[10px]">
                                    +{diagnostics.checks.length - 3} more checks
                                </p>
                            )}
                        </div>
                    </>
                )}

                <div className="flex items-center gap-2 pt-1">
                    <Link
                        href={`/mcp/providers/${provider.key}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Manage
                    </Link>
                    {provider.provisioned?.agent?.isActive && (
                        <Link
                            href={`/agents/${provider.provisioned.agent.slug}/overview`}
                            className={buttonVariants({ variant: "default", size: "sm" })}
                        >
                            <MessageSquareIcon className="mr-1 h-3 w-3" />
                            Chat
                        </Link>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/* ================================================================== */
/*  Available Platform Card                                            */
/* ================================================================== */

function AvailablePlatformCard({ provider }: { provider: IntegrationProvider }) {
    const hasHostedUrl = Boolean((provider.config as Record<string, unknown>)?.hostedMcpUrl);

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{provider.name}</CardTitle>
                            {hasHostedUrl && (
                                <Badge variant="secondary" className="text-[10px]">
                                    Hosted MCP
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="mt-1 line-clamp-2 text-xs">
                            {provider.description}
                        </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <CategoryBadge category={provider.category} />
                        <AuthBadge authType={provider.authType} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Link
                    href={`/mcp/providers/${provider.key}`}
                    className={buttonVariants({ variant: "default", size: "sm" })}
                >
                    <PlugIcon className="mr-1.5 h-3.5 w-3.5" />
                    Connect
                </Link>
            </CardContent>
        </Card>
    );
}

/* ================================================================== */
/*  Main PlatformsTab component                                        */
/* ================================================================== */

// Channel key -> provider key mapping for diagnostics
const CHANNEL_PROVIDER_MAP: Record<string, string> = {
    twilio: "twilio-voice",
    elevenlabs: "elevenlabs",
    telegram: "telegram-bot",
    whatsapp: "whatsapp-web"
};

export function PlatformsTab({ providers }: { providers: IntegrationProvider[] }) {
    const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
    const [diagLoading, setDiagLoading] = useState(true);

    const apiBase = getApiBase();

    // Fetch channel diagnostics
    const fetchDiagnostics = useCallback(async () => {
        setDiagLoading(true);
        try {
            const res = await fetch(`${apiBase}/api/channels/diagnostics`);
            if (res.ok) {
                const data = await res.json();
                setDiagnostics(data);
            }
        } catch {
            /* noop */
        } finally {
            setDiagLoading(false);
        }
    }, [apiBase]);

    useEffect(() => {
        fetchDiagnostics();
    }, [fetchDiagnostics]);

    // Split providers into connected vs available
    // "Platform" providers = oauth + mcp (non-ai-model, non-webhook)
    // Also include channel providers that exist
    const platformProviders = providers.filter(
        (p) => p.providerType !== "ai-model" && p.providerType !== "webhook"
    );

    const connectedProviders = platformProviders.filter(
        (p) =>
            p.status === "connected" ||
            p.status === "missing_auth" ||
            p.connections.some((c) => c.isActive)
    );

    const availableProviders = platformProviders.filter(
        (p) => p.status === "disconnected" && !p.connections.some((c) => c.isActive)
    );

    // Get diagnostics for a provider by matching channel key
    const getDiagnostics = (providerKey: string) => {
        if (!diagnostics?.integrations) return null;
        const channelKey = Object.entries(CHANNEL_PROVIDER_MAP).find(
            ([, pk]) => pk === providerKey
        )?.[0];
        if (!channelKey) return null;
        return diagnostics.integrations[channelKey] || null;
    };

    // Group available providers by category
    const groupedAvailable = availableProviders.reduce(
        (acc, p) => {
            const cat = p.category || "other";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
        },
        {} as Record<string, IntegrationProvider[]>
    );

    const categoryOrder = [
        "productivity",
        "communication",
        "crm",
        "knowledge",
        "data",
        "payments",
        "ecommerce",
        "support",
        "design",
        "web",
        "automation"
    ];

    const sortedCategories = Object.keys(groupedAvailable).sort((a, b) => {
        const ai = categoryOrder.indexOf(a);
        const bi = categoryOrder.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    return (
        <div className="space-y-6">
            {/* ── Connected Platforms ─────────────────────────────── */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold tracking-tight">
                            Connected Platforms
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            Active integrations with your workspace
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchDiagnostics}
                        disabled={diagLoading}
                    >
                        <RefreshCwIcon
                            className={`mr-1.5 h-3.5 w-3.5 ${diagLoading ? "animate-spin" : ""}`}
                        />
                        Refresh
                    </Button>
                </div>

                {connectedProviders.length === 0 ? (
                    <Card>
                        <CardContent className="text-muted-foreground py-8 text-center text-sm">
                            No platforms connected yet. Browse the available integrations below to
                            get started.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {connectedProviders.map((provider) => (
                            <ConnectedPlatformCard
                                key={provider.id}
                                provider={provider}
                                diagnostics={getDiagnostics(provider.key)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Available Platforms (Marketplace) ───────────────── */}
            {availableProviders.length > 0 && (
                <div>
                    <Separator className="mb-6" />
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold tracking-tight">
                            Available Integrations
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            Connect new platforms to expand your agent capabilities
                        </p>
                    </div>

                    {sortedCategories.map((category) => (
                        <div key={category} className="mb-6">
                            <h4 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
                                {category}
                            </h4>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {groupedAvailable[category]
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((provider) => (
                                        <AvailablePlatformCard
                                            key={provider.id}
                                            provider={provider}
                                        />
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Diagnostics timestamp */}
            {diagnostics && (
                <p className="text-muted-foreground text-center text-xs">
                    Channel diagnostics last checked:{" "}
                    {new Date(diagnostics.timestamp).toLocaleString()}
                </p>
            )}
        </div>
    );
}
