"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Switch,
    Skeleton,
    Alert,
    AlertDescription
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface AgentInfo {
    id?: string;
    slug: string;
    name: string;
    description: string | null;
}

interface Exposure {
    id: string;
    agent: AgentInfo;
    exposedSkills: string[];
    enabled: boolean;
}

interface ConnectionDetail {
    id: string;
    status: string;
    direction: "initiated" | "received";
    partnerOrg: { id: string; name: string; slug: string; logoUrl: string | null };
    myExposures: Exposure[];
    partnerExposures: Exposure[];
    governance: {
        maxRequestsPerHour: number;
        maxRequestsPerDay: number;
        dataClassification: string;
        allowFileTransfer: boolean;
        requireHumanApproval: boolean;
    };
    messageCount: number;
    createdAt: string;
    approvedAt: string | null;
}

export default function ApproveConnectionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [connection, setConnection] = useState<ConnectionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [connRes, agentsRes] = await Promise.all([
                    fetch(`${getApiBase()}/api/federation/connections/${id}`),
                    fetch(`${getApiBase()}/api/agents`)
                ]);
                const connData = await connRes.json();
                const agentsData = await agentsRes.json();

                if (connData.success) {
                    setConnection(connData.connection);
                } else {
                    setError(connData.error);
                }

                if (agentsData.success) {
                    setAgents(
                        (agentsData.agents || []).map(
                            (a: {
                                id: string;
                                slug: string;
                                name: string;
                                description: string | null;
                            }) => ({
                                id: a.id,
                                slug: a.slug,
                                name: a.name,
                                description: a.description
                            })
                        )
                    );
                }
            } catch {
                setError("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handleApprove = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/federation/connections/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "approve",
                    exposedAgentIds: selectedAgentIds
                })
            });
            const data = await res.json();
            if (data.success) {
                router.push(`/settings/connections/${id}`);
            } else {
                setError(data.error);
            }
        } catch {
            setError("Failed to approve connection");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDecline = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/federation/connections/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "revoke",
                    reason: "Declined by admin"
                })
            });
            const data = await res.json();
            if (data.success) {
                router.push("/settings/connections");
            } else {
                setError(data.error);
            }
        } catch {
            setError("Failed to decline connection");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
            </div>
        );
    }

    if (!connection) {
        return (
            <Alert variant="destructive">
                <AlertDescription>{error || "Connection not found"}</AlertDescription>
            </Alert>
        );
    }

    if (connection.status !== "pending") {
        return (
            <div className="space-y-4">
                <Alert>
                    <AlertDescription>
                        This connection has already been {connection.status}.
                    </AlertDescription>
                </Alert>
                <Link href={`/settings/connections/${id}`}>
                    <Button variant="outline" size="sm">
                        View Connection
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/settings/connections">
                    <Button variant="ghost" size="sm">
                        &larr; Back
                    </Button>
                </Link>
                <h2 className="text-xl font-semibold">Review Connection Request</h2>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Requester Profile */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Connection Request from {connection.partnerOrg.name}
                    </CardTitle>
                    <CardDescription>
                        {connection.partnerOrg.slug} &middot; Requested{" "}
                        {new Date(connection.createdAt).toLocaleDateString()}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <div className="bg-muted flex size-12 items-center justify-center rounded-full text-lg font-medium">
                            {connection.partnerOrg.name.charAt(0)}
                        </div>
                        <div>
                            <p className="font-medium">{connection.partnerOrg.name}</p>
                            <p className="text-muted-foreground text-sm">
                                {connection.partnerOrg.slug}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* What They're Sharing */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Agents They Want to Share</CardTitle>
                    <CardDescription>
                        These agents will be available to you once you accept
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {connection.partnerExposures.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No agents shared yet — they can add agents after you accept.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {connection.partnerExposures.map((exp) => (
                                <div
                                    key={exp.id}
                                    className="flex items-center justify-between rounded-lg border p-3"
                                >
                                    <div>
                                        <p className="text-sm font-medium">{exp.agent.name}</p>
                                        {exp.agent.description && (
                                            <p className="text-muted-foreground line-clamp-1 text-xs">
                                                {exp.agent.description}
                                            </p>
                                        )}
                                    </div>
                                    <Badge variant="secondary">Offered</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Your Response -- Agent Picker */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Your Agents to Share Back</CardTitle>
                    <CardDescription>
                        Choose which of your agents {connection.partnerOrg.name} can access
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {agents.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No agents available to share.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {agents.map((agent) => {
                                const key = agent.id || agent.slug;
                                return (
                                    <label
                                        key={key}
                                        className="hover:bg-accent/50 flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{agent.name}</p>
                                            {agent.description && (
                                                <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                                                    {agent.description}
                                                </p>
                                            )}
                                        </div>
                                        <Switch
                                            checked={selectedAgentIds.includes(key)}
                                            onCheckedChange={(checked) =>
                                                setSelectedAgentIds((prev) =>
                                                    checked
                                                        ? [...prev, key]
                                                        : prev.filter((x) => x !== key)
                                                )
                                            }
                                        />
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Accept / Decline */}
            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleDecline} disabled={submitting}>
                    Decline
                </Button>
                <Button onClick={handleApprove} disabled={submitting}>
                    {submitting ? "Processing..." : "Accept Connection"}
                </Button>
            </div>
        </div>
    );
}
