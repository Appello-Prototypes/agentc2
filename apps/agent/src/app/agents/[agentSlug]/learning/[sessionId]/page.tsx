"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

// Types
interface LearningSessionDetail {
    id: string;
    status: string;
    runCount: number;
    datasetHash: string | null;
    baselineVersion: number | null;
    scorerConfig: { scorers?: string[] } | null;
    metadata: { failureReason?: string; triggerReason?: string; triggerType?: string } | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
}

interface LearningAgent {
    id: string;
    slug: string;
    name: string;
    version: number;
}

interface LearningDataset {
    id: string;
    runCount: number;
    avgScore: number | null;
    datasetHash: string;
    fromDate: string;
    toDate: string;
    selectionCriteria: Record<string, unknown> | null;
    runIds: string[];
}

interface LearningSignal {
    id: string;
    type: string;
    severity: string | null;
    pattern: string;
    frequency: number;
    impact: number | null;
    evidenceJson: Array<{ runId: string; scores?: Record<string, number> }> | null;
    createdAt: string;
}

interface LearningProposal {
    id: string;
    proposalType: string;
    title: string;
    description: string;
    instructionsDiff: string | null;
    toolChangesJson: unknown;
    memoryChangesJson: unknown;
    modelChangesJson: unknown;
    expectedImpact: string | null;
    confidenceScore: number | null;
    generatedBy: string | null;
    candidateVersionId: string | null;
    isSelected: boolean;
    createdAt: string;
}

interface LearningExperiment {
    id: string;
    status: string;
    baselineVersionId: string | null;
    candidateVersionId: string | null;
    baselineMetrics: { avgScore?: number; successRate?: number; sampleCount?: number } | null;
    candidateMetrics: { avgScore?: number; successRate?: number; sampleCount?: number } | null;
    gatingThreshold: number;
    winRate: number | null;
    confidenceInterval: { lower?: number; upper?: number } | null;
    gatingResult: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
}

interface LearningApproval {
    id: string;
    decision: string;
    rationale: string | null;
    approvedBy: string | null;
    promotedVersionId: string | null;
    autoApproved: boolean;
    reviewedAt: string | null;
    createdAt: string;
}

const statusColors: Record<string, string> = {
    COLLECTING: "bg-blue-500/20 text-blue-600",
    ANALYZING: "bg-blue-500/20 text-blue-600",
    PROPOSING: "bg-purple-500/20 text-purple-600",
    TESTING: "bg-yellow-500/20 text-yellow-600",
    AWAITING_APPROVAL: "bg-orange-500/20 text-orange-600",
    APPROVED: "bg-green-500/20 text-green-600",
    REJECTED: "bg-red-500/20 text-red-600",
    PROMOTED: "bg-green-500/20 text-green-600",
    FAILED: "bg-red-500/20 text-red-600",
    PENDING: "bg-gray-500/20 text-gray-600",
    RUNNING: "bg-blue-500/20 text-blue-600",
    COMPLETED: "bg-green-500/20 text-green-600",
    PASSED: "bg-green-500/20 text-green-600"
};

