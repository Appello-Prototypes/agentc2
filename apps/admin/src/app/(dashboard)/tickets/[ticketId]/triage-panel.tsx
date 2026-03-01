"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";

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

interface PipelineRepository {
    id: string;
    url: string;
    name: string;
    owner: string;
    isDefault: boolean;
}

type DispatchConfig = {
    targetOrganizationId: string;
    targetOrganizationName: string;
    workflowId: string;
    workflowSlug: string;
    workflowName: string;
};

const MANUAL_REPO_OPTION = "__manual__";

export function TicketTriagePanel({
    ticket,
    adminUsers
}: {
    ticket: TriageTicket;
    adminUsers: AdminUser[];
}) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(ticket.status);
    const [priority, setPriority] = useState(ticket.priority);
    const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? "");
    const [showPipelineModal, setShowPipelineModal] = useState(false);
    const [pipelineRepoSelection, setPipelineRepoSelection] = useState("");
    const [manualPipelineRepo, setManualPipelineRepo] = useState("");
    const [pipelineRepos, setPipelineRepos] = useState<PipelineRepository[]>([]);
    const [pipelineReposLoading, setPipelineReposLoading] = useState(false);
    const [pipelineReposError, setPipelineReposError] = useState("");
    const [pipelineDispatching, setPipelineDispatching] = useState(false);
    const [pipelineRunId, setPipelineRunId] = useState(ticket.pipelineRunId ?? null);
    const [dispatchConfig, setDispatchConfig] = useState<DispatchConfig | null>(null);
    const [dispatchConfigLoading, setDispatchConfigLoading] = useState(false);

    useEffect(() => {
        if (!showPipelineModal) return;

        const loadModalData = async () => {
            setPipelineReposLoading(true);
            setDispatchConfigLoading(true);
            setPipelineReposError("");

            const [reposResult, configResult] = await Promise.allSettled([
                fetch("/admin/api/settings/repos", { credentials: "include" }).then((r) =>
                    r.json()
                ),
                fetch("/admin/api/settings/dispatch-config", { credentials: "include" }).then((r) =>
                    r.json()
                )
            ]);

            if (reposResult.status === "fulfilled") {
                const repositories = (reposResult.value.repositories ?? []) as PipelineRepository[];
                setPipelineRepos(repositories);
                const defaultRepo = repositories.find((repo) => repo.isDefault);
                if (defaultRepo) {
                    setPipelineRepoSelection(defaultRepo.id);
                } else {
                    setPipelineRepoSelection(MANUAL_REPO_OPTION);
                }
            } else {
                setPipelineRepos([]);
                setPipelineRepoSelection(MANUAL_REPO_OPTION);
                setPipelineReposError("Failed to load repositories");
            }

            if (configResult.status === "fulfilled" && configResult.value.config) {
                setDispatchConfig(configResult.value.config);
            } else {
                setDispatchConfig(null);
            }

            setPipelineReposLoading(false);
            setDispatchConfigLoading(false);
        };

        void loadModalData();
    }, [showPipelineModal]);

    const selectedRepoUrl =
        pipelineRepoSelection === MANUAL_REPO_OPTION
            ? manualPipelineRepo.trim()
            : pipelineRepos.find((repo) => repo.id === pipelineRepoSelection)?.url || "";

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
        if (!selectedRepoUrl) return;
        setPipelineDispatching(true);
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
                    repository: selectedRepoUrl,
                    title: ticket.title,
                    description: ticket.description,
                    labels: ["agentc2-sdlc", typeLabel]
                })
            });
            const data = await res.json();
            if (data.success) {
                setPipelineRunId(data.pipelineRunId || data.issueUrl || "dispatched");
                setShowPipelineModal(false);
                setManualPipelineRepo("");
                setStatus("IN_PROGRESS");
                router.refresh();
            } else if (data.error) {
                setPipelineReposError(data.error);
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
                    <p className="text-muted-foreground text-xs font-medium">Coding Pipeline</p>
                    {pipelineRunId ? (
                        <div className="rounded-md bg-blue-500/10 px-3 py-2 text-sm text-blue-500">
                            Pipeline dispatched
                            <span className="mt-1 block text-xs opacity-70">
                                Run: {pipelineRunId.slice(0, 12)}...
                            </span>
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
                            {showPipelineModal && (
                                <div className="bg-background border-border space-y-3 rounded-md border p-3">
                                    {dispatchConfigLoading ? (
                                        <div className="text-muted-foreground text-xs">
                                            Loading config...
                                        </div>
                                    ) : dispatchConfig ? (
                                        <div className="rounded-md bg-blue-500/10 px-3 py-2 text-xs text-blue-600">
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

                                    <label className="text-muted-foreground block text-xs font-medium">
                                        Target Repository
                                    </label>
                                    {pipelineReposLoading ? (
                                        <div className="text-muted-foreground rounded-md bg-gray-500/10 px-3 py-2 text-sm">
                                            Loading repositories...
                                        </div>
                                    ) : (
                                        <>
                                            <select
                                                value={pipelineRepoSelection}
                                                onChange={(e) =>
                                                    setPipelineRepoSelection(e.target.value)
                                                }
                                                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                                            >
                                                {pipelineRepos.map((repo) => (
                                                    <option key={repo.id} value={repo.id}>
                                                        {repo.owner}/{repo.name}
                                                        {repo.isDefault ? " (Default)" : ""}
                                                    </option>
                                                ))}
                                                <option value={MANUAL_REPO_OPTION}>Other...</option>
                                            </select>
                                            {pipelineRepoSelection === MANUAL_REPO_OPTION && (
                                                <input
                                                    type="text"
                                                    value={manualPipelineRepo}
                                                    onChange={(e) =>
                                                        setManualPipelineRepo(e.target.value)
                                                    }
                                                    placeholder="https://github.com/org/repo"
                                                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                                                />
                                            )}
                                        </>
                                    )}
                                    {pipelineReposError && (
                                        <p className="text-xs text-red-500">{pipelineReposError}</p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleDispatchPipeline}
                                            disabled={
                                                pipelineDispatching ||
                                                !selectedRepoUrl ||
                                                !dispatchConfig
                                            }
                                            className="flex-1 rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
                                        >
                                            {pipelineDispatching ? "Dispatching..." : "Dispatch"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowPipelineModal(false);
                                                setManualPipelineRepo("");
                                            }}
                                            className="rounded-md bg-gray-500/10 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-500/20"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Lifecycle Timestamps */}
                <div className="border-border space-y-2 border-t pt-4">
                    <p className="text-muted-foreground text-xs font-medium">Timeline</p>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span>{new Date(ticket.createdAt).toLocaleString()}</span>
                        </div>
                        {ticket.triagedAt && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Triaged</span>
                                <span>{new Date(ticket.triagedAt).toLocaleString()}</span>
                            </div>
                        )}
                        {ticket.resolvedAt && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Resolved</span>
                                <span>{new Date(ticket.resolvedAt).toLocaleString()}</span>
                            </div>
                        )}
                        {ticket.closedAt && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Closed</span>
                                <span>{new Date(ticket.closedAt).toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Updated</span>
                            <span>{new Date(ticket.updatedAt).toLocaleString()}</span>
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
