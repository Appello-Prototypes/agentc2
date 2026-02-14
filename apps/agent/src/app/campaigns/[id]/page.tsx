"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Skeleton,
    Separator,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TaskDetail {
    id: string;
    name: string;
    status: string;
    taskType: string;
    taskVerb: string;
    sequence: number;
    assignedAgentId: string | null;
    costUsd: number | null;
    tokens: number | null;
    error: string | null;
    startedAt: string | null;
    completedAt: string | null;
    coordinatingInstructions: Record<string, unknown> | null;
    result: Record<string, unknown> | null;
    agentRun: {
        id: string;
        status: string;
        outputText: string | null;
        durationMs: number | null;
        costUsd: number | null;
        totalTokens: number | null;
        evaluation: {
            id: string;
            overallGrade: string | null;
            scoresJson: Record<string, number> | null;
            aarJson: Record<string, unknown> | null;
        } | null;
    } | null;
}

interface MissionDetail {
    id: string;
    name: string;
    status: string;
    missionStatement: string;
    priority: number;
    sequence: number;
    assignedAgentId: string | null;
    totalCostUsd: number;
    totalTokens: number;
    startedAt: string | null;
    completedAt: string | null;
    aarJson: Record<string, unknown> | null;
    tasks: TaskDetail[];
}

interface CampaignLog {
    id: string;
    event: string;
    message: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

interface CampaignDetail {
    id: string;
    slug: string;
    name: string;
    status: string;
    intent: string;
    endState: string;
    description: string | null;
    constraints: string[];
    restraints: string[];
    requireApproval: boolean;
    maxCostUsd: number | null;
    timeoutMinutes: number | null;
    totalCostUsd: number;
    totalTokens: number;
    progress: number;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    analysisOutput: Record<string, unknown> | null;
    executionPlan: Record<string, unknown> | null;
    aarJson: Record<string, unknown> | null;
    missions: MissionDetail[];
    logs: CampaignLog[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
    const colors: Record<string, string> = {
        COMPLETE: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
        EXECUTING: "bg-blue-500/10 text-blue-600 border-blue-200",
        RUNNING: "bg-blue-500/10 text-blue-600 border-blue-200",
        ANALYZING: "bg-amber-500/10 text-amber-600 border-amber-200",
        PLANNING: "bg-amber-500/10 text-amber-600 border-amber-200",
        READY: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
        PENDING: "bg-muted text-muted-foreground",
        FAILED: "bg-red-500/10 text-red-600 border-red-200",
        PAUSED: "bg-orange-500/10 text-orange-600 border-orange-200",
        REVIEWING: "bg-purple-500/10 text-purple-600 border-purple-200",
        SKIPPED: "bg-muted text-muted-foreground"
    };
    return colors[status] || "bg-muted text-muted-foreground";
}

function taskTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        ASSIGNED: "Assigned",
        IMPLIED: "Implied",
        ESSENTIAL: "Essential"
    };
    return labels[type] || type;
}

function taskTypeColor(type: string): string {
    const colors: Record<string, string> = {
        ASSIGNED: "bg-blue-50 text-blue-700 border-blue-200",
        IMPLIED: "bg-amber-50 text-amber-700 border-amber-200",
        ESSENTIAL: "bg-purple-50 text-purple-700 border-purple-200"
    };
    return colors[type] || "bg-muted text-muted-foreground";
}

function formatCost(usd: number): string {
    return `$${usd.toFixed(2)}`;
}

