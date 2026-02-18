"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Skeleton,
    Alert,
    AlertDescription
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { ConnectionRequestDialog } from "@/components/federation/ConnectionRequestDialog";

interface ConnectionSummary {
    id: string;
    partnerOrg: { id: string; name: string; slug: string; logoUrl: string | null };
    status: string;
    direction: "initiated" | "received";
    exposedAgentCount: number;
    partnerExposedAgentCount: number;
    createdAt: string;
    approvedAt: string | null;
}

export default function ConnectionsPage() {
    const [connections, setConnections] = useState<ConnectionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const fetchConnections = async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/federation/connections`);
            const data = await res.json();
            if (data.success) {
                setConnections(data.connections);
            } else {
                setError(data.error || "Failed to load connections");
            }
        } catch {
            setError("Failed to load connections");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnections();
    }, []);

    const pending = connections.filter((c) => c.status === "pending" && c.direction === "received");
    const outgoing = connections.filter(
        (c) => c.status === "pending" && c.direction === "initiated"
    );
    const active = connections.filter((c) => c.status === "active");
    const suspended = connections.filter((c) => c.status === "suspended");

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Connected Organizations</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Connect with other organizations to let your agents collaborate across
                        boundaries.
                    </p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>Connect an Organization</Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-40" />
                    ))}
                </div>
            ) : (
                <>
                    {/* Pending Incoming Requests */}
                    {pending.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium">
                                Pending Requests ({pending.length})
                            </h3>
                            <div className="grid gap-3">
                                {pending.map((conn) => (
                                    <Card
                                        key={conn.id}
                                        className="border-yellow-300 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20"
                                    >
                                        <CardContent className="flex items-center justify-between py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-muted flex size-10 items-center justify-center rounded-full text-sm font-medium">
                                                    {conn.partnerOrg.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium">
                                                        {conn.partnerOrg.name}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        Wants to connect &middot;{" "}
                                                        {new Date(
                                                            conn.createdAt
                                                        ).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <Link href={`/settings/connections/${conn.id}/approve`}>
                                                <Button size="sm">Review</Button>
                                            </Link>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Outgoing Pending */}
                    {outgoing.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium">
                                Awaiting Response ({outgoing.length})
                            </h3>
                            <div className="grid gap-3">
                                {outgoing.map((conn) => (
                                    <Card key={conn.id} className="border-dashed">
                                        <CardContent className="flex items-center justify-between py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-muted flex size-10 items-center justify-center rounded-full text-sm font-medium">
                                                    {conn.partnerOrg.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium">
                                                        {conn.partnerOrg.name}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        Invitation sent &middot;{" "}
                                                        {new Date(
                                                            conn.createdAt
                                                        ).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="outline">Pending</Badge>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Active Connections */}
                    {active.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium">Active ({active.length})</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                {active.map((conn) => (
                                    <ConnectionCard key={conn.id} connection={conn} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suspended */}
                    {suspended.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium">Suspended ({suspended.length})</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                {suspended.map((conn) => (
                                    <ConnectionCard key={conn.id} connection={conn} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {connections.length === 0 && (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="text-muted-foreground mb-3 text-4xl">&#x1f517;</div>
                                <h3 className="text-lg font-medium">No connections yet</h3>
                                <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                                    Connect with another organization to let your agents collaborate
                                    across org boundaries.
                                </p>
                                <Button
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => setDialogOpen(true)}
                                >
                                    Connect an Organization
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            <ConnectionRequestDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={() => {
                    setDialogOpen(false);
                    fetchConnections();
                }}
            />
        </div>
    );
}

function ConnectionCard({ connection }: { connection: ConnectionSummary }) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full text-sm font-medium">
                            {connection.partnerOrg.name.charAt(0)}
                        </div>
                        <div>
                            <CardTitle className="text-base">
                                {connection.partnerOrg.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                                {connection.partnerOrg.slug}
                            </CardDescription>
                        </div>
                    </div>
                    <Badge
                        variant={connection.status === "active" ? "default" : "outline"}
                        className={
                            connection.status === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                                : ""
                        }
                    >
                        {connection.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
                <div className="flex gap-4 text-xs">
                    <div>
                        <span className="text-muted-foreground">You share:</span>{" "}
                        <span className="font-medium">
                            {connection.exposedAgentCount} agent
                            {connection.exposedAgentCount !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">They share:</span>{" "}
                        <span className="font-medium">
                            {connection.partnerExposedAgentCount} agent
                            {connection.partnerExposedAgentCount !== 1 ? "s" : ""}
                        </span>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                        {connection.direction === "initiated" ? "You invited" : "They invited"}
                    </Badge>
                    <Link href={`/settings/connections/${connection.id}`}>
                        <Button variant="outline" size="sm">
                            Manage
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
