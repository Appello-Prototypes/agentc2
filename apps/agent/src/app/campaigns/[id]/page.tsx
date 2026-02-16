"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    TabsTrigger,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
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

interface GeneratedResource {
    slug: string;
    name: string;
    id: string;
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
    generatedResources: {
        agents?: GeneratedResource[];
        skills?: GeneratedResource[];
    } | null;
    missions: MissionDetail[];
    logs: CampaignLog[];
    logCount: number;
}

interface PhaseInfo {
    key: string;
    label: string;
    event: string; // log event that marks completion
    startEvent?: string;
    agentSlug?: string;
    runId?: string;
    status: "not_started" | "running" | "complete" | "failed";
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
        REWORK: "bg-orange-500/10 text-orange-600 border-orange-200",
        AWAITING_APPROVAL: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
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
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function getTaskAvgScore(task: TaskDetail): number | null {
    const evalScore = task.agentRun?.evaluation?.scoresJson;
    if (!evalScore) return null;
    const vals = Object.values(evalScore);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function getAgentSlug(task: TaskDetail): string {
    return (task.coordinatingInstructions?.agentSlug as string) || "--";
}

/** Extract phase information from campaign logs */
function extractPhases(campaign: CampaignDetail): PhaseInfo[] {
    const logs = campaign.logs;

    function findLog(event: string) {
        return logs.find((l) => l.event === event);
    }

    function phaseStatus(
        completeEvent: string,
        runningStatuses: string[],
        failEvent?: string
    ): "not_started" | "running" | "complete" | "failed" {
        if (findLog(completeEvent)) return "complete";
        if (failEvent && findLog(failEvent)) return "failed";
        if (runningStatuses.includes(campaign.status)) return "running";
        return "not_started";
    }

    const analyzed = findLog("analyzed");
    const planned = findLog("planned");
    const built = findLog("capabilities_built");
    const buildStarted = findLog("capability_build_failed") || built;

    const phases: PhaseInfo[] = [
        {
            key: "analysis",
            label: "Analysis",
            event: "analyzed",
            startEvent: "analyzing",
            agentSlug: (analyzed?.metadata?.agentSlug as string) || "campaign-analyst",
            runId: analyzed?.metadata?.runId as string | undefined,
            status: phaseStatus("analyzed", ["ANALYZING"])
        },
        {
            key: "planning",
            label: "Planning",
            event: "planned",
            agentSlug: (planned?.metadata?.agentSlug as string) || "campaign-planner",
            runId: planned?.metadata?.runId as string | undefined,
            status: phaseStatus("planned", ["PLANNING"])
        }
    ];

    // Only show build phase if it was triggered
    if (buildStarted) {
        phases.push({
            key: "build",
            label: "Build Capabilities",
            event: "capabilities_built",
            agentSlug: (built?.metadata?.agentSlug as string) || "campaign-architect",
            runId: built?.metadata?.runId as string | undefined,
            status: built ? "complete" : "failed"
        });
    }

    const executionStatus = (() => {
        if (["COMPLETE", "REVIEWING"].includes(campaign.status)) return "complete" as const;
        if (campaign.status === "EXECUTING") return "running" as const;
        if (campaign.status === "FAILED" && findLog("executing")) return "failed" as const;
        return "not_started" as const;
    })();

    phases.push({
        key: "execution",
        label: "Execution",
        event: "executing",
        status: executionStatus
    });

    const campaignAar = findLog("campaign_aar");
    phases.push({
        key: "review",
        label: "Review",
        event: "campaign_aar",
        agentSlug: (campaignAar?.metadata?.agentSlug as string) || "campaign-reviewer",
        runId: campaignAar?.metadata?.runId as string | undefined,
        status: phaseStatus("campaign_aar", ["REVIEWING"])
    });

    return phases;
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

// ─── Phase Timeline ──────────────────────────────────────────────────────────

function PhaseTimeline({ phases }: { phases: PhaseInfo[] }) {
    const phaseColors: Record<string, string> = {
        not_started: "bg-muted border-muted-foreground/20",
        running: "bg-blue-500/20 border-blue-400 ring-2 ring-blue-400/30",
        complete: "bg-emerald-500/20 border-emerald-400",
        failed: "bg-red-500/20 border-red-400"
    };
    const dotColors: Record<string, string> = {
        not_started: "bg-muted-foreground/30",
        running: "bg-blue-500 animate-pulse",
        complete: "bg-emerald-500",
        failed: "bg-red-500"
    };

    return (
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {phases.map((phase, i) => (
                <div key={phase.key} className="flex items-center">
                    <div
                        className={`flex min-w-[120px] flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 ${phaseColors[phase.status]}`}
                    >
                        <div className={`h-2.5 w-2.5 rounded-full ${dotColors[phase.status]}`} />
                        <span className="text-xs font-medium">{phase.label}</span>
                        {phase.runId && phase.agentSlug && (
                            <Link
                                href={`/agents/${phase.agentSlug}/runs?run=${phase.runId}`}
                                className="text-[10px] text-blue-600 underline-offset-2 hover:underline"
                            >
                                View Run
                            </Link>
                        )}
                    </div>
                    {i < phases.length - 1 && (
                        <div className="text-muted-foreground mx-1 text-xs">&rarr;</div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Budget Gauge ────────────────────────────────────────────────────────────

function BudgetGauge({ spent, budget }: { spent: number; budget: number | null }) {
    if (!budget) {
        return (
            <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Budget</p>
                <p className="text-sm font-medium">{formatCost(spent)} (no limit)</p>
            </div>
        );
    }

    const pct = Math.min((spent / budget) * 100, 100);
    const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs">Budget</p>
                <p className="text-xs font-medium">
                    {formatCost(spent)} / {formatCost(budget)}
                </p>
            </div>
            <div className="bg-muted h-2 rounded-full">
                <div
                    className={`h-2 rounded-full transition-all ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

// ─── Mission Card ────────────────────────────────────────────────────────────

function MissionCard({ mission }: { mission: MissionDetail }) {
    const [expanded, setExpanded] = useState(
        mission.status === "EXECUTING" || mission.status === "REVIEWING"
    );

    const completedTasks = mission.tasks.filter((t) => t.status === "COMPLETE").length;
    const totalTasks = mission.tasks.length;
    const progressPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return (
        <Card>
            <CardHeader className="cursor-pointer pb-3" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">
                            {expanded ? "▼" : "▶"}
                        </span>
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-base">{mission.name}</CardTitle>
                            <CardDescription className="mt-0.5">
                                {mission.missionStatement}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
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
                {/* Progress bar */}
                <div className="bg-muted mt-2 h-1.5 rounded-full">
                    <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </CardHeader>

            {expanded && (
                <CardContent className="space-y-3 pt-0">
                    <div className="space-y-2">
                        {mission.tasks.map((task) => {
                            const agentSlug = getAgentSlug(task);
                            const avgScore = getTaskAvgScore(task);

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
                                        {task.agentRun && (
                                            <Link
                                                href={`/agents/${agentSlug}/runs?run=${task.agentRun.id}`}
                                                className="text-[10px] text-blue-600 hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                trace
                                            </Link>
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

// ─── Task Table (flat view across all missions) ──────────────────────────────

function TaskTable({ missions }: { missions: MissionDetail[] }) {
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    const allTasks = useMemo(() => {
        const tasks: Array<TaskDetail & { missionName: string; missionId: string }> = [];
        for (const m of missions) {
            for (const t of m.tasks) {
                tasks.push({ ...t, missionName: m.name, missionId: m.id });
            }
        }
        return tasks;
    }, [missions]);

    const filtered = useMemo(() => {
        return allTasks.filter((t) => {
            if (statusFilter !== "all" && t.status !== statusFilter) return false;
            if (typeFilter !== "all" && t.taskType !== typeFilter) return false;
            return true;
        });
    }, [allTasks, statusFilter, typeFilter]);

    const statuses = useMemo(() => [...new Set(allTasks.map((t) => t.status))], [allTasks]);
    const types = useMemo(() => [...new Set(allTasks.map((t) => t.taskType))], [allTasks]);

    if (allTasks.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground text-sm">No tasks yet.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {/* Filters */}
            <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {statuses.map((s) => (
                            <SelectItem key={s} value={s}>
                                {s}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {types.map((t) => (
                            <SelectItem key={t} value={t}>
                                {taskTypeLabel(t)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="text-muted-foreground text-xs">
                    {filtered.length} of {allTasks.length} tasks
                </span>
            </div>

            {/* Task rows */}
            <div className="space-y-1">
                {filtered.map((task) => {
                    const agentSlug = getAgentSlug(task);
                    const avgScore = getTaskAvgScore(task);
                    const isExpanded = expandedTaskId === task.id;
                    const duration =
                        task.startedAt && task.completedAt
                            ? new Date(task.completedAt).getTime() -
                              new Date(task.startedAt).getTime()
                            : null;

                    return (
                        <Card key={task.id} className="overflow-hidden">
                            <div
                                className="flex cursor-pointer items-center gap-3 px-4 py-2.5"
                                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                            >
                                <span className="text-muted-foreground text-[10px]">
                                    {isExpanded ? "▼" : "▶"}
                                </span>
                                <Badge
                                    variant="outline"
                                    className={`shrink-0 text-[10px] ${statusColor(task.status)}`}
                                >
                                    {task.status}
                                </Badge>
                                <span className="min-w-0 flex-1 truncate text-sm">{task.name}</span>
                                <span className="text-muted-foreground hidden shrink-0 text-xs sm:block">
                                    {task.missionName}
                                </span>
                                <Badge
                                    variant="outline"
                                    className={`shrink-0 text-[10px] ${taskTypeColor(task.taskType)}`}
                                >
                                    {taskTypeLabel(task.taskType)}
                                </Badge>
                                <span className="text-muted-foreground shrink-0 text-xs">
                                    {agentSlug}
                                </span>
                                {task.costUsd !== null && (
                                    <span className="text-muted-foreground shrink-0 text-xs">
                                        {formatCost(task.costUsd)}
                                    </span>
                                )}
                                {duration !== null && (
                                    <span className="text-muted-foreground shrink-0 text-xs">
                                        {formatDuration(duration)}
                                    </span>
                                )}
                                {avgScore !== null && (
                                    <span
                                        className={`shrink-0 text-xs font-medium ${avgScore >= 0.8 ? "text-emerald-600" : avgScore >= 0.5 ? "text-amber-600" : "text-red-600"}`}
                                    >
                                        {avgScore.toFixed(2)}
                                    </span>
                                )}
                            </div>

                            {isExpanded && (
                                <div className="border-t px-4 py-3">
                                    <div className="space-y-3">
                                        {task.error && (
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-red-600">
                                                    Error
                                                </p>
                                                <p className="text-xs text-red-500">{task.error}</p>
                                            </div>
                                        )}
                                        {task.agentRun && (
                                            <div className="flex items-center gap-4">
                                                <Link
                                                    href={`/agents/${agentSlug}/runs?run=${task.agentRun.id}`}
                                                    className="text-xs text-blue-600 hover:underline"
                                                >
                                                    View Agent Run Trace
                                                </Link>
                                                {task.agentRun.durationMs && (
                                                    <span className="text-muted-foreground text-xs">
                                                        Duration:{" "}
                                                        {formatDuration(task.agentRun.durationMs)}
                                                    </span>
                                                )}
                                                {task.agentRun.totalTokens && (
                                                    <span className="text-muted-foreground text-xs">
                                                        Tokens:{" "}
                                                        {task.agentRun.totalTokens.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {(task.result as Record<string, unknown>)?.output ? (
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground text-xs font-medium">
                                                    Task Output
                                                </p>
                                                <div className="text-foreground prose prose-sm dark:prose-invert max-h-96 max-w-none overflow-auto rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-900">
                                                    <pre className="font-sans text-xs leading-relaxed whitespace-pre-wrap">
                                                        {String(
                                                            (task.result as Record<string, unknown>)
                                                                .output
                                                        )}
                                                    </pre>
                                                </div>
                                            </div>
                                        ) : task.result ? (
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground text-xs font-medium">
                                                    Result Data
                                                </p>
                                                <pre className="text-muted-foreground max-h-60 overflow-auto rounded-md bg-gray-50 p-2 text-xs dark:bg-gray-900">
                                                    {JSON.stringify(task.result, null, 2)}
                                                </pre>
                                            </div>
                                        ) : null}
                                        {task.agentRun?.outputText &&
                                            !(task.result as Record<string, unknown>)?.output && (
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground text-xs font-medium">
                                                        Agent Output
                                                    </p>
                                                    <div className="text-foreground max-h-96 overflow-auto rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-900">
                                                        <pre className="font-sans text-xs leading-relaxed whitespace-pre-wrap">
                                                            {task.agentRun.outputText}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Phase Cards ─────────────────────────────────────────────────────────────

function PhaseCards({ phases, logs }: { phases: PhaseInfo[]; logs: CampaignLog[] }) {
    // Also extract mission-level AARs
    const missionAarLogs = logs.filter((l) => l.event === "mission_aar");

    return (
        <div className="space-y-3">
            {phases.map((phase) => {
                const statusStyle: Record<string, string> = {
                    not_started: "border-muted-foreground/20",
                    running: "border-blue-400 bg-blue-500/5",
                    complete: "border-emerald-400 bg-emerald-500/5",
                    failed: "border-red-400 bg-red-500/5"
                };
                const statusLabel: Record<string, string> = {
                    not_started: "Not Started",
                    running: "Running",
                    complete: "Complete",
                    failed: "Failed"
                };

                return (
                    <Card key={phase.key} className={statusStyle[phase.status]}>
                        <CardContent className="flex items-center justify-between py-4">
                            <div className="flex items-center gap-4">
                                <div className="space-y-0.5">
                                    <p className="text-sm font-medium">{phase.label}</p>
                                    {phase.agentSlug && (
                                        <p className="text-muted-foreground text-xs">
                                            Agent: {phase.agentSlug}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                        phase.status === "complete"
                                            ? "border-emerald-200 bg-emerald-500/10 text-emerald-600"
                                            : phase.status === "running"
                                              ? "border-blue-200 bg-blue-500/10 text-blue-600"
                                              : phase.status === "failed"
                                                ? "border-red-200 bg-red-500/10 text-red-600"
                                                : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                    {statusLabel[phase.status]}
                                </Badge>
                                {phase.runId && phase.agentSlug && (
                                    <Link
                                        href={`/agents/${phase.agentSlug}/runs?run=${phase.runId}`}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        View Run
                                    </Link>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {/* Mission AARs */}
            {missionAarLogs.length > 0 && (
                <>
                    <Separator />
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                        Mission Reviews
                    </p>
                    {missionAarLogs.map((log) => (
                        <Card key={log.id} className="border-emerald-400 bg-emerald-500/5">
                            <CardContent className="flex items-center justify-between py-3">
                                <div className="space-y-0.5">
                                    <p className="text-sm">{log.message}</p>
                                    <p className="text-muted-foreground text-xs">
                                        {formatDateTime(log.createdAt)}
                                    </p>
                                </div>
                                {typeof log.metadata?.runId === "string" &&
                                    typeof log.metadata?.agentSlug === "string" && (
                                        <Link
                                            href={`/agents/${log.metadata.agentSlug}/runs?run=${log.metadata.runId}`}
                                            className="text-xs text-blue-600 hover:underline"
                                        >
                                            View Run
                                        </Link>
                                    )}
                            </CardContent>
                        </Card>
                    ))}
                </>
            )}
        </div>
    );
}

// ─── Paginated Activity Log ──────────────────────────────────────────────────

function PaginatedActivityLog({
    logs,
    logCount,
    onRefresh
}: {
    logs: CampaignLog[];
    logCount: number;
    onRefresh: (filter?: string, offset?: number) => void;
}) {
    const [filter, setFilter] = useState<string>("all");
    const [offset, setOffset] = useState(0);
    const pageSize = 50;

    const eventTypes = useMemo(() => {
        const types = new Set(logs.map((l) => l.event));
        return [...types].sort();
    }, [logs]);

    const handleFilterChange = (value: string | null) => {
        const v = value ?? "all";
        setFilter(v);
        setOffset(0);
        onRefresh(v === "all" ? undefined : v, 0);
    };

    const handleNext = () => {
        const newOffset = offset + pageSize;
        setOffset(newOffset);
        onRefresh(filter === "all" ? undefined : filter, newOffset);
    };

    const handlePrev = () => {
        const newOffset = Math.max(0, offset - pageSize);
        setOffset(newOffset);
        onRefresh(filter === "all" ? undefined : filter, newOffset);
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Activity Log</CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={filter} onValueChange={handleFilterChange}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Filter events" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Events</SelectItem>
                                {eventTypes.map((e) => (
                                    <SelectItem key={e} value={e}>
                                        {e}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-muted-foreground text-xs">{logCount} total</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {logs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No activity yet.</p>
                ) : (
                    <div className="space-y-2">
                        {logs.map((log) => {
                            const meta = log.metadata;
                            const runId = meta?.runId as string | undefined;
                            const agentSlug = meta?.agentSlug as string | undefined;

                            return (
                                <div
                                    key={log.id}
                                    className="flex items-start gap-3 border-b py-2 last:border-0"
                                >
                                    <span className="text-muted-foreground mt-0.5 shrink-0 text-xs">
                                        {formatDateTime(log.createdAt)}
                                    </span>
                                    <Badge variant="outline" className="shrink-0 text-[10px]">
                                        {log.event}
                                    </Badge>
                                    <span className="min-w-0 flex-1 text-sm">{log.message}</span>
                                    {runId && agentSlug && (
                                        <Link
                                            href={`/agents/${agentSlug}/runs?run=${runId}`}
                                            className="shrink-0 text-[10px] text-blue-600 hover:underline"
                                        >
                                            trace
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {logCount > pageSize && (
                    <div className="mt-4 flex items-center justify-between">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrev}
                            disabled={offset === 0}
                        >
                            Previous
                        </Button>
                        <span className="text-muted-foreground text-xs">
                            {offset + 1}–{Math.min(offset + pageSize, logCount)} of {logCount}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNext}
                            disabled={offset + pageSize >= logCount}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Collapsible JSON Section ────────────────────────────────────────────────

function JsonSection({ title, data }: { title: string; data: Record<string, unknown> | null }) {
    const [open, setOpen] = useState(false);
    if (!data) return null;

    return (
        <Card>
            <CardHeader className="cursor-pointer pb-3" onClick={() => setOpen(!open)}>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <span className="text-muted-foreground text-xs">
                        {open ? "▼ Collapse" : "▶ Expand"}
                    </span>
                </div>
            </CardHeader>
            {open && (
                <CardContent className="pt-0">
                    <pre className="text-muted-foreground max-h-[500px] overflow-auto rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-900">
                        {JSON.stringify(data, null, 2)}
                    </pre>
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
    const [logFilter, setLogFilter] = useState<string | undefined>(undefined);
    const [logOffset, setLogOffset] = useState(0);

    const fetchCampaign = useCallback(
        async (filter?: string, offset?: number) => {
            try {
                const params = new URLSearchParams();
                const f = filter ?? logFilter;
                const o = offset ?? logOffset;
                if (f) params.set("logFilter", f);
                if (o > 0) params.set("logOffset", String(o));
                const qs = params.toString();
                const res = await fetch(`${getApiBase()}/api/campaigns/${id}${qs ? `?${qs}` : ""}`);
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                setCampaign(data);
            } catch (err) {
                console.error("Failed to load campaign:", err);
            } finally {
                setLoading(false);
            }
        },
        [id, logFilter, logOffset]
    );

    useEffect(() => {
        fetchCampaign();
        const interval = setInterval(() => fetchCampaign(), 3000);
        return () => clearInterval(interval);
    }, [fetchCampaign]);

    const handleLogRefresh = (filter?: string, offset?: number) => {
        setLogFilter(filter);
        setLogOffset(offset ?? 0);
        fetchCampaign(filter, offset);
    };

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
            <div className="mx-auto max-w-6xl space-y-6 p-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-60 w-full" />
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="mx-auto max-w-6xl p-6">
                <p className="text-muted-foreground">Campaign not found.</p>
            </div>
        );
    }

    const isActive = ["EXECUTING", "ANALYZING", "PLANNING", "REVIEWING"].includes(campaign.status);
    const isFinished = ["COMPLETE", "FAILED"].includes(campaign.status);
    const phases = extractPhases(campaign);

    // Aggregate task stats
    const allTasks = campaign.missions.flatMap((m) => m.tasks);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === "COMPLETE").length;
    const failedTasks = allTasks.filter((t) => t.status === "FAILED").length;
    const scores = allTasks.map(getTaskAvgScore).filter((s): s is number => s !== null);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const genResources = campaign.generatedResources;
    const hasGenResources =
        genResources &&
        ((genResources.agents && genResources.agents.length > 0) ||
            (genResources.skills && genResources.skills.length > 0));

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* ── Persistent Header ──────────────────────────────────────── */}
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
                        {isFinished && (
                            <Button
                                variant="outline"
                                onClick={() => handleAction("retry")}
                                disabled={actionLoading}
                            >
                                Retry
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
                        {isFinished && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    window.open(
                                        `${getApiBase()}/api/campaigns/${campaign.id}/export`,
                                        "_blank"
                                    );
                                }}
                            >
                                Export
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Stats Bar ──────────────────────────────────────────────── */}
            <Card>
                <CardContent className="py-4">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
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
                            <p className="text-muted-foreground text-xs">Tasks</p>
                            <p className="text-sm font-medium">
                                {completedTasks}/{totalTasks}
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

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="missions">Missions</TabsTrigger>
                    <TabsTrigger value="tasks">
                        Tasks
                        {totalTasks > 0 && (
                            <span className="text-muted-foreground ml-1.5 text-[10px]">
                                ({completedTasks}/{totalTasks})
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="phases">Phases</TabsTrigger>
                    <TabsTrigger value="logs">Activity Log</TabsTrigger>
                    <TabsTrigger value="plan">Plan</TabsTrigger>
                </TabsList>

                {/* ── Overview Tab ────────────────────────────────────────── */}
                <TabsContent value="overview" className="mt-4 space-y-4">
                    {/* Phase Pipeline */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Campaign Pipeline</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PhaseTimeline phases={phases} />
                        </CardContent>
                    </Card>

                    {/* Quick Stats + Budget */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Task Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs">Completed</p>
                                        <p className="text-lg font-semibold text-emerald-600">
                                            {completedTasks}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs">Failed</p>
                                        <p className="text-lg font-semibold text-red-600">
                                            {failedTasks}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs">Total</p>
                                        <p className="text-lg font-semibold">{totalTasks}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs">Avg Score</p>
                                        <p
                                            className={`text-lg font-semibold ${
                                                avgScore === null
                                                    ? "text-muted-foreground"
                                                    : avgScore >= 0.8
                                                      ? "text-emerald-600"
                                                      : avgScore >= 0.5
                                                        ? "text-amber-600"
                                                        : "text-red-600"
                                            }`}
                                        >
                                            {avgScore !== null ? avgScore.toFixed(2) : "--"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Budget & Cost</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <BudgetGauge
                                    spent={campaign.totalCostUsd}
                                    budget={campaign.maxCostUsd}
                                />
                                {(() => {
                                    const taskCostSum = campaign.missions.reduce(
                                        (sum, m) =>
                                            sum +
                                            m.tasks.reduce((ts, t) => ts + (t.costUsd || 0), 0),
                                        0
                                    );
                                    const systemCost = Math.max(
                                        0,
                                        campaign.totalCostUsd - taskCostSum
                                    );
                                    return (
                                        <div className="mt-4 space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground text-xs">
                                                        Tokens Used
                                                    </p>
                                                    <p className="text-sm font-medium">
                                                        {campaign.totalTokens.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground text-xs">
                                                        Cost Per Task
                                                    </p>
                                                    <p className="text-sm font-medium">
                                                        {completedTasks > 0
                                                            ? formatCost(
                                                                  taskCostSum / completedTasks
                                                              )
                                                            : "--"}
                                                    </p>
                                                </div>
                                            </div>
                                            {campaign.totalCostUsd > 0 && (
                                                <div className="space-y-1.5">
                                                    <p className="text-muted-foreground text-xs font-medium">
                                                        Cost Breakdown
                                                    </p>
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">
                                                                Task execution
                                                            </span>
                                                            <span className="font-medium">
                                                                {formatCost(taskCostSum)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-muted-foreground">
                                                                System overhead
                                                            </span>
                                                            <span className="font-medium">
                                                                {formatCost(systemCost)}
                                                            </span>
                                                        </div>
                                                        <Separator />
                                                        <div className="flex items-center justify-between font-medium">
                                                            <span>Total</span>
                                                            <span>
                                                                {formatCost(campaign.totalCostUsd)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {campaign.missions.map((m) => {
                                                        const mCost = m.tasks.reduce(
                                                            (s, t) => s + (t.costUsd || 0),
                                                            0
                                                        );
                                                        if (mCost <= 0) return null;
                                                        return (
                                                            <div
                                                                key={m.id}
                                                                className="text-muted-foreground flex items-center justify-between text-xs"
                                                            >
                                                                <span className="truncate pr-2">
                                                                    {m.name}
                                                                </span>
                                                                <span>{formatCost(mCost)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Generated Resources */}
                    {hasGenResources && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Generated Resources</CardTitle>
                                <CardDescription>
                                    Agents and skills created by the campaign architect
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {genResources?.agents && genResources.agents.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-muted-foreground text-xs font-medium uppercase">
                                                Agents
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {genResources.agents.map((a) => (
                                                    <Link
                                                        key={a.id}
                                                        href={`/agents/${a.slug}`}
                                                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-blue-50"
                                                    >
                                                        <span className="font-medium">
                                                            {a.name}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            ({a.slug})
                                                        </span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {genResources?.skills && genResources.skills.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-muted-foreground text-xs font-medium uppercase">
                                                Skills
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {genResources.skills.map((s) => (
                                                    <span
                                                        key={s.id}
                                                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
                                                    >
                                                        <span className="font-medium">
                                                            {s.name}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            ({s.slug})
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Campaign AAR (inline summary on overview) */}
                    {campaign.aarJson && (
                        <AarPanel title="Campaign After Action Review" aar={campaign.aarJson} />
                    )}
                </TabsContent>

                {/* ── Missions Tab ────────────────────────────────────────── */}
                <TabsContent value="missions" className="mt-4 space-y-4">
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

                {/* ── Tasks Tab ───────────────────────────────────────────── */}
                <TabsContent value="tasks" className="mt-4">
                    <TaskTable missions={campaign.missions} />
                </TabsContent>

                {/* ── Phases Tab ──────────────────────────────────────────── */}
                <TabsContent value="phases" className="mt-4">
                    <PhaseCards phases={phases} logs={campaign.logs} />
                </TabsContent>

                {/* ── Activity Log Tab ────────────────────────────────────── */}
                <TabsContent value="logs" className="mt-4">
                    <PaginatedActivityLog
                        logs={campaign.logs}
                        logCount={campaign.logCount}
                        onRefresh={handleLogRefresh}
                    />
                </TabsContent>

                {/* ── Plan Tab ────────────────────────────────────────────── */}
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

                    <JsonSection title="Analysis Output" data={campaign.analysisOutput} />
                    <JsonSection title="Execution Plan" data={campaign.executionPlan} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
