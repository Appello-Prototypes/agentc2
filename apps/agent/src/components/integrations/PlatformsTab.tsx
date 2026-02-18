"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
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
    SearchIcon,
    SparklesIcon,
    WrenchIcon,
    XCircleIcon,
    XIcon
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
    maturityLevel?: string;
    status: ProviderStatus;
    connections: ConnectionSummary[];
    toolCount?: number | null;
    toolDiscovery?: "dynamic" | "static" | null;
    hasBlueprint?: boolean;
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

type StatusFilter = "all" | "connected" | "available";

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

const CATEGORY_META: Record<string, { color: string; label: string }> = {
    productivity: {
        color: "bg-green-500/10 text-green-600 border-green-500/30",
        label: "Productivity"
    },
    communication: {
        color: "bg-pink-500/10 text-pink-600 border-pink-500/30",
        label: "Communication"
    },
    crm: { color: "bg-orange-500/10 text-orange-600 border-orange-500/30", label: "CRM" },
    knowledge: { color: "bg-blue-500/10 text-blue-600 border-blue-500/30", label: "Knowledge" },
    data: { color: "bg-amber-500/10 text-amber-600 border-amber-500/30", label: "Data" },
    payments: { color: "bg-teal-500/10 text-teal-600 border-teal-500/30", label: "Payments" },
    ecommerce: { color: "bg-lime-500/10 text-lime-600 border-lime-500/30", label: "E-Commerce" },
    support: { color: "bg-rose-500/10 text-rose-600 border-rose-500/30", label: "Support" },
    design: { color: "bg-violet-500/10 text-violet-600 border-violet-500/30", label: "Design" },
    web: { color: "bg-purple-500/10 text-purple-600 border-purple-500/30", label: "Web" },
    automation: { color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30", label: "Automation" },
    ai: { color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30", label: "AI" }
};

const CATEGORY_ORDER = [
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

function CategoryBadge({ category }: { category: string }) {
    const meta = CATEGORY_META[category];
    return (
        <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${meta?.color || "bg-gray-500/10 text-gray-600"}`}
        >
            {meta?.label || category}
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

function ToolCountBadge({
    toolCount,
    toolDiscovery
}: {
    toolCount?: number | null;
    toolDiscovery?: "dynamic" | "static" | null;
}) {
    if (toolDiscovery === "dynamic" && (toolCount === null || toolCount === undefined)) {
        return (
            <Badge variant="secondary" className="text-[10px]">
                MCP
            </Badge>
        );
    }
    if (typeof toolCount === "number" && toolCount > 0) {
        return (
            <Badge variant="secondary" className="text-[10px]">
                {toolCount} tools
            </Badge>
        );
    }
    if (toolDiscovery === "static" && typeof toolCount === "number") {
        return (
            <Badge variant="secondary" className="text-[10px]">
                {toolCount} tools
            </Badge>
        );
    }
    return null;
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

function isProviderConnected(p: IntegrationProvider) {
    return (
        p.status === "connected" ||
        p.status === "missing_auth" ||
        p.connections.some((c) => c.isActive)
    );
}

/* ================================================================== */
/*  Connected Platform Card                                            */
/* ================================================================== */

function ConnectedPlatformCard({
    provider,
    diagnostics,
    onRefreshTools
}: {
    provider: IntegrationProvider;
    diagnostics?: DiagnosticsResult["integrations"][string] | null;
    onRefreshTools?: (providerKey: string) => void;
}) {
    const activeConns = provider.connections.filter((c) => c.isActive);
    const showRefresh =
        provider.toolDiscovery === "dynamic" &&
        provider.provisioned?.skill &&
        provider.provisioned.skill.toolCount === 0;

    const borderClass =
        provider.healthStatus === "unhealthy"
            ? "border-red-500/40"
            : provider.status === "missing_auth"
              ? "border-yellow-500/40"
              : "";

    return (
        <Card className={borderClass}>
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
                        <ToolCountBadge
                            toolCount={provider.provisioned?.skill?.toolCount ?? provider.toolCount}
                            toolDiscovery={provider.toolDiscovery}
                        />
                        <CategoryBadge category={provider.category} />
                        <AuthBadge authType={provider.authType} />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
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

                {provider.healthStatus && <HealthIndicator status={provider.healthStatus} />}

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
                                        {provider.provisioned.skill.toolCount > 0
                                            ? `${provider.provisioned.skill.toolCount} tools`
                                            : provider.toolDiscovery === "dynamic"
                                              ? "MCP tools"
                                              : "0 tools"}
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
                    {showRefresh && onRefreshTools && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRefreshTools(provider.key)}
                        >
                            <RefreshCwIcon className="mr-1 h-3 w-3" />
                            Refresh Tools
                        </Button>
                    )}
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
                        <ToolCountBadge
                            toolCount={provider.toolCount}
                            toolDiscovery={provider.toolDiscovery}
                        />
                        <CategoryBadge category={provider.category} />
                        <AuthBadge authType={provider.authType} />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {provider.hasBlueprint && (
                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                            <SparklesIcon className="h-2.5 w-2.5" />
                            Skill
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                            <BotIcon className="h-2.5 w-2.5" />
                            Agent
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                            auto-provisioned on connect
                        </span>
                    </div>
                )}
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

const CHANNEL_PROVIDER_MAP: Record<string, string> = {
    twilio: "twilio-voice",
    elevenlabs: "elevenlabs",
    telegram: "telegram-bot",
    whatsapp: "whatsapp-web"
};

export function PlatformsTab({ providers }: { providers: IntegrationProvider[] }) {
    const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
    const [diagLoading, setDiagLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const apiBase = getApiBase();

    const handleRefreshTools = useCallback(
        async (providerKey: string) => {
            try {
                await fetch(`${apiBase}/api/integrations/providers/${providerKey}/tools`, {
                    method: "POST"
                });
                window.location.reload();
            } catch {
                /* noop */
            }
        },
        [apiBase]
    );

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

    const platformProviders = useMemo(
        () =>
            providers.filter(
                (p) =>
                    p.providerType !== "ai-model" &&
                    p.providerType !== "webhook" &&
                    p.maturityLevel !== "internal"
            ),
        [providers]
    );

    const connectedCount = useMemo(
        () => platformProviders.filter(isProviderConnected).length,
        [platformProviders]
    );
    const availableCount = useMemo(
        () => platformProviders.filter((p) => !isProviderConnected(p)).length,
        [platformProviders]
    );

    const categoriesWithCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const p of platformProviders) {
            const cat = p.category || "other";
            counts[cat] = (counts[cat] || 0) + 1;
        }
        const sorted = Object.entries(counts).sort(([a], [b]) => {
            const ai = CATEGORY_ORDER.indexOf(a);
            const bi = CATEGORY_ORDER.indexOf(b);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        return sorted;
    }, [platformProviders]);

    const filteredProviders = useMemo(() => {
        let list = platformProviders;

        if (statusFilter === "connected") {
            list = list.filter(isProviderConnected);
        } else if (statusFilter === "available") {
            list = list.filter((p) => !isProviderConnected(p));
        }

        if (activeCategory) {
            list = list.filter((p) => (p.category || "other") === activeCategory);
        }

        if (search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    (p.description && p.description.toLowerCase().includes(q)) ||
                    p.category.toLowerCase().includes(q) ||
                    p.key.toLowerCase().includes(q)
            );
        }

        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [platformProviders, statusFilter, activeCategory, search]);

    const getDiagnostics = useCallback(
        (providerKey: string) => {
            if (!diagnostics?.integrations) return null;
            const channelKey = Object.entries(CHANNEL_PROVIDER_MAP).find(
                ([, pk]) => pk === providerKey
            )?.[0];
            if (!channelKey) return null;
            return diagnostics.integrations[channelKey] || null;
        },
        [diagnostics]
    );

    const hasActiveFilters = search.trim() || statusFilter !== "all" || activeCategory !== null;

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("all");
        setActiveCategory(null);
    };

    // Keyboard shortcut: "/" to focus search
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (
                e.key === "/" &&
                !e.metaKey &&
                !e.ctrlKey &&
                document.activeElement?.tagName !== "INPUT" &&
                document.activeElement?.tagName !== "TEXTAREA"
            ) {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    return (
        <div className="space-y-4">
            {/* ── Toolbar: Search + Status + Refresh ─────────────── */}
            <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-10 space-y-3 pb-2 backdrop-blur">
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative max-w-sm flex-1">
                        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input
                            ref={searchRef}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search integrations..."
                            className="pr-8 pl-9"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 transition-colors"
                            >
                                <XIcon className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Status filter pills */}
                    <div className="flex items-center gap-1 rounded-lg border p-1">
                        <button
                            onClick={() => setStatusFilter("all")}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                statusFilter === "all"
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                        >
                            All
                            <span className="ml-1 opacity-70">{platformProviders.length}</span>
                        </button>
                        <button
                            onClick={() => setStatusFilter("connected")}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                statusFilter === "connected"
                                    ? "bg-green-500/15 text-green-700 dark:text-green-400"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                        >
                            Connected
                            <span className="ml-1 opacity-70">{connectedCount}</span>
                        </button>
                        <button
                            onClick={() => setStatusFilter("available")}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                statusFilter === "available"
                                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                        >
                            Available
                            <span className="ml-1 opacity-70">{availableCount}</span>
                        </button>
                    </div>

                    {/* Refresh */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchDiagnostics}
                        disabled={diagLoading}
                        className="ml-auto shrink-0"
                    >
                        <RefreshCwIcon
                            className={`mr-1.5 h-3.5 w-3.5 ${diagLoading ? "animate-spin" : ""}`}
                        />
                        Refresh
                    </Button>
                </div>

                {/* ── Category filter pills ──────────────────────── */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {categoriesWithCounts.map(([cat, count]) => {
                        const meta = CATEGORY_META[cat];
                        const isActive = activeCategory === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(isActive ? null : cat)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                                    isActive
                                        ? `${meta?.color || "bg-gray-500/10 text-gray-600"} border-current ring-1 ring-current/20`
                                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                                }`}
                            >
                                {meta?.label || cat}
                                <span className="opacity-60">{count}</span>
                            </button>
                        );
                    })}
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-muted-foreground hover:text-foreground ml-1 inline-flex items-center gap-1 text-xs underline transition-colors"
                        >
                            <XIcon className="h-3 w-3" />
                            Clear filters
                        </button>
                    )}
                </div>

                {/* ── Result summary ─────────────────────────────── */}
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>
                        {filteredProviders.length} integration
                        {filteredProviders.length !== 1 ? "s" : ""}
                    </span>
                    {hasActiveFilters && (
                        <span>(filtered from {platformProviders.length} total)</span>
                    )}
                    <span className="text-muted-foreground/50 ml-auto text-[10px]">
                        Press{" "}
                        <kbd className="bg-muted rounded border px-1 py-0.5 font-mono text-[10px]">
                            /
                        </kbd>{" "}
                        to search
                    </span>
                </div>
            </div>

            {/* ── Results grid ───────────────────────────────────── */}
            {filteredProviders.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <SearchIcon className="text-muted-foreground h-8 w-8" />
                        <div>
                            <p className="text-sm font-medium">No integrations found</p>
                            <p className="text-muted-foreground mt-1 text-xs">
                                {search.trim()
                                    ? `No results for "${search}". Try a different search term.`
                                    : "Try adjusting your filters."}
                            </p>
                        </div>
                        {hasActiveFilters && (
                            <Button variant="outline" size="sm" onClick={clearFilters}>
                                Clear all filters
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredProviders.map((provider) =>
                        isProviderConnected(provider) ? (
                            <ConnectedPlatformCard
                                key={provider.id}
                                provider={provider}
                                diagnostics={getDiagnostics(provider.key)}
                                onRefreshTools={handleRefreshTools}
                            />
                        ) : (
                            <AvailablePlatformCard key={provider.id} provider={provider} />
                        )
                    )}
                </div>
            )}

            {/* ── Diagnostics timestamp ──────────────────────────── */}
            {diagnostics && (
                <p className="text-muted-foreground text-center text-xs">
                    Channel diagnostics last checked:{" "}
                    {new Date(diagnostics.timestamp).toLocaleString()}
                </p>
            )}
        </div>
    );
}
