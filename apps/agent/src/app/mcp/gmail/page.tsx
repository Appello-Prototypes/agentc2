"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { linkSocial } from "@repo/auth/client";
import {
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
import { getApiBase } from "@/lib/utils";

const REQUIRED_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly"
];

interface AgentOption {
    id: string;
    slug: string;
    name: string;
}

interface GmailIntegration {
    id: string;
    agentId: string;
    gmailAddress: string;
    slackUserId: string;
    historyId: string | null;
    watchExpiration: string | null;
    isActive: boolean;
}

interface GmailStatus {
    connected: boolean;
    gmailAddress: string | null;
    scope: string | null;
    missingScopes: string[];
    hasGoogleAccount: boolean;
    needsReauth: boolean;
}

function GmailIntegrationClient() {
    const searchParams = useSearchParams();
    const gmailError = searchParams.get("gmailError");
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [integrations, setIntegrations] = useState<GmailIntegration[]>([]);
    const [status, setStatus] = useState<GmailStatus | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [form, setForm] = useState({
        agentId: "",
        gmailAddress: "",
        slackUserId: ""
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [reconnectLoading, setReconnectLoading] = useState(false);

    const loadData = async () => {
        const [agentsRes, integrationsRes, statusRes] = await Promise.all([
            fetch(`${getApiBase()}/api/agents`),
            fetch(`${getApiBase()}/api/integrations/gmail`),
            fetch(`${getApiBase()}/api/integrations/gmail/status`)
        ]);
        const agentsData = await agentsRes.json();
        const integrationsData = await integrationsRes.json();
        const statusData = await statusRes.json();
        if (agentsData.success) {
            setAgents(agentsData.agents || []);
        }
        if (integrationsData.success) {
            setIntegrations(integrationsData.integrations || []);
        }
        if (statusData.success) {
            setStatus(statusData);
        }
        setStatusLoading(false);
    };

    useEffect(() => {
        loadData().catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        if (status?.gmailAddress) {
            setForm((prev) => ({ ...prev, gmailAddress: status.gmailAddress || "" }));
        }
    }, [status?.gmailAddress]);

    const handleReconnect = async () => {
        setError(null);
        setReconnectLoading(true);

        try {
            await linkSocial({
                provider: "google",
                scopes: REQUIRED_SCOPES,
                callbackURL: "/mcp/gmail"
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to reconnect Gmail");
            setReconnectLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/integrations/gmail`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || "Failed to save integration");
                return;
            }
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save integration");
        } finally {
            setLoading(false);
        }
    };

    const handleWatch = async (integrationId: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/integrations/gmail/watch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ integrationId })
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || "Failed to start Gmail watch");
                return;
            }
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start Gmail watch");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto space-y-6 py-6">
            <div>
                <h1 className="text-2xl font-semibold">Gmail Integration</h1>
                <p className="text-muted-foreground text-sm">
                    Gmail access is granted during Google sign-in. Manage connection status and
                    agent triggers here.
                </p>
            </div>

            {gmailError && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{gmailError}</CardContent>
                </Card>
            )}

            {error && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Connection Status</CardTitle>
                    <CardDescription>
                        Gmail permissions are required for email triggers and sending.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {statusLoading ? (
                        <div className="text-muted-foreground text-sm">
                            Checking Gmail status...
                        </div>
                    ) : status?.connected ? (
                        <div className="text-sm text-green-500">
                            Connected as {status.gmailAddress}
                        </div>
                    ) : (
                        <div className="text-muted-foreground text-sm">
                            Gmail is not connected for this organization.
                        </div>
                    )}
                    {status && status.needsReauth && (
                        <div className="text-muted-foreground text-xs">
                            Missing Gmail permissions: {status.missingScopes.join(", ")}
                        </div>
                    )}
                    <Button variant="outline" onClick={handleReconnect} disabled={reconnectLoading}>
                        {reconnectLoading ? "Reconnecting..." : "Reconnect Gmail"}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Create Integration</CardTitle>
                    <CardDescription>
                        Configure which agent and Slack user to notify.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="agent-select">Agent</Label>
                        <Select
                            value={form.agentId}
                            onValueChange={(value) =>
                                setForm((prev) => ({ ...prev, agentId: value || "" }))
                            }
                        >
                            <SelectTrigger id="agent-select">
                                <SelectValue placeholder="Select an agent" />
                            </SelectTrigger>
                            <SelectContent>
                                {agents.map((agent) => (
                                    <SelectItem key={agent.id} value={agent.slug}>
                                        {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gmail-address">Gmail Address</Label>
                        <Input
                            id="gmail-address"
                            value={form.gmailAddress}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, gmailAddress: event.target.value }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="slack-user-id">Slack User ID</Label>
                        <Input
                            id="slack-user-id"
                            value={form.slackUserId}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, slackUserId: event.target.value }))
                            }
                        />
                    </div>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? "Saving..." : "Save Integration"}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Integrations</CardTitle>
                    <CardDescription>Manage existing Gmail integrations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {integrations.length === 0 && (
                        <div className="text-muted-foreground text-sm">
                            No Gmail integrations configured yet.
                        </div>
                    )}
                    {integrations.map((integration) => (
                        <div
                            key={integration.id}
                            className="flex items-center justify-between gap-4"
                        >
                            <div>
                                <div className="font-medium">{integration.gmailAddress}</div>
                                <div className="text-muted-foreground text-xs">
                                    Slack user: {integration.slackUserId}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                    Watch expires:{" "}
                                    {integration.watchExpiration
                                        ? new Date(integration.watchExpiration).toLocaleString()
                                        : "Not started"}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => handleWatch(integration.id)}
                                disabled={loading}
                            >
                                Refresh Watch
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

export default function GmailIntegrationPage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading...</div>}>
            <GmailIntegrationClient />
        </Suspense>
    );
}
