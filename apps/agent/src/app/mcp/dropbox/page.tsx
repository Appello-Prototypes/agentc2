"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface DropboxStatus {
    connected: boolean;
    connectionId?: string;
    email: string | null;
    accountId: string | null;
    displayName: string | null;
    hasRefreshToken: boolean;
    isExpired: boolean;
    errorMessage: string | null;
    hasCursor: boolean;
}

function DropboxIntegrationClient() {
    const searchParams = useSearchParams();
    const success = searchParams.get("success");
    const errorParam = searchParams.get("error");

    const [status, setStatus] = useState<DropboxStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error] = useState<string | null>(errorParam);

    const loadStatus = async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/integrations/dropbox/status`);
            const data = await res.json();
            if (data.success) {
                setStatus(data);
            }
        } catch (err) {
            console.error("Failed to load Dropbox status:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const handleConnect = () => {
        window.location.href = `${getApiBase()}/api/integrations/dropbox/start`;
    };

    return (
        <div className="container mx-auto space-y-6 py-6">
            <div>
                <h1 className="text-2xl font-semibold">Dropbox Integration</h1>
                <p className="text-muted-foreground text-sm">
                    Connect your Dropbox account to enable file operations for your agents.
                </p>
            </div>

            {success && (
                <Card>
                    <CardContent className="py-4 text-sm text-green-500">
                        Dropbox account connected successfully.
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
                        Manage your Dropbox connection for file access and change notifications.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {loading ? (
                        <div className="text-muted-foreground text-sm">
                            Checking Dropbox status...
                        </div>
                    ) : status?.connected ? (
                        <div className="space-y-2">
                            <div className="text-sm text-green-500">
                                Connected as{" "}
                                {status.email ||
                                    status.displayName ||
                                    status.accountId ||
                                    "Unknown"}
                            </div>
                            {status.errorMessage && (
                                <div className="text-sm text-red-500">{status.errorMessage}</div>
                            )}
                            {status.hasCursor && (
                                <div className="text-muted-foreground text-xs">
                                    Change tracking cursor active. File change triggers are ready.
                                </div>
                            )}
                            {status.isExpired && (
                                <div className="text-muted-foreground text-xs">
                                    Access token expired. It will auto-refresh on next use.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-muted-foreground text-sm">
                            Dropbox is not connected for this organization.
                        </div>
                    )}

                    <Button
                        variant={status?.connected ? "outline" : "default"}
                        onClick={handleConnect}
                    >
                        {status?.connected ? "Reconnect Dropbox" : "Connect Dropbox"}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Available Capabilities</CardTitle>
                    <CardDescription>
                        What your agents can do with Dropbox integration.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                        <li>List files and folders</li>
                        <li>Read/download file contents</li>
                        <li>Upload files</li>
                        <li>Search files by name or content</li>
                        <li>Get and create sharing links</li>
                        <li>
                            Trigger on file changes (requires Dropbox app webhook configuration)
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}

export default function DropboxIntegrationPage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading...</div>}>
            <DropboxIntegrationClient />
        </Suspense>
    );
}
