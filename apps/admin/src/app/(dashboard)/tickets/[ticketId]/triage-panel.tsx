"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    X,
    Plus,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    ChevronDown,
    ChevronRight,
    RotateCcw,
    ExternalLink,
    PauseCircle
} from "lucide-react";
import { useTimezone } from "@/lib/timezone-context";

interface TriageTicket {
    id: string;
    ticketNumber: number;
    title: string;
    description: string;
    type: string;
    status: string;
    priority: string;
    assignedToId: string | null;
    tags: string[];
    pipelineRunId?: string | null;
    triagedAt: string | null;
    resolvedAt: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface AdminUser {
    id: string;
    name: string;
    email: string;
}

type DispatchConfig = {
    targetOrganizationId: string;
    targetOrganizationName: string;
    workflowId: string;
    workflowSlug: string;
    workflowName: string;
    repository: string;
};

interface LifecycleStep {
    stepId: string;
    stepType: string;
    stepName: string | null;
    status: string;
    durationMs: number | null;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
}

interface LifecycleRun {
    runId: string;
    status: string;
    workflowSlug: string | null;
    workflowName: string | null;
    source: string | null;
    suspendedStep: string | null;
    isCurrent: boolean;
    createdAt: string;
    completedAt: string | null;
    durationMs: number | null;
    errorMessage: string | null;
    repository: string | null;
    steps: LifecycleStep[];
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
}

interface LifecycleData {
    dispatched: boolean;
    currentRunId: string | null;
    runs: LifecycleRun[];
    lastDispatchedAt: string | null;
    lastDispatchedBy: string | null;
}

export function TicketTriagePanel({
    ticket,
    adminUsers
}: {
    ticket: TriageTicket;
    adminUsers: AdminUser[];
}) {
    const router = useRouter();
    const { formatDateTime } = useTimezone();
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(ticket.status);
    const [priority, setPriority] = useState(ticket.priority);
    const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? "");
    const [showPipelineModal, setShowPipelineModal] = useState(false);
    const [pipelineDispatching, setPipelineDispatching] = useState(false);
    const [pipelineError, setPipelineError] = useState("");
    const [pipelineRunId, setPipelineRunId] = useState(ticket.pipelineRunId ?? null);
    const [dispatchConfig, setDispatchConfig] = useState<DispatchConfig | null>(null);
    const [dispatchConfigLoading, setDispatchConfigLoading] = useState(false);
    const [lifecycle, setLifecycle] = useState<LifecycleData | null>(null);
    const [lifecycleLoading, setLifecycleLoading] = useState(false);
    const [expandedRun, setExpandedRun] = useState<string | null>(null);

    const loadLifecycle = useCallback(async () => {
        setLifecycleLoading(true);
        try {
            const res = await fetch(`/admin/api/tickets/${ticket.id}/lifecycle`, {
                credentials: "include"
            });
            if (res.ok) {
                const data = await res.json();
                setLifecycle(data);
                if (data.currentRunId && !expandedRun) {
                    setExpandedRun(data.currentRunId);
                }
            }
        } catch {
            /* ignore */
        } finally {
            setLifecycleLoading(false);
        }
    }, [ticket.id, expandedRun]);

    useEffect(() => {
        if (pipelineRunId) {
            void loadLifecycle();
        }
    }, [pipelineRunId, loadLifecycle]);

    // Auto-refresh lifecycle for active runs
    useEffect(() => {
        if (!lifecycle?.dispatched) return;
        const currentRun = lifecycle.runs.find((r) => r.isCurrent);
        if (
            !currentRun ||
            currentRun.status === "COMPLETED" ||
            currentRun.status === "FAILED" ||
            currentRun.status === "CANCELLED"
        )
            return;

        const interval = setInterval(() => void loadLifecycle(), 10_000);
        return () => clearInterval(interval);
    }, [lifecycle, loadLifecycle]);