function formatDuration(ms: number | null): string {
    if (!ms) return "--";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

// ─── Components ──────────────────────────────────────────────────────────────

function AarPanel({ title, aar }: { title: string; aar: Record<string, unknown> | null }) {
    if (!aar) return null;

    const sustain = (aar.sustainPatterns || aar.sustain) as string[] | undefined;
    const improve = (aar.improvePatterns || aar.improve) as string[] | undefined;
    const lessons = aar.lessonsLearned as string[] | undefined;
    const summary = aar.summary as string | undefined;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
                {summary && <CardDescription>{summary}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {aar.intentAchieved !== undefined && (
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Intent Achieved</p>
                            <p
                                className={`text-sm font-medium ${aar.intentAchieved ? "text-emerald-600" : "text-red-600"}`}
                            >
                                {aar.intentAchieved ? "Yes" : "No"}
                            </p>
                        </div>
                    )}
                    {aar.endStateReached !== undefined && (
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">End State Reached</p>
                            <p
                                className={`text-sm font-medium ${aar.endStateReached ? "text-emerald-600" : "text-amber-600"}`}
                            >
                                {aar.endStateReached ? "Yes" : "Partial"}
                            </p>
                        </div>
                    )}
                    {typeof aar.avgTaskScore === "number" && (
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Avg Score</p>
                            <p
                                className={`text-sm font-medium ${(aar.avgTaskScore as number) >= 0.8 ? "text-emerald-600" : (aar.avgTaskScore as number) >= 0.5 ? "text-amber-600" : "text-red-600"}`}
                            >
                                {(aar.avgTaskScore as number).toFixed(2)}
                            </p>
                        </div>
                    )}
                    {typeof aar.totalCostUsd === "number" && (
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Total Cost</p>
                            <p className="text-sm font-medium">
                                {formatCost(aar.totalCostUsd as number)}
                            </p>
                        </div>
                    )}
                </div>

                {/* Sustain / Improve */}
                {sustain && sustain.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-emerald-700">
                            SUSTAIN (What Worked)
                        </p>
                        <ul className="space-y-1">
                            {sustain.map((s, i) => (
                                <li key={i} className="text-muted-foreground text-sm">
                                    <span className="mr-1.5 text-emerald-500">+</span>
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {improve && improve.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-amber-700">IMPROVE (What to Fix)</p>
                        <ul className="space-y-1">
                            {improve.map((s, i) => (
                                <li key={i} className="text-muted-foreground text-sm">
                                    <span className="mr-1.5 text-amber-500">-</span>
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {lessons && lessons.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-blue-700">LESSONS LEARNED</p>
                        <ul className="space-y-1">
                            {lessons.map((s, i) => (
                                <li key={i} className="text-muted-foreground text-sm">
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function MissionCard({ mission }: { mission: MissionDetail }) {
    const [expanded, setExpanded] = useState(
        mission.status === "EXECUTING" || mission.status === "REVIEWING"
    );

    const completedTasks = mission.tasks.filter((t) => t.status === "COMPLETE").length;
    const totalTasks = mission.tasks.length;

    return (
        <Card>
            <CardHeader className="cursor-pointer pb-3" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">
                            {expanded ? "▼" : "▶"}
                        </span>
                        <div>
                            <CardTitle className="text-base">{mission.name}</CardTitle>
                            <CardDescription className="mt-0.5">
                                {mission.missionStatement}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className={statusColor(mission.status)}>
                            {mission.status}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                            {completedTasks}/{totalTasks} tasks
                        </span>
                        {mission.totalCostUsd > 0 && (
                            <span className="text-muted-foreground text-xs">
                                {formatCost(mission.totalCostUsd)}
                            </span>
                        )}
                    </div>
                </div>
            </CardHeader>

            {expanded && (
                <CardContent className="space-y-3 pt-0">
                    {/* Task list */}
                    <div className="space-y-2">
                        {mission.tasks.map((task) => {
                            const agentSlug =
                                (task.coordinatingInstructions?.agentSlug as string) || "--";
                            const evalScore = task.agentRun?.evaluation?.scoresJson;
                            const avgScore = evalScore
                                ? Object.values(evalScore).reduce((a, b) => a + b, 0) /
                                  Object.values(evalScore).length
                                : null;

                            return (
                                <div
                                    key={task.id}
                                    className="bg-muted/30 flex items-center justify-between rounded-md px-3 py-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] ${statusColor(task.status)}`}
                                        >
                                            {task.status}
                                        </Badge>
                                        <span className="text-sm">{task.name}</span>
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] ${taskTypeColor(task.taskType)}`}
                                        >
                                            {taskTypeLabel(task.taskType)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground text-xs">
                                            {agentSlug}
                                        </span>
                                        {task.costUsd !== null && (
                                            <span className="text-muted-foreground text-xs">
                                                {formatCost(task.costUsd)}
                                            </span>
                                        )}
                                        {avgScore !== null && (
                                            <span
                                                className={`text-xs font-medium ${avgScore >= 0.8 ? "text-emerald-600" : avgScore >= 0.5 ? "text-amber-600" : "text-red-600"}`}
                                            >
                                                {avgScore.toFixed(2)}
                                            </span>
                                        )}
                                        {task.error && (
                                            <span
                                                className="text-xs text-red-500"
                                                title={task.error}
                                            >
                                                Error
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Mission AAR */}
                    {mission.aarJson && (
                        <>
                            <Separator />
                            <AarPanel title="Mission AAR" aar={mission.aarJson} />
                        </>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchCampaign = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/campaigns/${id}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setCampaign(data);
        } catch (err) {
            console.error("Failed to load campaign:", err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchCampaign();
        // Poll while campaign is active
        const interval = setInterval(fetchCampaign, 3000);
        return () => clearInterval(interval);
    }, [fetchCampaign]);

    const handleAction = async (action: string) => {
        setActionLoading(true);
        try {
            await fetch(`${getApiBase()}/api/campaigns/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            });
            await fetchCampaign();
        } catch (err) {
            console.error("Action failed:", err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Delete this campaign? This cannot be undone.")) return;
        try {
            await fetch(`${getApiBase()}/api/campaigns/${id}`, {
                method: "DELETE"
            });
            router.push("/campaigns");
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-6 p-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-60 w-full" />
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="mx-auto max-w-5xl p-6">
                <p className="text-muted-foreground">Campaign not found.</p>
            </div>
        );
    }

    const isActive = ["EXECUTING", "ANALYZING", "PLANNING", "REVIEWING"].includes(campaign.status);
    const isFinished = ["COMPLETE", "FAILED"].includes(campaign.status);

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => router.push("/campaigns")}
                    className="text-muted-foreground hover:text-foreground mb-4 text-sm transition-colors"
                >
                    &larr; Back to Campaigns
                </button>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {campaign.name}
                            </h1>
                            <Badge variant="outline" className={statusColor(campaign.status)}>
                                {campaign.status}
                            </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                            {campaign.intent}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {campaign.status === "READY" && (
                            <Button
                                onClick={() => handleAction("approve")}
                                disabled={actionLoading}
                            >
                                Approve & Execute
                            </Button>
                        )}
                        {campaign.status === "PAUSED" && (
                            <Button onClick={() => handleAction("resume")} disabled={actionLoading}>
                                Resume
                            </Button>
                        )}
                        {!isFinished && (
                            <Button
                                variant="outline"
                                onClick={() => handleAction("cancel")}
                                disabled={actionLoading}
                            >
                                Cancel
                            </Button>
                        )}
                        {isFinished && (
                            <Button variant="outline" onClick={handleDelete}>
                                Delete
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Status bar */}
            <Card>
                <CardContent className="py-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Progress</p>
                            <div className="flex items-center gap-2">
                                <div className="bg-muted h-2 flex-1 rounded-full">
                                    <div
                                        className="h-2 rounded-full bg-blue-500 transition-all"
                                        style={{
                                            width: `${Math.min(campaign.progress, 100)}%`
                                        }}
                                    />
                                </div>
                                <span className="text-sm font-medium">
                                    {Math.round(campaign.progress)}%
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Cost</p>
                            <p className="text-sm font-medium">
                                {formatCost(campaign.totalCostUsd)}
                                {campaign.maxCostUsd ? ` / ${formatCost(campaign.maxCostUsd)}` : ""}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Tokens</p>
                            <p className="text-sm font-medium">
                                {campaign.totalTokens.toLocaleString()}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Missions</p>
                            <p className="text-sm font-medium">
                                {campaign.missions.filter((m) => m.status === "COMPLETE").length}/
                                {campaign.missions.length}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs">Duration</p>
                            <p className="text-sm font-medium">
                                {campaign.startedAt
                                    ? formatDuration(
                                          (campaign.completedAt
                                              ? new Date(campaign.completedAt).getTime()
                                              : Date.now()) - new Date(campaign.startedAt).getTime()
                                      )
                                    : "--"}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="execution">
                <TabsList>
                    <TabsTrigger value="execution">Execution</TabsTrigger>
                    <TabsTrigger value="aar">Campaign AAR</TabsTrigger>
                    <TabsTrigger value="plan">Plan</TabsTrigger>
                    <TabsTrigger value="logs">Activity Log</TabsTrigger>
                </TabsList>

                {/* Execution Tab */}
                <TabsContent value="execution" className="mt-4 space-y-4">
                    {campaign.missions.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="text-muted-foreground text-sm">
                                    {isActive
                                        ? "Analyzing campaign and decomposing into missions..."
                                        : "No missions yet."}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        campaign.missions.map((mission) => (
                            <MissionCard key={mission.id} mission={mission} />
                        ))
                    )}
                </TabsContent>

                {/* Campaign AAR Tab */}
                <TabsContent value="aar" className="mt-4">
                    {campaign.aarJson ? (
                        <AarPanel title="Campaign After Action Review" aar={campaign.aarJson} />
                    ) : (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="text-muted-foreground text-sm">
                                    {isFinished
                                        ? "AAR is being generated..."
                                        : "Campaign AAR will be available after completion."}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Plan Tab */}
                <TabsContent value="plan" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Campaign Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-muted-foreground text-xs">End State</p>
                                <p className="text-sm">{campaign.endState}</p>
                            </div>
                            {campaign.description && (
                                <div className="space-y-1">
                                    <p className="text-muted-foreground text-xs">Description</p>
                                    <p className="text-sm">{campaign.description}</p>
                                </div>
                            )}
                            {campaign.constraints.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-muted-foreground text-xs">Constraints</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {campaign.constraints.map((c, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="bg-blue-50 text-blue-700"
                                            >
                                                {c}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {campaign.restraints.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-muted-foreground text-xs">Restraints</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {campaign.restraints.map((r, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="bg-red-50 text-red-700"
                                            >
                                                {r}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {campaign.executionPlan && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Execution Plan</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="text-muted-foreground max-h-96 overflow-auto rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-900">
                                    {JSON.stringify(campaign.executionPlan, null, 2)}
                                </pre>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Activity Log Tab */}
                <TabsContent value="logs" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Activity Log</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {campaign.logs.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No activity yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {campaign.logs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="flex items-start gap-3 border-b py-2 last:border-0"
                                        >
                                            <span className="text-muted-foreground mt-0.5 shrink-0 text-xs">
                                                {formatTime(log.createdAt)}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="shrink-0 text-[10px]"
                                            >
                                                {log.event}
                                            </Badge>
                                            <span className="text-sm">{log.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
