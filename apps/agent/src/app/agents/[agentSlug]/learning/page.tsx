"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
interface LearningSession {
    id: string;
    status: string;
    runCount: number;
    datasetHash: string | null;
    baselineVersion: number | null;
    signalCount: number;
    proposalCount: number;
    experimentCount: number;
    avgScore: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    completedAt: string | null;
}

interface LearningMetrics {
    summary: {
        totalSessions: number;
        activeSessions: number;
        promotedSessions: number;
        rejectedSessions: number;
        failedSessions: number;
        promotionRate: number;
        totalProposals: number;
        totalExperiments: number;
        experimentPassRate: number;
        avgImprovementPct: number;
        avgTimeToImproveHours: number;
        evalCoverage: number;
    };
}

interface LearningPolicy {
    id: string;
    enabled: boolean;
    autoPromotionEnabled: boolean;
    scheduledEnabled: boolean;
    thresholdEnabled: boolean;
    paused: boolean;
    pausedUntil: string | null;
    signalThreshold: number | null;
    signalWindowMinutes: number | null;
    trafficSplitCandidate: number | null;
    minConfidenceForAuto: number | null;
    minWinRateForAuto: number | null;
}

interface ActiveExperiment {
    id: string;
    status: string;
    proposalTitle: string;
    riskTier: string | null;
    autoEligible: boolean;
    trafficSplit: { baseline?: number; candidate?: number } | null;
    shadowRunCount: number;
    baselineRunCount: number;
    candidateRunCount: number;
    winRate: number | null;
    startedAt: string | null;
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
    FAILED: "bg-red-500/20 text-red-600"
};