    useEffect(() => {
        if (!showPipelineModal) return;

        const loadConfig = async () => {
            setDispatchConfigLoading(true);
            setPipelineError("");
            try {
                const res = await fetch("/admin/api/settings/dispatch-config", {
                    credentials: "include"
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.config) {
                    setDispatchConfig(data.config);
                } else {
                    setDispatchConfig(null);
                }
            } catch {
                setDispatchConfig(null);
            } finally {
                setDispatchConfigLoading(false);
            }
        };

        void loadConfig();
    }, [showPipelineModal]);

    async function handleUpdate(updates: Record<string, unknown>) {
        setSaving(true);
        try {
            const res = await fetch(`/admin/api/tickets/${ticket.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                router.refresh();
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleStatusChange(newStatus: string) {
        setStatus(newStatus);
        await handleUpdate({ status: newStatus });
    }

    async function handlePriorityChange(newPriority: string) {
        setPriority(newPriority);
        await handleUpdate({ priority: newPriority });
    }

    async function handleAssign(newAssigneeId: string) {
        setAssignedToId(newAssigneeId);
        await handleUpdate({ assignedToId: newAssigneeId || null });
    }

    async function handleDispatchPipeline() {
        if (!dispatchConfig) return;
        setPipelineDispatching(true);
        setPipelineError("");
        try {
            const typeLabel =
                ticket.type === "BUG"
                    ? "bug"
                    : ticket.type === "FEATURE_REQUEST"
                      ? "feature"
                      : "task";

            const res = await fetch("/admin/api/dispatch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    sourceType: "support_ticket",
                    sourceId: ticket.id,
                    title: ticket.title,
                    description: ticket.description,
                    labels: ["agentc2-sdlc", typeLabel]
                })
            });
            const data = await res.json();
            if (data.success) {
                setPipelineRunId(data.runId || "dispatched");
                setShowPipelineModal(false);
                setStatus("IN_PROGRESS");
                setExpandedRun(data.runId || null);
                router.refresh();
            } else if (data.error) {
                setPipelineError(data.error);
            }
        } finally {
            setPipelineDispatching(false);
        }
    }

    const statuses = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"];
    const priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

    function formatLabel(s: string) {
        return s
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const [tags, setTags] = useState(ticket.tags);

    useEffect(() => {
        setTags(ticket.tags);
    }, [ticket.tags]);

    const currentRun = lifecycle?.runs.find((r) => r.isCurrent);
    const canRedispatch =
        !pipelineDispatching &&
        currentRun &&
        (currentRun.status === "FAILED" ||
            currentRun.status === "COMPLETED" ||
            currentRun.status === "CANCELLED");

    return (
        <div className="bg-card border-border rounded-lg border">
            <div className="border-border border-b px-4 py-3">
                <h3 className="text-sm font-semibold tracking-wide uppercase">Triage</h3>
            </div>

            <div className="space-y-4 p-4">
                {/* Status */}
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs font-medium">
                        Status
                    </label>
                    <select
                        value={status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={saving}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                        {statuses.map((s) => (
                            <option key={s} value={s}>
                                {formatLabel(s)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Priority */}
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs font-medium">
                        Priority
                    </label>
                    <select
                        value={priority}
                        onChange={(e) => handlePriorityChange(e.target.value)}
                        disabled={saving}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                        {priorities.map((p) => (
                            <option key={p} value={p}>
                                {formatLabel(p)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Assign To */}
                <div>
                    <label className="text-muted-foreground mb-1 block text-xs font-medium">
                        Assigned To
                    </label>
                    <select
                        value={assignedToId}
                        onChange={(e) => handleAssign(e.target.value)}
                        disabled={saving}
                        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                    >
                        <option value="">Unassigned</option>
                        {adminUsers.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Quick Actions */}
                <div className="border-border space-y-2 border-t pt-4">
                    <p className="text-muted-foreground text-xs font-medium">Quick Actions</p>
                    {status !== "TRIAGED" &&
                        status !== "IN_PROGRESS" &&
                        status !== "RESOLVED" &&
                        status !== "CLOSED" && (
                            <button
                                onClick={() => handleStatusChange("TRIAGED")}
                                disabled={saving}
                                className="w-full rounded-md bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-500 transition-colors hover:bg-indigo-500/20 disabled:opacity-50"
                            >
                                Mark as Triaged
                            </button>
                        )}
                    {status !== "RESOLVED" && status !== "CLOSED" && (
                        <button
                            onClick={() => handleStatusChange("RESOLVED")}
                            disabled={saving}
                            className="w-full rounded-md bg-green-500/10 px-3 py-2 text-sm font-medium text-green-500 transition-colors hover:bg-green-500/20 disabled:opacity-50"
                        >
                            Resolve
                        </button>
                    )}
                    {status !== "CLOSED" && (
                        <button
                            onClick={() => handleStatusChange("CLOSED")}
                            disabled={saving}
                            className="w-full rounded-md bg-gray-500/10 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-500/20 disabled:opacity-50"
                        >
                            Close
                        </button>
                    )}
                </div>

                {/* Coding Pipeline */}
                <div className="border-border space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                        <p className="text-muted-foreground text-xs font-medium">Coding Pipeline</p>
                        {pipelineRunId && (
                            <button
                                onClick={() => void loadLifecycle()}
                                disabled={lifecycleLoading}
                                className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
                                title="Refresh status"
                            >
                                <RefreshCw
                                    className={`h-3 w-3 ${lifecycleLoading ? "animate-spin" : ""}`}
                                />
                            </button>
                        )}
                    </div>

                    {/* Lifecycle display */}
                    {lifecycle?.dispatched && lifecycle.runs.length > 0 ? (
                        <div className="space-y-2">
                            {lifecycle.runs.map((run) => (
                                <RunCard
                                    key={run.runId}
                                    run={run}
                                    expanded={expandedRun === run.runId}
                                    onToggle={() =>
                                        setExpandedRun(expandedRun === run.runId ? null : run.runId)
                                    }
                                    formatDateTime={formatDateTime}
                                />
                            ))}

                            {/* Dispatch info */}
                            {lifecycle.lastDispatchedBy && (
                                <p className="text-muted-foreground text-[10px]">
                                    Last dispatched by {lifecycle.lastDispatchedBy}
                                </p>
                            )}

                            {/* Redispatch button */}
                            {canRedispatch && (
                                <button
                                    onClick={() => setShowPipelineModal(true)}
                                    disabled={pipelineDispatching}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Redispatch
                                </button>
                            )}
                        </div>
                    ) : pipelineRunId && lifecycleLoading ? (
                        <div className="flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading lifecycle...
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowPipelineModal(true)}
                                disabled={saving || status === "RESOLVED" || status === "CLOSED"}
                                className="w-full rounded-md bg-purple-500/10 px-3 py-2 text-sm font-medium text-purple-500 transition-colors hover:bg-purple-500/20 disabled:opacity-50"
                            >
                                Dispatch to Coding Pipeline
                            </button>
                        </>
                    )}

                    {/* Dispatch modal */}
                    {showPipelineModal && (
                        <div className="bg-background border-border space-y-3 rounded-md border p-3">
                            {dispatchConfigLoading ? (
                                <div className="text-muted-foreground text-xs">
                                    Loading config...
                                </div>
                            ) : dispatchConfig ? (
                                <div className="space-y-1">
                                    <div className="rounded-md bg-blue-500/10 px-3 py-2 text-xs text-blue-600">
                                        <div>
                                            <span className="font-medium">
                                                {dispatchConfig.targetOrganizationName}
                                            </span>
                                            {" / "}
                                            <span className="font-medium">
                                                {dispatchConfig.workflowName}
                                            </span>
                                            <span className="text-muted-foreground ml-1">
                                                ({dispatchConfig.workflowSlug})
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground mt-1">
                                            {dispatchConfig.repository}
                                        </div>
                                    </div>
                                    {canRedispatch && (
                                        <div className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-600">
                                            Previous run{" "}
                                            {currentRun?.status === "FAILED"
                                                ? "failed"
                                                : "completed"}
                                            . This will create a new run.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                                    No dispatch target configured.{" "}
                                    <a
                                        href="/admin/settings"
                                        className="underline hover:no-underline"
                                    >
                                        Go to Settings &gt; Dispatch
                                    </a>
                                </div>
                            )}

                            {pipelineError && (
                                <p className="text-xs text-red-500">{pipelineError}</p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDispatchPipeline}
                                    disabled={pipelineDispatching || !dispatchConfig}
                                    className="flex-1 rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
                                >
                                    {pipelineDispatching
                                        ? "Dispatching..."
                                        : canRedispatch
                                          ? "Redispatch"
                                          : "Dispatch"}
                                </button>
                                <button
                                    onClick={() => setShowPipelineModal(false)}
                                    className="rounded-md bg-gray-500/10 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-500/20"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Lifecycle Timestamps */}
                <div className="border-border space-y-2 border-t pt-4">
                    <p className="text-muted-foreground text-xs font-medium">Timeline</p>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span>{formatDateTime(ticket.createdAt)}</span>
                        </div>
                        {ticket.triagedAt && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Triaged</span>
                                <span>{formatDateTime(ticket.triagedAt)}</span>
                            </div>
                        )}
                        {ticket.resolvedAt && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Resolved</span>
                                <span>{formatDateTime(ticket.resolvedAt)}</span>
                            </div>
                        )}
                        {ticket.closedAt && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Closed</span>
                                <span>{formatDateTime(ticket.closedAt)}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Updated</span>
                            <span>{formatDateTime(ticket.updatedAt)}</span>
                        </div>
                    </div>
                </div>

                {/* Tags */}
                <TagManager
                    tags={tags}
                    saving={saving}
                    onUpdate={async (newTags) => {
                        setTags(newTags);
                        await handleUpdate({ tags: newTags });
                    }}
                />
            </div>
        </div>
    );
}

function TagManager({
    tags,
    saving,
    onUpdate
}: {
    tags: string[];
    saving: boolean;
    onUpdate: (tags: string[]) => void;
}) {
    const [adding, setAdding] = useState(false);
    const [newTag, setNewTag] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    function handleAdd() {
        const tag = newTag.trim().toLowerCase();
        if (!tag || tags.includes(tag)) {
            setNewTag("");
            return;
        }
        onUpdate([...tags, tag]);
        setNewTag("");
        setAdding(false);
    }

    function handleRemove(tag: string) {
        onUpdate(tags.filter((t) => t !== tag));
    }

    return (
        <div className="border-border space-y-2 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium">Tags</p>
            <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                    <span
                        key={tag}
                        className="bg-secondary text-secondary-foreground group inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                    >
                        {tag}
                        <button
                            onClick={() => handleRemove(tag)}
                            disabled={saving}
                            className="rounded-full p-0.5 opacity-50 transition-opacity hover:opacity-100"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                {adding ? (
                    <div className="flex items-center gap-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAdd();
                                }
                                if (e.key === "Escape") {
                                    setAdding(false);
                                    setNewTag("");
                                }
                            }}
                            autoFocus
                            placeholder="tag..."
                            className="border-input bg-background w-20 rounded-md border px-2 py-0.5 text-xs"
                        />
                        <button
                            onClick={handleAdd}
                            disabled={saving || !newTag.trim()}
                            className="rounded-full p-0.5 text-green-500 hover:bg-green-500/10 disabled:opacity-50"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setAdding(true)}
                        disabled={saving}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs transition-colors hover:bg-gray-500/10 disabled:opacity-50"
                    >
                        <Plus className="h-3 w-3" />
                        Add tag
                    </button>
                )}
            </div>
        </div>
    );
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
    COMPLETED: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
    FAILED: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
    CANCELLED: { icon: XCircle, color: "text-gray-500", bg: "bg-gray-500/10" },
    RUNNING: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10" },
    SUSPENDED: { icon: PauseCircle, color: "text-amber-500", bg: "bg-amber-500/10" },
    QUEUED: { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" }
};

function RunCard({
    run,
    expanded,
    onToggle,
    formatDateTime
}: {
    run: LifecycleRun;
    expanded: boolean;
    onToggle: () => void;
    formatDateTime: (d: string) => string;
}) {
    const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.QUEUED;
    const StatusIcon = cfg.icon;
    const isActive = run.status === "RUNNING" || run.status === "QUEUED";

    return (
        <div
            className={`rounded-md border ${run.isCurrent ? "border-border" : "border-border/50 opacity-70"}`}
        >
            <button
                onClick={onToggle}
                className={`flex w-full items-center gap-2 rounded-t-md px-3 py-2 text-left text-xs ${cfg.bg}`}
            >
                <StatusIcon
                    className={`h-3.5 w-3.5 shrink-0 ${cfg.color} ${isActive && run.status === "RUNNING" ? "animate-spin" : ""}`}
                />
                <div className="min-w-0 flex-1">
                    <span className={`font-medium ${cfg.color}`}>
                        {run.status === "RUNNING"
                            ? "Running"
                            : run.status === "QUEUED"
                              ? "Queued"
                              : run.status === "FAILED"
                                ? "Failed"
                                : run.status === "COMPLETED"
                                  ? "Completed"
                                  : run.status === "SUSPENDED"
                                    ? "Needs Review"
                                    : run.status}
                    </span>
                    {run.isCurrent && <span className="text-muted-foreground ml-1">(current)</span>}
                    {run.workflowName && (
                        <span className="text-muted-foreground ml-1 truncate">
                            &middot; {run.workflowName}
                        </span>
                    )}
                </div>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                    {run.runId.slice(0, 8)}
                </span>
                {expanded ? (
                    <ChevronDown className="text-muted-foreground h-3 w-3 shrink-0" />
                ) : (
                    <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0" />
                )}
            </button>

            {expanded && (
                <div className="space-y-2 px-3 py-2">
                    {/* Timing */}
                    <div className="text-muted-foreground space-y-0.5 text-[10px]">
                        <div>Started: {formatDateTime(run.createdAt)}</div>
                        {run.completedAt && <div>Ended: {formatDateTime(run.completedAt)}</div>}
                        {run.durationMs != null && (
                            <div>Duration: {formatDuration(run.durationMs)}</div>
                        )}
                    </div>

                    {/* Error message */}
                    {run.errorMessage && (
                        <div className="rounded bg-red-500/10 px-2 py-1.5 text-[10px] break-words text-red-500">
                            {run.errorMessage.length > 300
                                ? run.errorMessage.slice(0, 300) + "..."
                                : run.errorMessage}
                        </div>
                    )}

                    {/* Steps */}
                    {run.steps.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-[10px] font-medium">
                                Steps ({run.completedSteps}/{run.totalSteps}
                                {run.failedSteps > 0 && `, ${run.failedSteps} failed`})
                            </p>
                            <div className="space-y-0.5">
                                {run.steps.map((step, i) => {
                                    const stepCfg =
                                        STATUS_CONFIG[step.status] ?? STATUS_CONFIG.QUEUED;
                                    const StepIcon = stepCfg.icon;
                                    return (
                                        <div
                                            key={`${step.stepId}-${i}`}
                                            className="flex items-start gap-1.5 text-[10px]"
                                        >
                                            <StepIcon
                                                className={`mt-0.5 h-3 w-3 shrink-0 ${stepCfg.color} ${step.status === "RUNNING" ? "animate-spin" : ""}`}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <span className="font-medium">
                                                    {step.stepName || step.stepId}
                                                </span>
                                                {step.durationMs != null && (
                                                    <span className="text-muted-foreground ml-1">
                                                        ({formatDuration(step.durationMs)})
                                                    </span>
                                                )}
                                                {step.error && (
                                                    <p className="mt-0.5 break-words text-red-500">
                                                        {step.error.length > 200
                                                            ? step.error.slice(0, 200) + "..."
                                                            : step.error}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {run.totalSteps === 0 && run.status !== "QUEUED" && (
                        <p className="text-muted-foreground text-[10px] italic">
                            No step data recorded
                        </p>
                    )}

                    {run.workflowSlug && (
                        <a
                            href={`/agent/workflows/${run.workflowSlug}/runs/${run.runId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                                run.status === "SUSPENDED"
                                    ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            <ExternalLink className="h-3 w-3" />
                            {run.status === "SUSPENDED" ? "Review & Approve" : "View Run"}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60_000);
    const secs = Math.round((ms % 60_000) / 1000);
    return `${mins}m ${secs}s`;
}
