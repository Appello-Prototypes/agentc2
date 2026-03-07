"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import {
    ArrowLeftIcon,
    CheckCircle2Icon,
    Loader2Icon,
    QrCodeIcon,
    RefreshCwIcon,
    SmartphoneIcon,
    UnplugIcon,
    WifiIcon,
    WifiOffIcon
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type SetupPhase = "disconnected" | "connecting" | "connected" | "error";

type WhatsAppStatus = {
    enabled: boolean;
    status: string;
    connected: boolean;
    hasQR?: boolean;
    sessions?: { total: number };
};

type QRResponse = {
    success: boolean;
    connected: boolean;
    qr: string | null;
    qrType?: string;
    message?: string;
    error?: string;
};

type AgentOption = {
    slug: string;
    name: string;
    description?: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function WhatsAppSetup() {
    const base = getApiBase();
    const [phase, setPhase] = useState<SetupPhase>("disconnected");
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [defaultAgentSlug, setDefaultAgentSlug] = useState("");
    const [allowlist, setAllowlist] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    /* ----- Check initial status ----- */
    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch(`${base}/api/channels/whatsapp/status`);
            if (!res.ok) {
                setPhase("disconnected");
                setLoading(false);
                return;
            }
            const data: WhatsAppStatus = await res.json();

            if (data.connected) {
                setPhase("connected");
                stopPolling();
            } else if (data.status === "connecting" || data.hasQR) {
                setPhase("connecting");
            } else {
                setPhase("disconnected");
            }
        } catch {
            setPhase("disconnected");
        } finally {
            setLoading(false);
        }
    }, [base]);

    /* ----- Fetch QR code ----- */
    const fetchQR = useCallback(async () => {
        try {
            const res = await fetch(`${base}/api/channels/whatsapp/qr`);
            if (!res.ok) return;
            const data: QRResponse = await res.json();

            if (data.connected) {
                setPhase("connected");
                setQrDataUrl(null);
                stopPolling();
                return;
            }

            if (data.qr) {
                setQrDataUrl(data.qr);
            }
        } catch {
            // Will retry on next poll
        }
    }, [base]);

    /* ----- Polling ----- */
    const startPolling = useCallback(() => {
        if (pollRef.current) return;
        pollRef.current = setInterval(async () => {
            const res = await fetch(`${base}/api/channels/whatsapp/status`).catch(() => null);
            if (!res?.ok) return;
            const data: WhatsAppStatus = await res.json();
            if (data.connected) {
                setPhase("connected");
                setQrDataUrl(null);
                stopPolling();
            } else {
                await fetchQR();
            }
        }, 3000);
    }, [base, fetchQR]);

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    useEffect(() => {
        checkStatus();
        return () => stopPolling();
    }, [checkStatus]);

    /* ----- Fetch agents list ----- */
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${base}/api/agents`);
                if (!res.ok) return;
                const data = await res.json();
                const list = (data.agents || data || []) as AgentOption[];
                setAgents(list.filter((a) => a.slug && a.name));
            } catch {
                // Non-critical
            }
        })();
    }, [base]);

    /* ----- Fetch current connection config ----- */
    useEffect(() => {
        if (phase !== "connected") return;
        (async () => {
            try {
                const res = await fetch(
                    `${base}/api/integrations/connections?providerKey=whatsapp-web`
                );
                if (!res.ok) return;
                const data = await res.json();
                const conn = (data.connections || [])[0];
                if (conn?.credentials) {
                    setDefaultAgentSlug(conn.credentials.WHATSAPP_DEFAULT_AGENT_SLUG || "");
                    setAllowlist(conn.credentials.WHATSAPP_ALLOWLIST || "");
                }
            } catch {
                // Non-critical
            }
        })();
    }, [base, phase]);

    /* ----- Connect action ----- */
    const handleConnect = async () => {
        setPhase("connecting");
        setErrorMessage(null);

        try {
            // Ensure IntegrationConnection exists
            await fetch(`${base}/api/integrations/connections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    providerKey: "whatsapp-web",
                    name: "WhatsApp Web",
                    scope: "org",
                    isDefault: true,
                    credentials: { WHATSAPP_ENABLED: "true" },
                    metadata: { status: "connecting" }
                })
            });

            // Trigger connect
            await fetch(`${base}/api/channels/whatsapp/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "connect" })
            });

            // Fetch initial QR
            await fetchQR();

            // Start polling for connection
            startPolling();
        } catch (err) {
            setPhase("error");
            setErrorMessage(err instanceof Error ? err.message : "Failed to connect");
        }
    };

    /* ----- Disconnect action ----- */
    const handleDisconnect = async () => {
        try {
            await fetch(`${base}/api/channels/whatsapp/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "disconnect" })
            });
            setPhase("disconnected");
            setQrDataUrl(null);
        } catch {
            // Best effort
        }
    };

    /* ----- Save config ----- */
    const handleSaveConfig = async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            const res = await fetch(
                `${base}/api/integrations/connections?providerKey=whatsapp-web`
            );
            const data = await res.json();
            const conn = (data.connections || [])[0];

            if (conn) {
                await fetch(`${base}/api/integrations/connections/${conn.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        credentials: {
                            WHATSAPP_ENABLED: "true",
                            WHATSAPP_DEFAULT_AGENT_SLUG: defaultAgentSlug || undefined,
                            WHATSAPP_ALLOWLIST: allowlist || undefined
                        }
                    })
                });
            } else {
                await fetch(`${base}/api/integrations/connections`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        providerKey: "whatsapp-web",
                        name: "WhatsApp Web",
                        scope: "org",
                        isDefault: true,
                        credentials: {
                            WHATSAPP_ENABLED: "true",
                            WHATSAPP_DEFAULT_AGENT_SLUG: defaultAgentSlug || undefined,
                            WHATSAPP_ALLOWLIST: allowlist || undefined
                        }
                    })
                });
            }
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch {
            // Best effort
        } finally {
            setSaving(false);
        }
    };

    /* ----- Loading state ----- */
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6 py-8">
            {/* Header */}
            <div className="space-y-2">
                <Link
                    href="/mcp"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                >
                    <ArrowLeftIcon className="h-3.5 w-3.5" />
                    Back to Integrations
                </Link>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                        <SmartphoneIcon className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold">WhatsApp</h1>
                        <p className="text-muted-foreground text-sm">
                            Connect WhatsApp to chat with your agents
                        </p>
                    </div>
                    <div className="ml-auto">
                        {phase === "connected" ? (
                            <Badge variant="outline" className="border-green-500/30 text-green-500">
                                <WifiIcon className="mr-1 h-3 w-3" />
                                Connected
                            </Badge>
                        ) : phase === "connecting" ? (
                            <Badge
                                variant="outline"
                                className="border-yellow-500/30 text-yellow-500"
                            >
                                <Loader2Icon className="mr-1 h-3 w-3 animate-spin" />
                                Connecting
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="border-muted-foreground/30 text-muted-foreground"
                            >
                                <WifiOffIcon className="mr-1 h-3 w-3" />
                                Disconnected
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* ----- Disconnected: Show connect button ----- */}
            {phase === "disconnected" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Connect WhatsApp</CardTitle>
                        <CardDescription>
                            Link a WhatsApp account to let users chat with your agents. You&apos;ll
                            scan a QR code from your phone to pair.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted/50 space-y-3 rounded-lg p-4">
                            <h4 className="text-sm font-medium">How it works</h4>
                            <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
                                <li>Click &quot;Connect&quot; below to generate a QR code</li>
                                <li>Open WhatsApp on your phone</li>
                                <li>
                                    Go to{" "}
                                    <strong>Settings &gt; Linked Devices &gt; Link a Device</strong>
                                </li>
                                <li>Scan the QR code</li>
                                <li>Start chatting with your agents</li>
                            </ol>
                        </div>
                        <Button onClick={handleConnect} size="lg" className="w-full">
                            <QrCodeIcon className="mr-2 h-4 w-4" />
                            Connect WhatsApp
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ----- Error: Show retry ----- */}
            {phase === "error" && (
                <Card className="border-destructive/30">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="bg-destructive/10 flex h-12 w-12 items-center justify-center rounded-full">
                                <WifiOffIcon className="text-destructive h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-medium">Connection Failed</h3>
                                <p className="text-muted-foreground mt-1 text-sm">
                                    {errorMessage || "Something went wrong. Please try again."}
                                </p>
                            </div>
                            <Button onClick={handleConnect} variant="outline">
                                <RefreshCwIcon className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ----- Connecting: Show QR code ----- */}
            {phase === "connecting" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Scan QR Code</CardTitle>
                        <CardDescription>
                            Open WhatsApp on your phone, go to Settings &gt; Linked Devices &gt;
                            Link a Device, then scan this code.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center gap-6">
                            {qrDataUrl ? (
                                <div className="rounded-xl border bg-white p-4">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL from QR generator */}
                                    <img
                                        src={qrDataUrl}
                                        alt="WhatsApp QR Code"
                                        width={300}
                                        height={300}
                                        className="h-[300px] w-[300px]"
                                    />
                                </div>
                            ) : (
                                <div className="flex h-[332px] w-[332px] flex-col items-center justify-center gap-3 rounded-xl border">
                                    <Loader2Icon className="text-muted-foreground h-8 w-8 animate-spin" />
                                    <p className="text-muted-foreground text-sm">
                                        Generating QR code...
                                    </p>
                                </div>
                            )}
                            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                                Waiting for you to scan...
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setPhase("disconnected");
                                    stopPolling();
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ----- Connected: Show success + config ----- */}
            {phase === "connected" && (
                <>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                                    <CheckCircle2Icon className="h-6 w-6 text-green-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium">WhatsApp Connected</h3>
                                    <p className="text-muted-foreground text-sm">
                                        Your WhatsApp account is linked and ready to receive
                                        messages.
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                                    <UnplugIcon className="mr-2 h-3.5 w-3.5" />
                                    Disconnect
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>
                                Configure which agent handles WhatsApp messages by default and who
                                can message it.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Default Agent</Label>
                                <Select
                                    value={defaultAgentSlug}
                                    onValueChange={(v) => {
                                        if (v) setDefaultAgentSlug(v);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an agent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agents.map((a) => (
                                            <SelectItem key={a.slug} value={a.slug}>
                                                {a.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-muted-foreground text-xs">
                                    Messages without an explicit agent prefix will be handled by
                                    this agent.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Phone Number Allowlist</Label>
                                <Input
                                    value={allowlist}
                                    onChange={(e) => setAllowlist(e.target.value)}
                                    placeholder="+15551234567, +15559876543"
                                />
                                <p className="text-muted-foreground text-xs">
                                    Comma-separated phone numbers allowed to message the bot. Leave
                                    empty to allow all.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button onClick={handleSaveConfig} disabled={saving}>
                                    {saving && (
                                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Save Configuration
                                </Button>
                                {saveSuccess && (
                                    <span className="flex items-center gap-1 text-sm text-green-500">
                                        <CheckCircle2Icon className="h-4 w-4" />
                                        Saved
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Agent Routing Help */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Talking to Different Agents</CardTitle>
                            <CardDescription>
                                Users can switch between agents directly in WhatsApp chat.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted/50 space-y-3 rounded-lg p-4">
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-3">
                                        <code className="bg-background rounded px-2 py-0.5 text-xs">
                                            /agents
                                        </code>
                                        <span className="text-muted-foreground">
                                            List all available agents
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <code className="bg-background rounded px-2 py-0.5 text-xs">
                                            /agent golf-caddie
                                        </code>
                                        <span className="text-muted-foreground">
                                            Switch to a specific agent
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <code className="bg-background rounded px-2 py-0.5 text-xs">
                                            /status
                                        </code>
                                        <span className="text-muted-foreground">
                                            Show which agent is active
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <code className="bg-background rounded px-2 py-0.5 text-xs">
                                            /help
                                        </code>
                                        <span className="text-muted-foreground">
                                            Show all commands
                                        </span>
                                    </div>
                                </div>
                                <p className="text-muted-foreground border-t pt-3 text-xs">
                                    You can also bind specific phone numbers to specific agents via{" "}
                                    <Link href="/settings/instances" className="underline">
                                        Agent Instance Bindings
                                    </Link>
                                    .
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
