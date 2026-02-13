"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@repo/ui";
import {
    CheckCircleIcon,
    Loader2Icon,
    MailIcon,
    MessageSquareIcon,
    PlugIcon,
    ZapIcon
} from "lucide-react";
import { getApiBase } from "@/lib/utils";

// ─── Integration Definitions ──────────────────────────────────────────────

interface IntegrationDef {
    key: string;
    name: string;
    icon: React.ReactNode;
    description: string;
    tier: number;
    /** If true, uses popup OAuth; otherwise links to /mcp/providers/[key] */
    supportsPopup?: boolean;
}

const INTEGRATIONS: IntegrationDef[] = [
    {
        key: "gmail",
        name: "Gmail",
        icon: <MailIcon className="size-3.5" />,
        description: "Email management, search, and drafts",
        tier: 1
    },
    {
        key: "slack",
        name: "Slack",
        icon: <MessageSquareIcon className="size-3.5" />,
        description: "Notifications and team messaging",
        tier: 2,
        supportsPopup: true
    },
    {
        key: "hubspot",
        name: "HubSpot",
        icon: <PlugIcon className="size-3.5" />,
        description: "CRM, contacts, and deals",
        tier: 3
    },
    {
        key: "jira",
        name: "Jira",
        icon: <PlugIcon className="size-3.5" />,
        description: "Tickets, sprints, and project tracking",
        tier: 4
    },
    {
        key: "fathom",
        name: "Fathom",
        icon: <PlugIcon className="size-3.5" />,
        description: "Meeting recordings and transcripts",
        tier: 5
    }
];

// ─── Power tier label ──────────────────────────────────────────────────────

function getTierLabel(count: number): string {
    if (count === 0) return "No integrations";
    if (count === 1) return "Basic";
    if (count === 2) return "Connected";
    if (count <= 4) return "Powerful";
    return "Full Power";
}

// ─── Component ─────────────────────────────────────────────────────────────

interface ConnectionPowerBarProps {
    /** If true, show in compact mode (just badges) */
    compact?: boolean;
}