export default function LearningSessionDetailPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;
    const sessionId = params.sessionId as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<LearningSessionDetail | null>(null);
    const [agent, setAgent] = useState<LearningAgent | null>(null);
    const [dataset, setDataset] = useState<LearningDataset | null>(null);
    const [signals, setSignals] = useState<LearningSignal[]>([]);
    const [proposals, setProposals] = useState<LearningProposal[]>([]);
    const [experiments, setExperiments] = useState<LearningExperiment[]>([]);
    const [approval, setApproval] = useState<LearningApproval | null>(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [approvalDialog, setApprovalDialog] = useState<{
        open: boolean;
        action: "approve" | "reject";
    } | null>(null);
    const [statusMessage, setStatusMessage] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [cancellingSession, setCancellingSession] = useState(false);

    const fetchData = useCallback(
        async (isPolling = false) => {
            try {
                if (!isPolling) {
                    setLoading(true);
                }
                setError(null);

                const response = await fetch(
                    `${getApiBase()}/api/agents/${agentSlug}/learning/${sessionId}`
                );
                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || "Failed to fetch session details");
                }

                setSession(data.session);
                setAgent(data.agent);
                setDataset(data.dataset);
                setSignals(data.signals || []);
                setProposals(data.proposals || []);
                setExperiments(data.experiments || []);
                setApproval(data.approval);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load session");
            } finally {
                if (!isPolling) {
                    setLoading(false);
                }
            }
        },
        [agentSlug, sessionId]
    );

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Auto-refresh for active sessions
    const isActiveSession =
        session && ["COLLECTING", "ANALYZING", "PROPOSING", "TESTING"].includes(session.status);

    useEffect(() => {
        if (!isActiveSession) return;

        const interval = setInterval(() => {
            fetchData(true);
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [isActiveSession, fetchData]);

    const handleApprovalAction = useCallback(
        async (action: "approve" | "reject", rationale?: string) => {
            try {
                const endpoint =
                    action === "approve"
                        ? `${getApiBase()}/api/agents/${agentSlug}/learning/${sessionId}/approve`
                        : `${getApiBase()}/api/agents/${agentSlug}/learning/${sessionId}/reject`;

                const body =
                    action === "approve"
                        ? { approvedBy: "current-user", rationale }
                        : { rejectedBy: "current-user", rationale };

                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || `Failed to ${action} session`);
                }

                setStatusMessage({
                    type: "success",
                    message: `Session ${action === "approve" ? "approved" : "rejected"} successfully`
                });

                setApprovalDialog(null);
                fetchData();
            } catch (err) {
                setStatusMessage({
                    type: "error",
                    message: err instanceof Error ? err.message : `Failed to ${action} session`
                });
            }
        },
        [agentSlug, sessionId, fetchData]
    );

    const cancelSession = useCallback(async () => {
        try {
            setCancellingSession(true);
            setStatusMessage(null);

            const response = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/learning/${sessionId}`,
                {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reason: "Cancelled via session detail page" })
                }
            );

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to cancel session");
            }

            setStatusMessage({
                type: "success",
                message: "Session cancelled"
            });

            // Refresh to show updated status
            fetchData();
        } catch (err) {
            setStatusMessage({
                type: "error",
                message: err instanceof Error ? err.message : "Failed to cancel session"
            });
        } finally {
            setCancellingSession(false);
            setTimeout(() => setStatusMessage(null), 5000);
        }
    }, [agentSlug, sessionId, fetchData]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-64" />
                </div>
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href={`/agents/${agentSlug}/learning`}>
                        <Button variant="ghost" size="sm">
                            ← Back to Learning
                        </Button>
                    </Link>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error || "Session not found"}</p>
                        <Button onClick={() => fetchData()}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const formatDuration = (start: string, end: string | null) => {
        if (!end) return "In progress";
        const ms = new Date(end).getTime() - new Date(start).getTime();
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    // Guard against null session
    if (!session) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/agents/${agentSlug}/learning`}>
                        <Button variant="ghost" size="sm">
                            ← Back
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">Learning Session</h1>
                            <Badge
                                className={
                                    statusColors[session.status] || "bg-gray-500/20 text-gray-600"
                                }
                            >
                                {session.status}
                            </Badge>
                            {isActiveSession && (
                                <Badge
                                    variant="outline"
                                    className="animate-pulse border-green-500 text-green-600"
                                >
                                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
                                    Live
                                </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm">
                            {agent?.name} • {session.runCount} runs analyzed •{" "}
                            {formatDuration(session.createdAt, session.completedAt)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {statusMessage && (
                        <span
                            className={`text-sm ${statusMessage.type === "error" ? "text-destructive" : "text-green-600"}`}
                        >
                            {statusMessage.message}
                        </span>
                    )}
                    {isActiveSession && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={cancelSession}
                            disabled={cancellingSession}
                        >
                            {cancellingSession ? "Cancelling..." : "Cancel Session"}
                        </Button>
                    )}
                    {session.status === "AWAITING_APPROVAL" ? (
                        <>
                            <Button
                                variant="destructive"
                                onClick={() => setApprovalDialog({ open: true, action: "reject" })}
                            >
                                Reject
                            </Button>
                            <Button
                                onClick={() => setApprovalDialog({ open: true, action: "approve" })}
                            >
                                Approve & Promote
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Runs Analyzed</CardDescription>
                        <CardTitle className="text-2xl">{session.runCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Signals Found</CardDescription>
                        <CardTitle className="text-2xl">{signals.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Proposals</CardDescription>
                        <CardTitle className="text-2xl">{proposals.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Experiments</CardDescription>
                        <CardTitle className="text-2xl">{experiments.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Dataset Score</CardDescription>
                        <CardTitle className="text-2xl">
                            {dataset?.avgScore ? `${(dataset.avgScore * 100).toFixed(0)}%` : "N/A"}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Failure Reason Alert */}
            {session.metadata?.failureReason && (
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-destructive text-sm font-medium">
                            Session Failed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">{String(session.metadata.failureReason)}</p>
                    </CardContent>
                </Card>
            )}

            {/* Tabs */}
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="signals">Signals ({signals.length})</TabsTrigger>
                    <TabsTrigger value="proposals">Proposals ({proposals.length})</TabsTrigger>
                    <TabsTrigger value="experiments">
                        Experiments ({experiments.length})
                    </TabsTrigger>
                    <TabsTrigger value="dataset">Dataset</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Timeline */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Session Timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-600">
                                            ✓
                                        </div>
                                        <div>
                                            <p className="font-medium">Session Started</p>
                                            <p className="text-muted-foreground text-xs">
                                                {formatDate(session.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${signals.length > 0 ? "bg-green-500/20 text-green-600" : "bg-gray-500/20 text-gray-600"}`}
                                        >
                                            {signals.length > 0 ? "✓" : "○"}
                                        </div>
                                        <div>
                                            <p className="font-medium">Signal Extraction</p>
                                            <p className="text-muted-foreground text-xs">
                                                {signals.length} signals detected
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${proposals.length > 0 ? "bg-green-500/20 text-green-600" : "bg-gray-500/20 text-gray-600"}`}
                                        >
                                            {proposals.length > 0 ? "✓" : "○"}
                                        </div>
                                        <div>
                                            <p className="font-medium">Proposal Generation</p>
                                            <p className="text-muted-foreground text-xs">
                                                {proposals.length} proposals created
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${experiments.length > 0 ? "bg-green-500/20 text-green-600" : "bg-gray-500/20 text-gray-600"}`}
                                        >
                                            {experiments.length > 0 ? "✓" : "○"}
                                        </div>
                                        <div>
                                            <p className="font-medium">A/B Experiment</p>
                                            <p className="text-muted-foreground text-xs">
                                                {experiments.length > 0
                                                    ? `${experiments[0].gatingResult || experiments[0].status}`
                                                    : "Not run"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${session.status === "PROMOTED" ? "bg-green-500/20 text-green-600" : session.status === "FAILED" || session.status === "REJECTED" ? "bg-red-500/20 text-red-600" : "bg-gray-500/20 text-gray-600"}`}
                                        >
                                            {session.status === "PROMOTED"
                                                ? "✓"
                                                : session.status === "FAILED" ||
                                                    session.status === "REJECTED"
                                                  ? "✗"
                                                  : "○"}
                                        </div>
                                        <div>
                                            <p className="font-medium">Completion</p>
                                            <p className="text-muted-foreground text-xs">
                                                {session.completedAt
                                                    ? formatDate(session.completedAt)
                                                    : "In progress"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Configuration */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Configuration</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-muted-foreground text-sm">Agent</p>
                                    <p className="font-medium">{agent?.name}</p>
                                    <p className="text-muted-foreground text-xs">
                                        Version {session.baselineVersion}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm">Scorers</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {session.scorerConfig?.scorers?.map((scorer) => (
                                            <Badge key={scorer} variant="outline">
                                                {scorer}
                                            </Badge>
                                        )) || <span className="text-muted-foreground">None</span>}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm">Dataset Hash</p>
                                    <p className="font-mono text-xs">
                                        {session.datasetHash?.slice(0, 16)}...
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Signals Tab */}
                <TabsContent value="signals">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detected Signals</CardTitle>
                            <CardDescription>
                                Patterns and issues found in the analyzed runs
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {signals.length === 0 ? (
                                <p className="text-muted-foreground py-8 text-center">
                                    No signals detected
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {signals.map((signal) => (
                                        <div key={signal.id} className="rounded-lg border p-4">
                                            <div className="mb-2 flex items-center gap-2">
                                                <Badge variant="outline">{signal.type}</Badge>
                                                <Badge
                                                    className={
                                                        signal.severity === "high"
                                                            ? "bg-red-500/20 text-red-600"
                                                            : signal.severity === "medium"
                                                              ? "bg-yellow-500/20 text-yellow-600"
                                                              : "bg-blue-500/20 text-blue-600"
                                                    }
                                                >
                                                    {signal.severity || "low"}
                                                </Badge>
                                                {signal.impact && (
                                                    <span className="text-muted-foreground text-sm">
                                                        Impact: {(signal.impact * 100).toFixed(0)}%
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mb-2 text-sm">{signal.pattern}</p>
                                            <div className="text-muted-foreground text-xs">
                                                Frequency: {signal.frequency} •{" "}
                                                {formatDate(signal.createdAt)}
                                            </div>
                                            {signal.evidenceJson &&
                                                signal.evidenceJson.length > 0 && (
                                                    <div className="mt-3">
                                                        <p className="text-muted-foreground mb-1 text-xs">
                                                            Evidence:
                                                        </p>
                                                        <div className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs">
                                                            {signal.evidenceJson.map((ev, i) => (
                                                                <div key={i} className="mb-1">
                                                                    Run: {ev.runId.slice(0, 12)}...
                                                                    {ev.scores && (
                                                                        <span className="ml-2">
                                                                            Scores:{" "}
                                                                            {Object.entries(
                                                                                ev.scores
                                                                            )
                                                                                .map(
                                                                                    ([k, v]) =>
                                                                                        `${k}: ${v}`
                                                                                )
                                                                                .join(", ")}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Proposals Tab */}
                <TabsContent value="proposals">
                    <Card>
                        <CardHeader>
                            <CardTitle>Improvement Proposals</CardTitle>
                            <CardDescription>
                                AI-generated suggestions to improve agent performance
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {proposals.length === 0 ? (
                                <p className="text-muted-foreground py-8 text-center">
                                    No proposals generated
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {proposals.map((proposal) => (
                                        <div
                                            key={proposal.id}
                                            className={`rounded-lg border p-4 ${proposal.isSelected ? "border-primary bg-primary/5" : ""}`}
                                        >
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="font-medium">
                                                    {proposal.title}
                                                </span>
                                                <Badge variant="outline">
                                                    {proposal.proposalType}
                                                </Badge>
                                                {proposal.isSelected && <Badge>Selected</Badge>}
                                            </div>
                                            <p className="text-muted-foreground mb-3 text-sm">
                                                {proposal.description}
                                            </p>
                                            <div className="mb-3 flex items-center gap-4 text-sm">
                                                {proposal.confidenceScore && (
                                                    <span>
                                                        Confidence:{" "}
                                                        <strong>
                                                            {(
                                                                proposal.confidenceScore * 100
                                                            ).toFixed(0)}
                                                            %
                                                        </strong>
                                                    </span>
                                                )}
                                                {proposal.generatedBy && (
                                                    <span className="text-muted-foreground">
                                                        Generated by: {proposal.generatedBy}
                                                    </span>
                                                )}
                                            </div>
                                            {proposal.expectedImpact && (
                                                <p className="mb-3 text-sm text-green-600">
                                                    {proposal.expectedImpact}
                                                </p>
                                            )}
                                            {proposal.instructionsDiff && (
                                                <div>
                                                    <p className="text-muted-foreground mb-1 text-xs">
                                                        Instructions Diff:
                                                    </p>
                                                    <pre className="bg-muted max-h-60 overflow-auto rounded p-3 text-xs">
                                                        {proposal.instructionsDiff}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Experiments Tab */}
                <TabsContent value="experiments">
                    <Card>
                        <CardHeader>
                            <CardTitle>A/B Experiments</CardTitle>
                            <CardDescription>
                                Testing proposed changes against the baseline
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {experiments.length === 0 ? (
                                <p className="text-muted-foreground py-8 text-center">
                                    No experiments run
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {experiments.map((exp) => (
                                        <div key={exp.id} className="rounded-lg border p-4">
                                            <div className="mb-4 flex items-center gap-2">
                                                <Badge
                                                    className={
                                                        statusColors[exp.status] ||
                                                        "bg-gray-500/20 text-gray-600"
                                                    }
                                                >
                                                    {exp.status}
                                                </Badge>
                                                {exp.gatingResult && (
                                                    <Badge
                                                        className={
                                                            exp.gatingResult === "passed"
                                                                ? "bg-green-500/20 text-green-600"
                                                                : "bg-red-500/20 text-red-600"
                                                        }
                                                    >
                                                        {exp.gatingResult}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Win Rate */}
                                            {exp.winRate !== null && (
                                                <div className="mb-4">
                                                    <p className="text-muted-foreground mb-1 text-sm">
                                                        Win Rate
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-muted h-4 flex-1 overflow-hidden rounded-full">
                                                            <div
                                                                className={`h-full ${exp.winRate >= exp.gatingThreshold ? "bg-green-500" : "bg-red-500"}`}
                                                                style={{
                                                                    width: `${exp.winRate * 100}%`
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-medium">
                                                            {(exp.winRate * 100).toFixed(1)}%
                                                        </span>
                                                        <span className="text-muted-foreground text-xs">
                                                            (threshold: {exp.gatingThreshold * 100}
                                                            %)
                                                        </span>
                                                    </div>
                                                    {exp.confidenceInterval && (
                                                        <p className="text-muted-foreground mt-1 text-xs">
                                                            95% CI: [
                                                            {(
                                                                (exp.confidenceInterval.lower ||
                                                                    0) * 100
                                                            ).toFixed(0)}
                                                            % -{" "}
                                                            {(
                                                                (exp.confidenceInterval.upper ||
                                                                    0) * 100
                                                            ).toFixed(0)}
                                                            %]
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Metrics Comparison */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                                                    <p className="text-muted-foreground mb-2 text-sm font-medium">
                                                        Baseline
                                                    </p>
                                                    {exp.baselineMetrics ? (
                                                        <div className="space-y-1 text-sm">
                                                            <p>
                                                                Score:{" "}
                                                                {exp.baselineMetrics.avgScore !==
                                                                null
                                                                    ? `${((exp.baselineMetrics.avgScore || 0) * 100).toFixed(1)}%`
                                                                    : "N/A"}
                                                            </p>
                                                            <p>
                                                                Success:{" "}
                                                                {exp.baselineMetrics.successRate !==
                                                                undefined
                                                                    ? `${(exp.baselineMetrics.successRate * 100).toFixed(1)}%`
                                                                    : "N/A"}
                                                            </p>
                                                            <p className="text-muted-foreground text-xs">
                                                                {exp.baselineMetrics.sampleCount}{" "}
                                                                samples
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-muted-foreground text-sm">
                                                            No data
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="rounded bg-blue-50 p-3 dark:bg-blue-900/20">
                                                    <p className="mb-2 text-sm font-medium text-blue-600">
                                                        Candidate
                                                    </p>
                                                    {exp.candidateMetrics ? (
                                                        <div className="space-y-1 text-sm">
                                                            <p>
                                                                Score:{" "}
                                                                {exp.candidateMetrics.avgScore !==
                                                                null
                                                                    ? `${((exp.candidateMetrics.avgScore || 0) * 100).toFixed(1)}%`
                                                                    : "N/A"}
                                                            </p>
                                                            <p>
                                                                Success:{" "}
                                                                {exp.candidateMetrics
                                                                    .successRate !== undefined
                                                                    ? `${(exp.candidateMetrics.successRate * 100).toFixed(1)}%`
                                                                    : "N/A"}
                                                            </p>
                                                            <p className="text-muted-foreground text-xs">
                                                                {exp.candidateMetrics.sampleCount}{" "}
                                                                samples
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-muted-foreground text-sm">
                                                            No data
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Timing */}
                                            <div className="text-muted-foreground mt-3 text-xs">
                                                {exp.startedAt && (
                                                    <span>
                                                        Started: {formatDate(exp.startedAt)}
                                                    </span>
                                                )}
                                                {exp.completedAt && (
                                                    <span className="ml-4">
                                                        Completed: {formatDate(exp.completedAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Dataset Tab */}
                <TabsContent value="dataset">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dataset Details</CardTitle>
                            <CardDescription>Runs collected for analysis</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dataset ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                        <div>
                                            <p className="text-muted-foreground text-sm">
                                                Run Count
                                            </p>
                                            <p className="text-xl font-bold">{dataset.runCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-sm">
                                                Avg Score
                                            </p>
                                            <p className="text-xl font-bold">
                                                {dataset.avgScore
                                                    ? `${(dataset.avgScore * 100).toFixed(1)}%`
                                                    : "N/A"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-sm">From</p>
                                            <p className="text-sm">
                                                {new Date(dataset.fromDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-sm">To</p>
                                            <p className="text-sm">
                                                {new Date(dataset.toDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground mb-2 text-sm">
                                            Dataset Hash
                                        </p>
                                        <code className="bg-muted block rounded p-2 text-xs">
                                            {dataset.datasetHash}
                                        </code>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground mb-2 text-sm">
                                            Included Runs ({dataset.runIds.length})
                                        </p>
                                        <div className="bg-muted max-h-60 overflow-auto rounded p-2">
                                            <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
                                                {dataset.runIds.map((runId) => (
                                                    <Link
                                                        key={runId}
                                                        href={`/agents/${agentSlug}/runs?runId=${runId}`}
                                                        className="text-primary font-mono text-xs hover:underline"
                                                    >
                                                        {runId.slice(0, 16)}...
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted-foreground py-8 text-center">
                                    No dataset information available
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Approval */}
            {approval && (
                <Card>
                    <CardHeader>
                        <CardTitle>Approval Decision</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <Badge
                                className={
                                    approval.decision === "approved" ||
                                    approval.decision === "auto_approved"
                                        ? "bg-green-500/20 text-green-600"
                                        : "bg-red-500/20 text-red-600"
                                }
                            >
                                {approval.decision}
                            </Badge>
                            {approval.autoApproved && (
                                <Badge variant="outline">Auto-approved</Badge>
                            )}
                            {approval.approvedBy && (
                                <span className="text-muted-foreground text-sm">
                                    by {approval.approvedBy}
                                </span>
                            )}
                            {approval.reviewedAt && (
                                <span className="text-muted-foreground text-sm">
                                    on {formatDate(approval.reviewedAt)}
                                </span>
                            )}
                        </div>
                        {approval.rationale && <p className="mt-2 text-sm">{approval.rationale}</p>}
                    </CardContent>
                </Card>
            )}

            {/* Approval Dialog */}
            <Dialog
                open={approvalDialog?.open || false}
                onOpenChange={(open) => {
                    if (!open) setApprovalDialog(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {approvalDialog?.action === "approve"
                                ? "Approve & Promote"
                                : "Reject Session"}
                        </DialogTitle>
                        <DialogDescription>
                            {approvalDialog?.action === "approve"
                                ? "This will promote the candidate version to production."
                                : "This will reject the session and discard the proposal."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApprovalDialog(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant={
                                approvalDialog?.action === "approve" ? "default" : "destructive"
                            }
                            onClick={() => {
                                if (approvalDialog) {
                                    handleApprovalAction(approvalDialog.action);
                                }
                            }}
                        >
                            {approvalDialog?.action === "approve" ? "Approve" : "Reject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
