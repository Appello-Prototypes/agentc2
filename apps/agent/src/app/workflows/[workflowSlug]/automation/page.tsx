"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Textarea
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

type UnifiedTrigger = {
    id: string;
    sourceId: string;
    sourceType: "trigger";
    type: string;
    name: string;
    description: string | null;
    isActive: boolean;
    isArchived?: boolean;
    archivedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    config: {
        eventName?: string | null;
        webhookPath?: string | null;
        hasWebhookSecret?: boolean;
        apiEndpoint?: string;
        environment?: string | null;
    };
    inputDefaults?: {
        input?: string;
        context?: Record<string, unknown>;
        maxSteps?: number;
        environment?: string | null;
    } | null;
    filter?: Record<string, unknown> | null;
    inputMapping?: Record<string, unknown> | null;
    stats?: {
        lastRunAt?: string | null;
        triggerCount?: number;
    };
    lastRun?: {
        id: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        durationMs: number | null;
    } | null;
};

const TRIGGER_TYPES = [
    { value: "webhook", label: "Webhook" },
    { value: "event", label: "Event" },
    { value: "api", label: "API Invocation" },
    { value: "manual", label: "Manual" }
];

const STATUS_FILTERS = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "disabled", label: "Disabled" },
    { value: "archived", label: "Archived" }
];

const emptyForm = {
    type: "webhook" as string,
    name: "",
    description: "",
    eventName: "",
    filterJson: "",
    inputMappingJson: "",
    isActive: true
};

function safeParseJson(value: string): unknown | undefined {
    if (!value.trim()) return undefined;
    return JSON.parse(value);
}