export default function LearningPage() {
    const params = useParams();
    const router = useRouter();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sessions, setSessions] = useState<LearningSession[]>([]);
    const [metrics, setMetrics] = useState<LearningMetrics | null>(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [startingSession, setStartingSession] = useState(false);
    const [approvalDialog, setApprovalDialog] = useState<{
        open: boolean;
        sessionId: string;
        action: "approve" | "reject";
    } | null>(null);
    const [statusMessage, setStatusMessage] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [policy, setPolicy] = useState<LearningPolicy | null>(null);
    const [activeExperiments, setActiveExperiments] = useState<ActiveExperiment[]>([]);
    const [savingPolicy, setSavingPolicy] = useState(false);
    const [cancellingSession, setCancellingSession] = useState(false);

    // Navigate to session detail page
    const navigateToSession = (sessionId: string) => {
        router.push(`/agents/${agentSlug}/learning/${sessionId}`);
    };

    // Get the active session if any
    const activeSession = sessions.find((s) =>
        ["COLLECTING", "ANALYZING", "PROPOSING", "TESTING", "AWAITING_APPROVAL"].includes(s.status)
    );

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [sessionsRes, metricsRes, policyRes, experimentsRes] = await Promise.all([
                fetch(`${getApiBase()}/api/agents/${agentSlug}/learning`),
                fetch(`${getApiBase()}/api/agents/${agentSlug}/learning/metrics`),
                fetch(`${getApiBase()}/api/agents/${agentSlug}/learning/policy`),
                fetch(`${getApiBase()}/api/agents/${agentSlug}/learning/experiments?status=active`)
            ]);

            const sessionsData = await sessionsRes.json();
            const metricsData = await metricsRes.json();
            const policyData = await policyRes.json();
            const experimentsData = await experimentsRes.json();

            if (!sessionsData.success) {
                throw new Error(sessionsData.error || "Failed to fetch sessions");
            }

            setSessions(sessionsData.sessions || []);
            if (metricsData.success) {
                setMetrics(metricsData.metrics);
            }
            if (policyData.success) {
                setPolicy(policyData.policy);
            }
            if (experimentsData.success) {
                setActiveExperiments(experimentsData.experiments || []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load learning data");
        } finally {
            setLoading(false);
        }
    }, [agentSlug]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updatePolicy = useCallback(
        async (updates: Partial<LearningPolicy>) => {
            try {
                setSavingPolicy(true);
                setStatusMessage(null);

                const response = await fetch(
                    `${getApiBase()}/api/agents/${agentSlug}/learning/policy`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...updates, updatedBy: "current-user" })
                    }
                );

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || "Failed to update policy");
                }

                setPolicy(data.policy);
                setStatusMessage({
                    type: "success",
                    message: "Policy updated successfully"
                });
            } catch (err) {
                setStatusMessage({
                    type: "error",
                    message: err instanceof Error ? err.message : "Failed to update policy"
                });
            } finally {
                setSavingPolicy(false);
                setTimeout(() => setStatusMessage(null), 3000);
            }
        },
        [agentSlug]
    );

    const togglePause = useCallback(
        async (paused: boolean) => {
            try {
                const response = await fetch(
                    `${getApiBase()}/api/agents/${agentSlug}/learning/pause`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            paused,
                            actorId: "current-user",
                            reason: paused ? "Manual pause via UI" : "Manual resume via UI"
                        })
                    }
                );

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || "Failed to toggle pause");
                }

                setPolicy((prev) => (prev ? { ...prev, paused: data.paused } : null));
                setStatusMessage({
                    type: "success",
                    message: data.message
                });
            } catch (err) {
                setStatusMessage({
                    type: "error",
                    message: err instanceof Error ? err.message : "Failed to toggle pause"
                });
            } finally {
                setTimeout(() => setStatusMessage(null), 3000);
            }
        },
        [agentSlug]
    );

    const startLearningSession = useCallback(async () => {
        try {
            setStartingSession(true);
            setStatusMessage(null);

            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/learning`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ triggerReason: "Manual trigger via UI" })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to start learning session");
            }

            // Navigate to the session detail page for monitoring
            if (data.sessionId) {
                router.push(`/agents/${agentSlug}/learning/${data.sessionId}`);
            } else {
                // Fallback: switch to sessions tab and refresh
                setActiveTab("sessions");
                fetchData();
            }
        } catch (err) {
            setStatusMessage({
                type: "error",
                message: err instanceof Error ? err.message : "Failed to start session"
            });
            setStartingSession(false);
            setTimeout(() => setStatusMessage(null), 5000);
        }
    }, [agentSlug, fetchData, router]);

    const cancelLearningSession = useCallback(
        async (sessionId: string) => {
            try {
                setCancellingSession(true);
                setStatusMessage(null);

                const response = await fetch(
                    `${getApiBase()}/api/agents/${agentSlug}/learning/${sessionId}`,
                    {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: "Cancelled via UI" })
                    }
                );

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || "Failed to cancel session");
                }

                setStatusMessage({
                    type: "success",
                    message: "Learning session cancelled"
                });

                // Refresh data
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
        },
        [agentSlug, fetchData]
    );

    const handleApprovalAction = useCallback(
        async (sessionId: string, action: "approve" | "reject", rationale?: string) => {
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
        [agentSlug, fetchData]
    );

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Closed-Loop Learning</h1>
                    <p className="text-muted-foreground">
                        Autonomous improvement through signals, proposals, and experiments
                    </p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={fetchData}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const summary = metrics?.summary;
    const hasActiveSession = sessions.some((s) =>
        ["COLLECTING", "ANALYZING", "PROPOSING", "TESTING", "AWAITING_APPROVAL"].includes(s.status)
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Closed-Loop Learning</h1>
                    <p className="text-muted-foreground">
                        Autonomous improvement through signals, proposals, and experiments
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {statusMessage && (
                        <span
                            className={`text-sm ${statusMessage.type === "error" ? "text-destructive" : "text-green-600"}`}
                        >
                            {statusMessage.message}
                        </span>
                    )}
                    {activeSession && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigateToSession(activeSession.id)}
                            >
                                View Active Session
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => cancelLearningSession(activeSession.id)}
                                disabled={cancellingSession}
                            >
                                {cancellingSession ? "Cancelling..." : "Cancel Session"}
                            </Button>
                        </>
                    )}
                    <Button
                        onClick={startLearningSession}
                        disabled={startingSession || hasActiveSession}
                    >
                        {startingSession
                            ? "Starting..."
                            : hasActiveSession
                              ? "Session Active"
                              : "Start Learning Session"}
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Sessions Promoted</CardDescription>
                            <CardTitle className="text-2xl">{summary.promotedSessions}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-xs">
                                {summary.promotionRate}% promotion rate
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Avg Improvement</CardDescription>
                            <CardTitle className="text-2xl">
                                {summary.avgImprovementPct > 0 ? "+" : ""}
                                {summary.avgImprovementPct}%
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-xs">Quality score gain</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Experiment Pass Rate</CardDescription>
                            <CardTitle className="text-2xl">
                                {summary.experimentPassRate}%
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-xs">
                                {summary.totalExperiments} experiments run
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Eval Coverage</CardDescription>
                            <CardTitle className="text-2xl">{summary.evalCoverage}%</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-xs">Runs with evaluations</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Tabs
                defaultValue="overview"
                value={activeTab}
                onValueChange={(v) => v && setActiveTab(v)}
            >
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="pending">Pending Approval</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Recent Sessions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Sessions</CardTitle>
                                <CardDescription>Latest learning activity</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {sessions.length === 0 ? (
                                    <p className="text-muted-foreground py-4 text-center text-sm">
                                        No learning sessions yet
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {sessions.slice(0, 5).map((session) => (
                                            <div
                                                key={session.id}
                                                className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                                                onClick={() => navigateToSession(session.id)}
                                            >
                                                <Badge
                                                    className={
                                                        statusColors[session.status] ||
                                                        "bg-gray-500/20 text-gray-600"
                                                    }
                                                >
                                                    {session.status}
                                                </Badge>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm">
                                                        {session.signalCount} signals,{" "}
                                                        {session.proposalCount} proposals
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {new Date(
                                                            session.createdAt
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                                {session.avgScore && (
                                                    <span className="text-sm font-medium">
                                                        {(session.avgScore * 100).toFixed(0)}%
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Learning Pipeline */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Learning Pipeline</CardTitle>
                                <CardDescription>
                                    DeepMind-inspired closed-loop learning
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-600">
                                            1
                                        </div>
                                        <div>
                                            <p className="font-medium">Signal Detection</p>
                                            <p className="text-muted-foreground text-xs">
                                                Low scores, tool failures, negative feedback
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-sm font-bold text-purple-600">
                                            2
                                        </div>
                                        <div>
                                            <p className="font-medium">Proposal Generation</p>
                                            <p className="text-muted-foreground text-xs">
                                                AI-generated instruction improvements
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20 text-sm font-bold text-yellow-600">
                                            3
                                        </div>
                                        <div>
                                            <p className="font-medium">A/B Testing</p>
                                            <p className="text-muted-foreground text-xs">
                                                Baseline vs candidate comparison
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-600">
                                            4
                                        </div>
                                        <div>
                                            <p className="font-medium">Human Approval</p>
                                            <p className="text-muted-foreground text-xs">
                                                Review and approve promotions
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-600">
                                            5
                                        </div>
                                        <div>
                                            <p className="font-medium">Version Promotion</p>
                                            <p className="text-muted-foreground text-xs">
                                                Deploy improved agent version
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Sessions Tab */}
                <TabsContent value="sessions">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Learning Sessions</CardTitle>
                            <CardDescription>Complete history of learning cycles</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {sessions.length === 0 ? (
                                <p className="text-muted-foreground py-8 text-center">
                                    No learning sessions yet
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="px-4 py-3 text-left font-medium">
                                                    Status
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Runs
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Signals
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Proposals
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Avg Score
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Created
                                                </th>
                                                <th className="px-4 py-3 text-right font-medium">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sessions.map((session) => (
                                                <tr
                                                    key={session.id}
                                                    className="hover:bg-muted/50 border-b"
                                                >
                                                    <td className="px-4 py-3">
                                                        <Badge
                                                            className={
                                                                statusColors[session.status] ||
                                                                "bg-gray-500/20 text-gray-600"
                                                            }
                                                        >
                                                            {session.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono">
                                                        {session.runCount}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono">
                                                        {session.signalCount}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono">
                                                        {session.proposalCount}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono">
                                                        {session.avgScore
                                                            ? `${(session.avgScore * 100).toFixed(0)}%`
                                                            : "-"}
                                                    </td>
                                                    <td className="text-muted-foreground px-4 py-3 text-right text-sm">
                                                        {new Date(
                                                            session.createdAt
                                                        ).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                navigateToSession(session.id)
                                                            }
                                                        >
                                                            View
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Pending Approval Tab */}
                <TabsContent value="pending">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Approvals</CardTitle>
                            <CardDescription>Sessions awaiting human review</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {sessions.filter((s) => s.status === "AWAITING_APPROVAL").length ===
                            0 ? (
                                <p className="text-muted-foreground py-8 text-center">
                                    No sessions pending approval
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {sessions
                                        .filter((s) => s.status === "AWAITING_APPROVAL")
                                        .map((session) => (
                                            <div key={session.id} className="rounded-lg border p-4">
                                                <div className="mb-4 flex items-start justify-between">
                                                    <div>
                                                        <p className="font-medium">
                                                            Learning Session
                                                        </p>
                                                        <p className="text-muted-foreground text-sm">
                                                            {session.runCount} runs analyzed,{" "}
                                                            {session.signalCount} signals,{" "}
                                                            {session.proposalCount} proposals
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        className={statusColors.AWAITING_APPROVAL}
                                                    >
                                                        Awaiting Approval
                                                    </Badge>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            navigateToSession(session.id)
                                                        }
                                                    >
                                                        View Details
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            setApprovalDialog({
                                                                open: true,
                                                                sessionId: session.id,
                                                                action: "approve"
                                                            })
                                                        }
                                                    >
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() =>
                                                            setApprovalDialog({
                                                                open: true,
                                                                sessionId: session.id,
                                                                action: "reject"
                                                            })
                                                        }
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Continuous Learning Status */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Continuous Learning Status</CardTitle>
                                <CardDescription>
                                    Current state of the learning system
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span>Learning Enabled</span>
                                    <Badge
                                        className={
                                            policy?.enabled !== false
                                                ? "bg-green-500/20 text-green-600"
                                                : "bg-red-500/20 text-red-600"
                                        }
                                    >
                                        {policy?.enabled !== false ? "Enabled" : "Disabled"}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Learning Paused</span>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            className={
                                                policy?.paused
                                                    ? "bg-yellow-500/20 text-yellow-600"
                                                    : "bg-green-500/20 text-green-600"
                                            }
                                        >
                                            {policy?.paused ? "Paused" : "Active"}
                                        </Badge>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => togglePause(!policy?.paused)}
                                        >
                                            {policy?.paused ? "Resume" : "Pause"}
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Active Experiments</span>
                                    <Badge variant="outline">{activeExperiments.length}</Badge>
                                </div>
                                {activeExperiments.length > 0 && (
                                    <div className="mt-4 space-y-2 rounded border p-3">
                                        <p className="text-sm font-medium">Current Experiment</p>
                                        <p className="text-muted-foreground text-sm">
                                            {activeExperiments[0].proposalTitle}
                                        </p>
                                        <div className="flex gap-4 text-xs">
                                            <span>
                                                Baseline: {activeExperiments[0].baselineRunCount}
                                            </span>
                                            <span>
                                                Candidate: {activeExperiments[0].candidateRunCount}
                                            </span>
                                            <span>
                                                Split:{" "}
                                                {(
                                                    (activeExperiments[0].trafficSplit?.candidate ||
                                                        0.1) * 100
                                                ).toFixed(0)}
                                                %
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Policy Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Policy Settings</CardTitle>
                                <CardDescription>
                                    Configure continuous learning behavior
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Auto-Promotion</p>
                                        <p className="text-muted-foreground text-xs">
                                            Auto-promote low-risk changes
                                        </p>
                                    </div>
                                    <Button
                                        variant={
                                            policy?.autoPromotionEnabled ? "default" : "outline"
                                        }
                                        size="sm"
                                        disabled={savingPolicy}
                                        onClick={() =>
                                            updatePolicy({
                                                autoPromotionEnabled: !policy?.autoPromotionEnabled
                                            })
                                        }
                                    >
                                        {policy?.autoPromotionEnabled ? "Enabled" : "Disabled"}
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Scheduled Triggers</p>
                                        <p className="text-muted-foreground text-xs">
                                            Run learning on a schedule
                                        </p>
                                    </div>
                                    <Button
                                        variant={policy?.scheduledEnabled ? "default" : "outline"}
                                        size="sm"
                                        disabled={savingPolicy}
                                        onClick={() =>
                                            updatePolicy({
                                                scheduledEnabled: !policy?.scheduledEnabled
                                            })
                                        }
                                    >
                                        {policy?.scheduledEnabled !== false
                                            ? "Enabled"
                                            : "Disabled"}
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Threshold Triggers</p>
                                        <p className="text-muted-foreground text-xs">
                                            Trigger on signal thresholds
                                        </p>
                                    </div>
                                    <Button
                                        variant={policy?.thresholdEnabled ? "default" : "outline"}
                                        size="sm"
                                        disabled={savingPolicy}
                                        onClick={() =>
                                            updatePolicy({
                                                thresholdEnabled: !policy?.thresholdEnabled
                                            })
                                        }
                                    >
                                        {policy?.thresholdEnabled !== false
                                            ? "Enabled"
                                            : "Disabled"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Active Experiments */}
                    {activeExperiments.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Experiments</CardTitle>
                                <CardDescription>
                                    Shadow A/B tests currently running
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {activeExperiments.map((exp) => (
                                        <div
                                            key={exp.id}
                                            className="flex items-center justify-between rounded border p-3"
                                        >
                                            <div>
                                                <p className="font-medium">{exp.proposalTitle}</p>
                                                <p className="text-muted-foreground text-sm">
                                                    Risk:{" "}
                                                    <Badge
                                                        variant={
                                                            exp.riskTier === "LOW"
                                                                ? "default"
                                                                : exp.riskTier === "HIGH"
                                                                  ? "destructive"
                                                                  : "secondary"
                                                        }
                                                    >
                                                        {exp.riskTier || "Unknown"}
                                                    </Badge>
                                                    {exp.autoEligible && (
                                                        <Badge className="ml-2 bg-blue-500/20 text-blue-600">
                                                            Auto-eligible
                                                        </Badge>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="text-right text-sm">
                                                <p>{exp.shadowRunCount} total runs</p>
                                                <p className="text-muted-foreground text-xs">
                                                    {exp.baselineRunCount} baseline /{" "}
                                                    {exp.candidateRunCount} candidate
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

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
                                    handleApprovalAction(
                                        approvalDialog.sessionId,
                                        approvalDialog.action
                                    );
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
