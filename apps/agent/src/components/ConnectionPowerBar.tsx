"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@repo/ui";
import {
    CheckCircleIcon,
    CircleAlertIcon,
    CircleDashedIcon,
    Loader2Icon,
    SettingsIcon
} from "lucide-react";
import { getApiBase } from "@/lib/utils";

// ─── Types (matches /api/integrations/providers response) ──────────────────

interface ProviderConnection {
    id: string;
    name: string;
    connected: boolean;
    isActive: boolean;
    missingFields: string[];
}

interface ProviderInfo {
    id: string;
    key: string;
    name: string;
    description: string | null;
    category: string;
    authType: string;
    providerType: string;
    status: "connected" | "disconnected" | "missing_auth";
    connections: ProviderConnection[];
}

// ─── Status helpers ────────────────────────────────────────────────────────

function statusIcon(status: ProviderInfo["status"]) {
    switch (status) {
        case "connected":
            return <CheckCircleIcon className="size-2.5 text-green-500" />;
        case "missing_auth":
            return <CircleAlertIcon className="size-2.5 text-amber-500" />;
        default:
            return <CircleDashedIcon className="text-muted-foreground size-2.5" />;
    }
}

function statusLabel(connected: number, total: number): string {
    if (connected === 0) return "No integrations";
    if (connected === total) return "All connected";
    return `${connected}/${total} connected`;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface ConnectionPowerBarProps {
    /** If true, show in compact mode (just badges) */
    compact?: boolean;
}

export function ConnectionPowerBar({ compact = true }: ConnectionPowerBarProps) {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProviders = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/integrations/providers`, {
                credentials: "include"
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.providers)) {
                setProviders(data.providers);
            }
        } catch (error) {
            console.error("[ConnectionPowerBar] Failed to fetch providers:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProviders();
    }, [fetchProviders]);

    if (loading) return null;
    if (providers.length === 0) return null;

    const connected = providers.filter((p) => p.status === "connected");
    const disconnected = providers.filter((p) => p.status !== "connected");

    // Hide bar entirely when everything is connected
    if (disconnected.length === 0 && compact) return null;

    // ── Compact Mode ──────────────────────────────────────────────────────

    if (compact) {
        return (
            <div className="flex items-center gap-1.5">
                {connected.map((provider) => (
                    <Badge
                        key={provider.key}
                        variant="secondary"
                        className="gap-1 px-1.5 py-0.5 text-[10px]"
                        title={`${provider.name} — ${provider.description ?? "Connected"}`}
                    >
                        {statusIcon(provider.status)}
                        {provider.name}
                    </Badge>
                ))}

                {disconnected.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-5 gap-1 px-1.5 text-[10px]"
                        title={`${disconnected.length} integration${disconnected.length === 1 ? "" : "s"} not connected — click to set up`}
                        onClick={() => {
                            window.location.href = "/mcp";
                        }}
                    >
                        <SettingsIcon className="size-2.5" />+{disconnected.length} more
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
                    Integrations: {statusLabel(connected.length, providers.length)}
                </span>
                <span className="text-muted-foreground text-xs">
                    {connected.length}/{providers.length}
                </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                    className="bg-primary h-full transition-all duration-500 ease-out"
                    style={{
                        width: `${(connected.length / providers.length) * 100}%`
                    }}
                />
            </div>

            {/* Integration list */}
            <div className="space-y-1.5">
                {providers.map((provider) => (
                    <div
                        key={provider.key}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                            provider.status === "connected"
                                ? "text-foreground bg-green-50/50 dark:bg-green-950/10"
                                : "text-muted-foreground"
                        }`}
                    >
                        <span className="flex size-5 shrink-0 items-center justify-center">
                            {statusIcon(provider.status)}
                        </span>
                        <span className="flex-1 font-medium">{provider.name}</span>

                        {provider.status === "connected" ? (
                            <CheckCircleIcon className="size-3.5 text-green-500" />
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-2 text-[10px]"
                                onClick={() => {
                                    window.location.href = `/mcp/providers/${provider.key}`;
                                }}
                            >
                                {provider.status === "missing_auth" ? "Fix" : "Connect"}
                            </Button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