export default function WorkflowAutomationPage() {
    const params = useParams();
    const workflowSlug = params.workflowSlug as string;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [executionTriggers, setExecutionTriggers] = useState<UnifiedTrigger[]>([]);
    const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
    const [formState, setFormState] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [testingTriggerId, setTestingTriggerId] = useState<string | null>(null);
    const [executingTriggerId, setExecutingTriggerId] = useState<string | null>(null);
    const [webhookInfo, setWebhookInfo] = useState<{
        path: string;
        secret: string;
    } | null>(null);
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
    const [lastExecution, setLastExecution] = useState<{
        triggerId: string;
        runId: string;
    } | null>(null);

    const [dialogOpen, setDialogOpen] = useState(false);

    const apiBase = `${getApiBase()}/api/workflows/${workflowSlug}/execution-triggers`;

    const fetchTriggers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const qs =
                statusFilter === "archived" || statusFilter === "all"
                    ? "?includeArchived=true"
                    : "";
            const response = await fetch(`${apiBase}${qs}`);
            const data = await response.json();
            if (!data.success) {
                setError(data.error || "Failed to load triggers");
                return;
            }
            setExecutionTriggers(data.triggers || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load triggers");
        } finally {
            setLoading(false);
        }
    }, [apiBase, statusFilter]);

    useEffect(() => {
        fetchTriggers();
    }, [fetchTriggers]);

    const visibleTriggers = useMemo(() => {
        return executionTriggers.filter((trigger) => {
            if (typeFilter !== "all" && trigger.type !== typeFilter) return false;
            if (statusFilter === "archived") return trigger.isArchived === true;
            if (statusFilter === "active" && (!trigger.isActive || trigger.isArchived))
                return false;
            if (statusFilter === "disabled" && (trigger.isActive || trigger.isArchived))
                return false;
            if (statusFilter === "all" && trigger.isArchived) return false;
            return true;
        });
    }, [executionTriggers, typeFilter, statusFilter]);

    const formatDate = (value: string | null | undefined) => {
        if (!value) return "\u2014";
        return new Date(value).toLocaleString();
    };

    const resetForm = () => {
        setFormState({ ...emptyForm });
        setEditingTriggerId(null);
        setWebhookInfo(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        resetForm();
    };

    const startEdit = (trigger: UnifiedTrigger) => {
        setEditingTriggerId(trigger.id);
        setFormState({
            type: trigger.type,
            name: trigger.name,
            description: trigger.description || "",
            eventName: trigger.config.eventName || "",
            filterJson: trigger.filter ? JSON.stringify(trigger.filter, null, 2) : "",
            inputMappingJson: trigger.inputMapping
                ? JSON.stringify(trigger.inputMapping, null, 2)
                : "",
            isActive: trigger.isActive
        });
        setDialogOpen(true);
    };

    const submitTrigger = async () => {
        setSaving(true);
        setError(null);
        setWebhookInfo(null);
        try {
            const config: Record<string, unknown> = {};
            if (formState.type === "event") {
                config.eventName = formState.eventName;
            }

            const payload = {
                type: formState.type,
                name: formState.name,
                description: formState.description || undefined,
                config,
                filter: safeParseJson(formState.filterJson),
                inputMapping: safeParseJson(formState.inputMappingJson),
                isActive: formState.isActive
            };

            const endpoint = editingTriggerId ? `${apiBase}/${editingTriggerId}` : apiBase;
            const method = editingTriggerId ? "PATCH" : "POST";
            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || "Failed to save trigger");
                return;
            }
            if (data.webhook?.path && data.webhook?.secret) {
                setWebhookInfo({
                    path: data.webhook.path,
                    secret: data.webhook.secret
                });
            }
            closeDialog();
            await fetchTriggers();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save trigger");
        } finally {
            setSaving(false);
        }
    };

    const toggleTrigger = async (triggerId: string, isActive: boolean) => {
        await fetch(`${apiBase}/${triggerId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive })
        });
        await fetchTriggers();
    };

    const deleteTrigger = async (triggerId: string) => {
        await fetch(`${apiBase}/${triggerId}`, { method: "DELETE" });
        await fetchTriggers();
    };

    const archiveTrigger = async (triggerId: string, archive: boolean) => {
        await fetch(`${apiBase}/${triggerId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isArchived: archive })
        });
        await fetchTriggers();
    };

    const testTrigger = async (triggerId: string) => {
        setTestingTriggerId(triggerId);
        setTestResult(null);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/${triggerId}/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || "Failed to test trigger");
                return;
            }
            setTestResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to test trigger");
        } finally {
            setTestingTriggerId(null);
        }
    };

    const executeTrigger = async (triggerId: string) => {
        setExecutingTriggerId(triggerId);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/${triggerId}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.error || "Failed to execute trigger");
                return;
            }
            const resolvedTrigger = executionTriggers.find((item) => item.id === triggerId);
            setLastExecution({
                triggerId: resolvedTrigger?.sourceId || triggerId,
                runId: data.run_id
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to execute trigger");
        } finally {
            setExecutingTriggerId(null);
        }
    };

    if (loading) {
        return (
            <div className="text-muted-foreground p-6 text-sm">Loading workflow triggers...</div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Execution Triggers</h1>
                    <p className="text-muted-foreground text-sm">
                        Configure every way this workflow can be invoked.
                    </p>
                </div>
                <Button onClick={openCreateDialog}>+ Create Trigger</Button>
            </div>

            {error && (
                <Card>
                    <CardContent className="py-4 text-sm text-red-500">{error}</CardContent>
                </Card>
            )}

            {webhookInfo && (
                <Card className="bg-muted/40">
                    <CardHeader>
                        <CardTitle className="text-base">Webhook Details</CardTitle>
                        <CardDescription>
                            Save this secret now. It will not be shown again.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div>Path: {webhookInfo.path}</div>
                        <div>Secret: {webhookInfo.secret}</div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Execution Triggers</CardTitle>
                    <CardDescription>Monitor and manage execution paths.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="filter-type">Type</Label>
                            <Select
                                value={typeFilter}
                                onValueChange={(v) => {
                                    if (v) setTypeFilter(v);
                                }}
                            >
                                <SelectTrigger id="filter-type">
                                    <SelectValue placeholder="All types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {TRIGGER_TYPES.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="filter-status">Status</Label>
                            <Select
                                value={statusFilter}
                                onValueChange={(v) => {
                                    if (v) setStatusFilter(v);
                                }}
                            >
                                <SelectTrigger id="filter-status">
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_FILTERS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {visibleTriggers.length === 0 && (
                        <div className="text-muted-foreground text-sm">No triggers found.</div>
                    )}

                    {visibleTriggers.map((trigger) => (
                        <div
                            key={trigger.id}
                            className={`flex flex-col gap-3 rounded-md border p-4 ${trigger.isArchived ? "opacity-50" : ""}`}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 font-medium">
                                        {trigger.name}
                                        <Badge variant="outline">
                                            {TRIGGER_TYPES.find((t) => t.value === trigger.type)
                                                ?.label || trigger.type}
                                        </Badge>
                                        {trigger.isArchived ? (
                                            <Badge variant="secondary">Archived</Badge>
                                        ) : (
                                            !trigger.isActive && (
                                                <Badge variant="secondary">Disabled</Badge>
                                            )
                                        )}
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                        {trigger.type === "webhook" &&
                                            `Webhook: ${trigger.config.webhookPath || "\u2014"}`}
                                        {trigger.type === "event" &&
                                            `Event: ${trigger.config.eventName || "\u2014"}`}
                                        {trigger.type === "api" &&
                                            `Endpoint: ${trigger.config.apiEndpoint || "\u2014"}`}
                                        {trigger.type === "manual" && "Manual trigger"}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {trigger.isArchived ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => archiveTrigger(trigger.id, false)}
                                            >
                                                Unarchive
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    router.push(`/workflows/${workflowSlug}/runs`)
                                                }
                                            >
                                                View runs
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Switch
                                                checked={trigger.isActive}
                                                onCheckedChange={(checked) =>
                                                    toggleTrigger(trigger.id, checked)
                                                }
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => startEdit(trigger)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={testingTriggerId === trigger.id}
                                                onClick={() => testTrigger(trigger.id)}
                                            >
                                                {testingTriggerId === trigger.id
                                                    ? "Testing..."
                                                    : "Test"}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={executingTriggerId === trigger.id}
                                                onClick={() => executeTrigger(trigger.id)}
                                            >
                                                {executingTriggerId === trigger.id
                                                    ? "Running..."
                                                    : "Run"}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    router.push(`/workflows/${workflowSlug}/runs`)
                                                }
                                            >
                                                View runs
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => archiveTrigger(trigger.id, true)}
                                            >
                                                Archive
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => deleteTrigger(trigger.id)}
                                            >
                                                Delete
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="text-muted-foreground grid gap-2 text-xs md:grid-cols-3">
                                <div>Last run: {formatDate(trigger.lastRun?.startedAt)}</div>
                                <div>Status: {trigger.lastRun?.status || "\u2014"}</div>
                                <div>Count: {trigger.stats?.triggerCount ?? 0}</div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {testResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>Test Result</CardTitle>
                        <CardDescription>Resolved routing and mapped input.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-muted/40 max-h-96 overflow-auto rounded-md p-4 text-xs">
                            {JSON.stringify(testResult, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {lastExecution && (
                <Card>
                    <CardContent className="flex items-center justify-between gap-4 py-4 text-sm">
                        <div>
                            Trigger executed. Run ID:{" "}
                            <span className="font-medium">{lastExecution.runId}</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/workflows/${workflowSlug}/runs`)}
                        >
                            View runs
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTriggerId ? "Edit Trigger" : "Create Trigger"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingTriggerId
                                ? "Update the trigger configuration."
                                : "Configure a trigger for this workflow."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="trigger-name">Name</Label>
                                <Input
                                    id="trigger-name"
                                    value={formState.name}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
                                            ...prev,
                                            name: event.target.value
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="trigger-type">Type</Label>
                                <Select
                                    value={formState.type}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        setFormState((prev) => ({
                                            ...prev,
                                            type: value,
                                            eventName: value === "event" ? prev.eventName : ""
                                        }));
                                    }}
                                    disabled={Boolean(editingTriggerId)}
                                >
                                    <SelectTrigger id="trigger-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TRIGGER_TYPES.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="trigger-description">Description</Label>
                            <Input
                                id="trigger-description"
                                value={formState.description}
                                onChange={(event) =>
                                    setFormState((prev) => ({
                                        ...prev,
                                        description: event.target.value
                                    }))
                                }
                            />
                        </div>

                        {formState.type === "event" && (
                            <div className="space-y-2">
                                <Label htmlFor="event-name">Event Name</Label>
                                <Input
                                    id="event-name"
                                    value={formState.eventName}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
                                            ...prev,
                                            eventName: event.target.value
                                        }))
                                    }
                                />
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="filter-json">Filter JSON</Label>
                                <Textarea
                                    id="filter-json"
                                    value={formState.filterJson}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
                                            ...prev,
                                            filterJson: event.target.value
                                        }))
                                    }
                                    rows={3}
                                    placeholder='{"triggerLabel":"agentc2-sdlc"}'
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="input-mapping-json">Input Mapping JSON</Label>
                                <Textarea
                                    id="input-mapping-json"
                                    value={formState.inputMappingJson}
                                    onChange={(event) =>
                                        setFormState((prev) => ({
                                            ...prev,
                                            inputMappingJson: event.target.value
                                        }))
                                    }
                                    rows={3}
                                    placeholder='{"workflowRouting":{"bug":"sdlc-bugfix"}}'
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                checked={formState.isActive}
                                onCheckedChange={(checked) =>
                                    setFormState((prev) => ({
                                        ...prev,
                                        isActive: checked
                                    }))
                                }
                            />
                            <span className="text-sm">Active</span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog}>
                            Cancel
                        </Button>
                        <Button onClick={submitTrigger} disabled={saving || !formState.name.trim()}>
                            {saving
                                ? "Saving..."
                                : editingTriggerId
                                  ? "Update Trigger"
                                  : "Create Trigger"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
