"use client";

import { useEffect, useState, use } from "react";
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

interface OrgInfo {
    id: string;
    name: string;
    slug: string;
}

interface ConversationMessage {
    id: string;
    direction: string;
    sourceOrgId: string;
    sourceAgentSlug: string;
    targetOrgId: string;
    targetAgentSlug: string;
    content: string | null;
    contentType: string;
    signatureVerified: boolean;
    policyResult: string;
    policyDetails: unknown;
    latencyMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    costUsd: number | null;
    runId: string | null;
    createdAt: string;
}

interface ConversationData {
    conversationId: string;
    agreement: {
        id: string;
        initiatorOrg: OrgInfo;
        responderOrg: OrgInfo;
    };
    messages: ConversationMessage[];
    summary: {
        messageCount: number;
        totalCostUsd: number;
        durationMs: number;
        policyBreakdown: { approved: number; filtered: number; blocked: number };
        allSignaturesVerified: boolean;
    };
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
    return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

function policyColor(result: string): string {
    if (result === "approved")
        return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400";
    if (result === "filtered")
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
}

export default function ConversationViewerPage({
    params
}: {
    params: Promise<{ id: string; convId: string }>;
}) {
    const { id, convId } = use(params);
    const [data, setData] = useState<ConversationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(
                    `${getApiBase()}/api/federation/connections/${id}/conversations/${convId}`
                );
                const json = await res.json();
                if (json.success) {
                    setData(json);
                } else {
                    setError(json.error || "Failed to load conversation");
                }
            } catch {
                setError("Failed to load conversation");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, convId]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-20" />
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-4">
                <Link href={`/settings/connections/${id}`}>
                    <Button variant="ghost" size="sm">
                        &larr; Back to Connection
                    </Button>
                </Link>
                <Alert variant="destructive">
                    <AlertDescription>{error || "Conversation not found"}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const leftOrgId = data.messages[0]?.sourceOrgId ?? data.agreement.initiatorOrg.id;
    const orgLookup: Record<string, OrgInfo> = {
        [data.agreement.initiatorOrg.id]: data.agreement.initiatorOrg,
        [data.agreement.responderOrg.id]: data.agreement.responderOrg
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/settings/connections/${id}`}>
                    <Button variant="ghost" size="sm">
                        &larr; Back to Connection
                    </Button>
                </Link>
                <div>
                    <h2 className="text-xl font-semibold">Conversation</h2>
                    <p className="text-muted-foreground font-mono text-xs">{data.conversationId}</p>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Participants</CardTitle>
                    <CardDescription>
                        {data.agreement.initiatorOrg.name} &harr; {data.agreement.responderOrg.name}
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="space-y-4">
                {data.messages.map((msg) => {
                    const isLeft = msg.sourceOrgId === leftOrgId;
                    const orgName = orgLookup[msg.sourceOrgId]?.name ?? "Unknown";
                    const totalTokens = (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0);

                    return (
                        <div
                            key={msg.id}
                            className={`flex ${isLeft ? "justify-start" : "justify-end"}`}
                        >
                            <Card
                                className={`max-w-[75%] ${
                                    isLeft
                                        ? "border-l-primary/50 border-l-4"
                                        : "border-r-primary/50 border-r-4"
                                }`}
                            >
                                <CardContent className="space-y-2 p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <span className="text-sm font-semibold">{orgName}</span>
                                            <span className="text-muted-foreground text-xs">
                                                {" "}
                                                / {msg.sourceAgentSlug} &rarr; {msg.targetAgentSlug}
                                            </span>
                                        </div>
                                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                                            {new Date(msg.createdAt).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                                        {msg.content || (
                                            <span className="text-muted-foreground italic">
                                                No content
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                                        {totalTokens > 0 && (
                                            <span className="text-muted-foreground text-[11px]">
                                                {msg.inputTokens ?? 0}
                                                &thinsp;in / {msg.outputTokens ?? 0}
                                                &thinsp;out
                                            </span>
                                        )}
                                        {msg.latencyMs != null && (
                                            <span className="text-muted-foreground text-[11px]">
                                                {msg.latencyMs}ms
                                            </span>
                                        )}
                                        {msg.costUsd != null && (
                                            <span className="text-muted-foreground text-[11px]">
                                                ${msg.costUsd.toFixed(5)}
                                            </span>
                                        )}
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] ${
                                                msg.signatureVerified
                                                    ? "border-green-300 text-green-700 dark:border-green-800 dark:text-green-400"
                                                    : "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
                                            }`}
                                        >
                                            {msg.signatureVerified ? "Verified" : "Unverified"}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] ${policyColor(msg.policyResult)}`}
                                        >
                                            {msg.policyResult}
                                        </Badge>
                                        {msg.runId && (
                                            <Link
                                                href={`/agents/${msg.sourceAgentSlug}/traces?runId=${msg.runId}`}
                                                className="text-primary text-[11px] underline"
                                            >
                                                View Run
                                            </Link>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    );
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Conversation Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                        <div>
                            <p className="text-muted-foreground text-xs">Messages</p>
                            <p className="text-lg font-semibold">{data.summary.messageCount}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Total Cost</p>
                            <p className="text-lg font-semibold">
                                ${data.summary.totalCostUsd.toFixed(4)}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Duration</p>
                            <p className="text-lg font-semibold">
                                {formatDuration(data.summary.durationMs)}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground text-xs">Signatures</p>
                            <p className="text-lg font-semibold">
                                {data.summary.allSignaturesVerified ? (
                                    <span className="text-green-600">All Verified</span>
                                ) : (
                                    <span className="text-red-600">Issues Found</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                                Approved: {data.summary.policyBreakdown.approved}
                            </Badge>
                        </div>
                        {data.summary.policyBreakdown.filtered > 0 && (
                            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
                                Filtered: {data.summary.policyBreakdown.filtered}
                            </Badge>
                        )}
                        {data.summary.policyBreakdown.blocked > 0 && (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                                Blocked: {data.summary.policyBreakdown.blocked}
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
