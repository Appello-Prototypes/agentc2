"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface MicrosoftStatus {
    connected: boolean;
    connectionId?: string;
    email: string | null;
    hasRefreshToken: boolean;
    isExpired: boolean;
    errorMessage: string | null;
    mailSubscription: {
        id: string;
        expiresAt: string | null;
        isActive: boolean;
        errorMessage: string | null;
    } | null;
    calendarSubscription: {
        id: string;
        expiresAt: string | null;
        isActive: boolean;
        errorMessage: string | null;
    } | null;
}

function MicrosoftIntegrationClient() {
    const searchParams = useSearchParams();
    const success = searchParams.get("success");
    const errorParam = searchParams.get("error");

    const [status, setStatus] = useState<MicrosoftStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error] = useState<string | null>(errorParam);

    const loadStatus = async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/integrations/microsoft/status`);
            const data = await res.json();
            if (data.success) {
                setStatus(data);
            }
        } catch (err) {
            console.error("Failed to load Microsoft status:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const handleConnect = () => {
        window.location.href = `${getApiBase()}/api/integrations/microsoft/start`;
    };

    return (
        <div className="container mx-auto space-y-6 py-6">
            <div>
                <h1 className="text-2xl font-semibold">Microsoft Integration</h1>
                <p className="text-muted-foreground text-sm">
                    Connect your Microsoft account to enable Outlook Mail and Calendar for your
                    agents.
                </p>
            </div>

            {success && (
                <Card>
                    <CardContent className="py-4 text-sm text-green-500">
                        Microsoft account connected successfully.
                    </CardContent>
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
                        One connection provides both Outlook Mail and Calendar access.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <div className="text-muted-foreground text-sm">
                            Checking Microsoft status...
                        </div>
                    ) : status?.connected ? (
                        <div className="space-y-3">
                            <div className="text-sm text-green-500">
                                Connected as {status.email || "Unknown"}
                            </div>
                            {status.errorMessage && (
                                <div className="text-sm text-red-500">{status.errorMessage}</div>
                            )}
                            {status.isExpired && (
                                <div className="text-muted-foreground text-xs">
                                    Access token expired. It will auto-refresh on next use.
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-lg border p-3">
                                    <div className="text-sm font-medium">Outlook Mail</div>
                                    {status.mailSubscription ? (
                                        <div className="text-muted-foreground text-xs">
                                            Webhook active, expires{" "}
                                            {status.mailSubscription.expiresAt
                                                ? new Date(
                                                      status.mailSubscription.expiresAt
                                                  ).toLocaleString()
                                                : "N/A"}
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground text-xs">
                                            No webhook subscription. Set up a trigger to enable push
                                            notifications.
                                        </div>
                                    )}
                                </div>
                                <div className="rounded-lg border p-3">
                                    <div className="text-sm font-medium">Outlook Calendar</div>
                                    {status.calendarSubscription ? (
                                        <div className="text-muted-foreground text-xs">
                                            Webhook active, expires{" "}
                                            {status.calendarSubscription.expiresAt
                                                ? new Date(
                                                      status.calendarSubscription.expiresAt
                                                  ).toLocaleString()
                                                : "N/A"}
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground text-xs">
                                            No webhook subscription. Set up a trigger to enable push
                                            notifications.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-muted-foreground text-sm">
                            Microsoft is not connected for this organization.
                        </div>
                    )}

                    <Button
                        variant={status?.connected ? "outline" : "default"}
                        onClick={handleConnect}
                    >
                        {status?.connected
                            ? "Reconnect Microsoft Account"
                            : "Connect Microsoft Account"}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Available Capabilities</CardTitle>
                    <CardDescription>
                        What your agents can do with Microsoft integration.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="font-medium">Outlook Mail</div>
                            <ul className="text-muted-foreground mt-1 list-inside list-disc space-y-1 text-xs">
                                <li>List and read inbox emails</li>
                                <li>Send emails</li>
                                <li>Archive emails</li>
                                <li>Trigger on new email (requires webhook subscription)</li>
                            </ul>
                        </div>
                        <div>
                            <div className="font-medium">Outlook Calendar</div>
                            <ul className="text-muted-foreground mt-1 list-inside list-disc space-y-1 text-xs">
                                <li>List upcoming events</li>
                                <li>Read event details</li>
                                <li>Create new events</li>
                                <li>Update existing events</li>
                                <li>Trigger on event changes (requires webhook subscription)</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function MicrosoftIntegrationPage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading...</div>}>
            <MicrosoftIntegrationClient />
        </Suspense>
    );
}