export function ConnectionPowerBar({ compact = true }: ConnectionPowerBarProps) {
    const [connectedKeys, setConnectedKeys] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [slackConnecting, setSlackConnecting] = useState(false);

    // Fetch connected integrations from the server
    const fetchConnections = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/integrations/connections`, {
                credentials: "include"
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.connections)) {
                const keys = new Set<string>();
                for (const conn of data.connections) {
                    const key = conn.provider?.key || conn.providerKey;
                    if (conn.isActive && key) {
                        keys.add(key);
                    }
                }
                setConnectedKeys(keys);
            }
        } catch (error) {
            console.error("[ConnectionPowerBar] Failed to fetch connections:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    // Listen for popup OAuth messages (Slack inline connect)
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;

            if (event.data?.type === "slack-oauth-success") {
                setConnectedKeys((prev) => new Set([...prev, "slack"]));
                setSlackConnecting(false);
            } else if (event.data?.type === "slack-oauth-error") {
                setSlackConnecting(false);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    const connectedCount = connectedKeys.size;
    const tierLabel = getTierLabel(connectedCount);

    // Don't render at all while loading, or if all are connected
    if (loading) return null;
    if (connectedCount >= INTEGRATIONS.length) return null;

    const handlePopupConnect = (key: string) => {
        if (key === "slack") {
            setSlackConnecting(true);
            const width = 600;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;

            // We need org + user IDs for Slack OAuth — fetch from session
            const openPopup = async () => {
                try {
                    const sessionRes = await fetch(`${getApiBase()}/api/auth/session`, {
                        credentials: "include"
                    });
                    const session = await sessionRes.json();

                    const statusRes = await fetch(`${getApiBase()}/api/onboarding/status`, {
                        credentials: "include"
                    });
                    const status = await statusRes.json();

                    const orgId = status?.organizationId || "";
                    const userId = session?.user?.id || "";

                    const installUrl = `/agent/api/slack/install?organizationId=${encodeURIComponent(orgId)}&userId=${encodeURIComponent(userId)}&mode=popup`;

                    const popup = window.open(
                        installUrl,
                        "slack-oauth",
                        `width=${width},height=${height},left=${left},top=${top},popup=yes`
                    );

                    if (!popup) {
                        setSlackConnecting(false);
                        // Fallback: navigate to integration page
                        window.location.href = "/mcp/providers/slack";
                        return;
                    }

                    const checkClosed = setInterval(() => {
                        if (popup.closed) {
                            clearInterval(checkClosed);
                            setSlackConnecting(false);
                        }
                    }, 500);
                } catch {
                    setSlackConnecting(false);
                }
            };

            openPopup();
        }
    };

    const handleNavigateConnect = (key: string) => {
        window.location.href = `/mcp/providers/${key}`;
    };

    // ── Compact Mode ──────────────────────────────────────────────────────

    if (compact) {
        const connected = INTEGRATIONS.filter((i) => connectedKeys.has(i.key));
        const nextUnconnected = INTEGRATIONS.find((i) => !connectedKeys.has(i.key));

        return (
            <div className="flex items-center gap-1.5">
                {connected.map((integration) => (
                    <Badge
                        key={integration.key}
                        variant="secondary"
                        className="gap-1 px-1.5 py-0.5 text-[10px]"
                        title={integration.description}
                    >
                        <CheckCircleIcon className="size-2.5 text-green-500" />
                        {integration.name}
                    </Badge>
                ))}

                {nextUnconnected && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 gap-1 px-1.5 text-[10px]"
                        title={`Connect ${nextUnconnected.name} to unlock ${nextUnconnected.description.toLowerCase()}`}
                        disabled={nextUnconnected.key === "slack" && slackConnecting}
                        onClick={() => {
                            if (nextUnconnected.supportsPopup) {
                                handlePopupConnect(nextUnconnected.key);
                            } else {
                                handleNavigateConnect(nextUnconnected.key);
                            }
                        }}
                    >
                        {nextUnconnected.key === "slack" && slackConnecting ? (
                            <Loader2Icon className="size-2.5 animate-spin" />
                        ) : (
                            <ZapIcon className="size-2.5" />
                        )}
                        + {nextUnconnected.name}
                    </Button>
                )}

                {connectedCount < INTEGRATIONS.length - 1 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-5 px-1 text-[10px]"
                        title={`${tierLabel} — connect more to unlock agent capabilities`}
                        onClick={() => {
                            window.location.href = "/mcp";
                        }}
                    >
                        +{INTEGRATIONS.length - connectedCount - 1} more
                    </Button>
                )}
            </div>
        );
    }

    // ── Expanded Mode ─────────────────────────────────────────────────────

    return (
        <div className="space-y-3">
            {/* Progress bar */}
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">
                    Integration Power: {tierLabel}
                </span>
                <span className="text-muted-foreground text-xs">
                    {connectedCount}/{INTEGRATIONS.length}
                </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                    className="bg-primary h-full transition-all duration-500 ease-out"
                    style={{
                        width: `${(connectedCount / INTEGRATIONS.length) * 100}%`
                    }}
                />
            </div>

            {/* Integration list */}
            <div className="space-y-1.5">
                {INTEGRATIONS.map((integration) => {
                    const isConnected = connectedKeys.has(integration.key);
                    const isConnecting = integration.key === "slack" && slackConnecting;

                    return (
                        <div
                            key={integration.key}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                                isConnected
                                    ? "text-foreground bg-green-50/50 dark:bg-green-950/10"
                                    : "text-muted-foreground"
                            }`}
                        >
                            <span className="flex size-5 shrink-0 items-center justify-center">
                                {integration.icon}
                            </span>
                            <span className="flex-1 font-medium">{integration.name}</span>

                            {isConnected ? (
                                <CheckCircleIcon className="size-3.5 text-green-500" />
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-2 text-[10px]"
                                    disabled={isConnecting}
                                    onClick={() => {
                                        if (integration.supportsPopup) {
                                            handlePopupConnect(integration.key);
                                        } else {
                                            handleNavigateConnect(integration.key);
                                        }
                                    }}
                                >
                                    {isConnecting ? (
                                        <Loader2Icon className="mr-1 size-2.5 animate-spin" />
                                    ) : null}
                                    {isConnecting ? "..." : "Connect"}
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
