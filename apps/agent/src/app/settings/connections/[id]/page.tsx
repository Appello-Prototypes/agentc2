"use client";

import { useEffect, useState, use, useCallback } from "react";
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
    AlertDescription,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Label,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { ConnectionHealthDashboard } from "@/components/federation/ConnectionHealthDashboard";

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

interface Governance {
    maxRequestsPerHour: number;
    maxRequestsPerDay: number;
    dataClassification: string;
    allowFileTransfer: boolean;
    requireHumanApproval: boolean;
}

interface ConnectionDetail {
    id: string;
    status: string;
    direction: "initiated" | "received";
    partnerOrg: { id: string; name: string; slug: string; logoUrl: string | null };
    myExposures: Exposure[];
    partnerExposures: Exposure[];
    governance: Governance;
    messageCount: number;
    createdAt: string;
    approvedAt: string | null;
}

interface MessageRecord {
    id: string;
    direction: string;
    sourceAgentSlug: string;
    targetAgentSlug: string;
    latencyMs: number | null;
    status: string;
    createdAt: string;
}

interface ConversationThread {
    conversationId: string;
    sourceAgentSlug: string;
    targetAgentSlug: string;
    messageCount: number;
    totalCostUsd: number;
    lastMessageAt: string;
}

export default function ConnectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [connection, setConnection] = useState<ConnectionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [selectedExposureIds, setSelectedExposureIds] = useState<string[]>([]);
    const [savingExposures, setSavingExposures] = useState(false);
    const [recentMessages, setRecentMessages] = useState<MessageRecord[]>([]);
    const [governanceOpen, setGovernanceOpen] = useState(false);
    const [conversations, setConversations] = useState<ConversationThread[]>([]);
    const [conversationsLoading, setConversationsLoading] = useState(false);

    const fetchConnection = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/federation/connections/${id}`);
            const data = await res.json();
            if (data.success) {
                setConnection(data.connection);
                setSelectedExposureIds(
                    data.connection.myExposures
                        .filter((e: Exposure) => e.enabled)
                        .map((e: Exposure) => e.agent.id || e.agent.slug)
                );
            } else {
                setError(data.error);
            }
        } catch {
            setError("Failed to load connection");
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchAgents = async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/agents`);
            const data = await res.json();
            if (data.success) {
                setAgents(
                    (data.agents || []).map(
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
            /* ignore */
        }
    };

    const fetchMessages = useCallback(async () => {
        try {
            const res = await fetch(
                `${getApiBase()}/api/federation/metrics?connectionId=${id}&includeMessages=true`
            );
            const data = await res.json();
            if (data.success && data.recentMessages) {
                setRecentMessages(data.recentMessages);
            }
        } catch {
            /* ignore */
        }
    }, [id]);

    const fetchConversations = useCallback(async () => {
        setConversationsLoading(true);
        try {
            const res = await fetch(
                `${getApiBase()}/api/federation/connections/${id}/conversations`
            );
            const data = await res.json();
            if (data.success) {
                setConversations(data.threads || []);
            }
        } catch {
            /* ignore */
        } finally {
            setConversationsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchConnection();
        fetchAgents();
        fetchMessages();
        fetchConversations();
    }, [id, fetchConnection, fetchMessages, fetchConversations]);

    const performAction = async (action: string, reason?: string) => {
        setActionLoading(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/federation/connections/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reason })
            });
            const data = await res.json();
            if (data.success) {
                fetchConnection();
            } else {
                setError(data.error);
            }
        } catch {
            setError("Action failed");
        } finally {
            setActionLoading(false);
        }
    };

    const saveExposures = async () => {
        setSavingExposures(true);
        try {
            const res = await fetch(`${getApiBase()}/api/federation/exposures`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agreementId: id,
                    agentIds: selectedExposureIds
                })
            });
            const data = await res.json();
            if (data.success) {
                fetchConnection();
            } else {
                setError(data.error);
            }
        } catch {
            setError("Failed to update shared agents");
        } finally {
            setSavingExposures(false);
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/settings/connections">
                        <Button variant="ghost" size="sm">
                            &larr; Back
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="bg-muted flex size-12 items-center justify-center rounded-full text-lg font-medium">
                            {connection.partnerOrg.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">{connection.partnerOrg.name}</h2>
                            <p className="text-muted-foreground text-sm">
                                {connection.partnerOrg.slug}
                            </p>
                        </div>
                    </div>
                    <Badge
                        variant={connection.status === "active" ? "default" : "outline"}
                        className={
                            connection.status === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                                : connection.status === "suspended"
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                                  : ""
                        }
                    >
                        {connection.status}
                    </Badge>
                </div>
                <div className="flex gap-2">
                    {connection.status === "active" && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => performAction("suspend", "Suspended by admin")}
                        >
                            Suspend
                        </Button>
                    )}
                    {connection.status === "suspended" && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => performAction("reactivate")}
                        >
                            Reactivate
                        </Button>
                    )}
                    {connection.status !== "revoked" && (
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => performAction("revoke", "Revoked by admin")}
                        >
                            Revoke
                        </Button>
                    )}
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="conversations">Conversations</TabsTrigger>
                    <TabsTrigger value="metrics">Metrics</TabsTrigger>
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 pt-4">
                    {/* Your Shared Agents */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Your Shared Agents</CardTitle>
                            <CardDescription>
                                Agents you share with {connection.partnerOrg.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {agents.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No agents available.
                                </p>
                            ) : (
                                <>
                                    {agents.map((agent) => (
                                        <label
                                            key={agent.id || agent.slug}
                                            className="hover:bg-accent/50 flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium">{agent.name}</p>
                                                {agent.description && (
                                                    <p className="text-muted-foreground line-clamp-1 text-xs">
                                                        {agent.description}
                                                    </p>
                                                )}
                                            </div>
                                            <Switch
                                                checked={selectedExposureIds.includes(
                                                    agent.id || agent.slug
                                                )}
                                                onCheckedChange={(checked) => {
                                                    const agentKey = agent.id || agent.slug;
                                                    setSelectedExposureIds((prev) =>
                                                        checked
                                                            ? [...prev, agentKey]
                                                            : prev.filter((x) => x !== agentKey)
                                                    );
                                                }}
                                            />
                                        </label>
                                    ))}
                                    <Button
                                        size="sm"
                                        onClick={saveExposures}
                                        disabled={savingExposures}
                                    >
                                        {savingExposures ? "Saving..." : "Save Changes"}
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Partner's Shared Agents */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                {connection.partnerOrg.name}&apos;s Shared Agents
                            </CardTitle>
                            <CardDescription>
                                Agents available to you from {connection.partnerOrg.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {connection.partnerExposures.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No agents shared yet.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {connection.partnerExposures.map((exp) => (
                                        <div
                                            key={exp.id}
                                            className="flex items-center justify-between rounded-lg border p-3"
                                        >
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {exp.agent.name}
                                                </p>
                                                {exp.agent.description && (
                                                    <p className="text-muted-foreground line-clamp-1 text-xs">
                                                        {exp.agent.description}
                                                    </p>
                                                )}
                                            </div>
                                            <Badge variant={exp.enabled ? "default" : "outline"}>
                                                {exp.enabled ? "Active" : "Disabled"}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Governance */}
                    <Card>
                        <Collapsible open={governanceOpen} onOpenChange={setGovernanceOpen}>
                            <CardHeader>
                                <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                                    <div>
                                        <CardTitle className="text-base">
                                            Advanced Settings
                                        </CardTitle>
                                        <CardDescription>
                                            Rate limits, data classification, and approval gates
                                        </CardDescription>
                                    </div>
                                    <span className="text-muted-foreground text-xs">
                                        {governanceOpen ? "Collapse" : "Expand"}
                                    </span>
                                </CollapsibleTrigger>
                            </CardHeader>
                            <CollapsibleContent>
                                <CardContent className="space-y-4 pt-0">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <Label className="text-xs">Max Requests / Hour</Label>
                                            <Input
                                                type="number"
                                                value={connection.governance.maxRequestsPerHour}
                                                disabled
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Max Requests / Day</Label>
                                            <Input
                                                type="number"
                                                value={connection.governance.maxRequestsPerDay}
                                                disabled
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Data Classification</Label>
                                        <Select
                                            value={connection.governance.dataClassification}
                                            disabled
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="public">Public</SelectItem>
                                                <SelectItem value="internal">Internal</SelectItem>
                                                <SelectItem value="confidential">
                                                    Confidential
                                                </SelectItem>
                                                <SelectItem value="restricted">
                                                    Restricted
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-xs">File Transfer</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Allow file attachments in messages
                                            </p>
                                        </div>
                                        <Switch
                                            checked={connection.governance.allowFileTransfer}
                                            disabled
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-xs">Human Approval</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Require human approval for each invocation
                                            </p>
                                        </div>
                                        <Switch
                                            checked={connection.governance.requireHumanApproval}
                                            disabled
                                        />
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>

                    {/* Health Dashboard */}
                    {connection.status === "active" && (
                        <ConnectionHealthDashboard connectionId={id} />
                    )}
                </TabsContent>

                <TabsContent value="conversations" className="pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Conversation Threads</CardTitle>
                            <CardDescription>
                                Agent-to-agent conversation history with{" "}
                                {connection.partnerOrg.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {conversationsLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10" />
                                    <Skeleton className="h-10" />
                                    <Skeleton className="h-10" />
                                </div>
                            ) : conversations.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No conversations yet.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Conversation ID</TableHead>
                                            <TableHead>Agents</TableHead>
                                            <TableHead>Messages</TableHead>
                                            <TableHead>Cost</TableHead>
                                            <TableHead>Last Activity</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {conversations.map((conv) => (
                                            <TableRow key={conv.conversationId}>
                                                <TableCell>
                                                    <Link
                                                        href={`/settings/connections/${id}/conversations/${conv.conversationId}`}
                                                        className="text-primary font-mono text-xs underline"
                                                    >
                                                        {conv.conversationId.slice(0, 8)}&hellip;
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {conv.sourceAgentSlug} &rarr;{" "}
                                                    {conv.targetAgentSlug}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {conv.messageCount}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    ${conv.totalCostUsd.toFixed(4)}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {new Date(conv.lastMessageAt).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="metrics" className="pt-4">
                    {connection.status === "active" ? (
                        <ConnectionHealthDashboard connectionId={id} />
                    ) : (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="text-muted-foreground text-sm">
                                    Metrics are only available for active connections.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="audit" className="pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                            <CardDescription>
                                Last 20 federation messages &middot;{" "}
                                <Link
                                    href={`/settings/connections/audit?connectionId=${id}`}
                                    className="underline"
                                >
                                    View full audit log
                                </Link>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {recentMessages.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No messages yet.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Time</TableHead>
                                            <TableHead>Direction</TableHead>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Target</TableHead>
                                            <TableHead>Latency</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentMessages.map((msg) => (
                                            <TableRow key={msg.id}>
                                                <TableCell className="text-xs">
                                                    {new Date(msg.createdAt).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {msg.direction === "outbound"
                                                        ? "\u2192"
                                                        : "\u2190"}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {msg.sourceAgentSlug}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {msg.targetAgentSlug}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {msg.latencyMs != null
                                                        ? `${msg.latencyMs}ms`
                                                        : "\u2014"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            msg.status === "delivered"
                                                                ? "default"
                                                                : "outline"
                                                        }
                                                        className="text-xs"
                                                    >
                                                        {msg.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
