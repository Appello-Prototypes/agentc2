"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Org {
    id: string;
    name: string;
    slug: string;
}

interface Message {
    id: string;
    conversationId: string;
    direction: string;
    sourceOrgId: string;
    sourceAgentSlug: string;
    targetOrgId: string;
    targetAgentSlug: string;
    contentType: string;
    content: string | null;
    decrypted: boolean;
    latencyMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    costUsd: number | null;
    policyResult: string;
    runId: string | null;
    createdAt: string;
}

interface ConversationData {
    agreementId: string;
    conversationId: string;
    initiatorOrg: Org;
    responderOrg: Org;
    messages: Message[];
}

export default function ConversationViewerPage() {
    const { agreementId, convId } = useParams<{
        agreementId: string;
        convId: string;
    }>();
    const [data, setData] = useState<ConversationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/federation/${agreementId}/conversations/${convId}`);
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    setError(body.error || `Request failed with status ${res.status}`);
                    return;
                }
                setData(await res.json());
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [agreementId, convId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-4">
                <Link
                    href={`/federation/${agreementId}`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Agreement
                </Link>
                <p className="text-red-500">{error || "No data returned."}</p>
            </div>
        );
    }

    const orgNameById: Record<string, string> = {
        [data.initiatorOrg.id]: data.initiatorOrg.name,
        [data.responderOrg.id]: data.responderOrg.name
    };

    const totalCost = data.messages.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
    const totalTokens = data.messages.reduce(
        (sum, m) => sum + (m.inputTokens ?? 0) + (m.outputTokens ?? 0),
        0
    );
    const first = data.messages[0];
    const last = data.messages[data.messages.length - 1];
    const durationMs =
        first && last
            ? new Date(last.createdAt).getTime() - new Date(first.createdAt).getTime()
            : 0;

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href={`/federation/${agreementId}`}
                    className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Agreement
                </Link>
                <h1 className="text-2xl font-bold">Conversation {convId.slice(0, 12)}…</h1>
                <p className="text-muted-foreground text-sm">
                    {data.initiatorOrg.name} ↔ {data.responderOrg.name}
                </p>
            </div>

            <div className="space-y-3">
                {data.messages.map((msg) => {
                    const isInitiator = msg.sourceOrgId === data.initiatorOrg.id;
                    const orgName = orgNameById[msg.sourceOrgId] ?? msg.sourceOrgId;

                    return (
                        <div
                            key={msg.id}
                            className={`rounded-lg border p-4 ${
                                isInitiator
                                    ? "border-border bg-muted/50"
                                    : "border-primary/20 bg-primary/5"
                            }`}
                        >
                            <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-bold">{orgName}</span>
                                    <span className="text-muted-foreground text-xs">
                                        / {msg.sourceAgentSlug}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        → {orgNameById[msg.targetOrgId] ?? msg.targetOrgId} /{" "}
                                        {msg.targetAgentSlug}
                                    </span>
                                </div>
                                <span className="text-muted-foreground text-xs">
                                    {new Date(msg.createdAt).toLocaleString()}
                                </span>
                            </div>

                            <div className="mb-3 text-sm whitespace-pre-wrap">
                                {msg.content ?? (
                                    <span className="text-muted-foreground italic">
                                        {msg.decrypted
                                            ? "(empty)"
                                            : "🔒 Encrypted — unable to decrypt"}
                                    </span>
                                )}
                            </div>

                            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                                {msg.inputTokens != null && msg.outputTokens != null && (
                                    <span>{msg.inputTokens + msg.outputTokens} tokens</span>
                                )}
                                {msg.latencyMs != null && <span>{msg.latencyMs}ms</span>}
                                {msg.costUsd != null && <span>${msg.costUsd.toFixed(4)}</span>}
                                <PolicyBadge result={msg.policyResult} />
                                {msg.runId && (
                                    <span className="font-mono">run:{msg.runId.slice(0, 8)}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-card border-border rounded-lg border p-4">
                <h2 className="mb-2 text-sm font-semibold">Journey Summary</h2>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
                    <dt className="text-muted-foreground">Messages</dt>
                    <dd className="font-mono text-xs">{data.messages.length}</dd>
                    <dt className="text-muted-foreground">Total Cost</dt>
                    <dd className="font-mono text-xs">${totalCost.toFixed(4)}</dd>
                    <dt className="text-muted-foreground">Total Tokens</dt>
                    <dd className="font-mono text-xs">{totalTokens}</dd>
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="font-mono text-xs">{formatDuration(durationMs)}</dd>
                </dl>
            </div>
        </div>
    );
}

function PolicyBadge({ result }: { result: string }) {
    const colors: Record<string, string> = {
        approved: "bg-green-500/10 text-green-500",
        filtered: "bg-yellow-500/10 text-yellow-500",
        blocked: "bg-red-500/10 text-red-500"
    };
    return (
        <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[result] ?? "bg-muted text-muted-foreground"}`}
        >
            {result}
        </span>
    );
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSec = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSec}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMin = minutes % 60;
    return `${hours}h ${remainingMin}m`;
}
