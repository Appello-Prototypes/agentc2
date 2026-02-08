"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    buttonVariants
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

type ViewMode = "grid" | "list" | "table";

interface WorkflowStats {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    queuedRuns: number;
    runningRuns: number;
    cancelledRuns: number;
    avgLatencyMs: number;
    lastRunAt: string | null;
    lastFailedAt: string | null;
}

interface WorkflowSummaryItem {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    version: number;
    isPublished: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    stepCount: number;
    stats: WorkflowStats;
}

interface WorkflowsSummary {
    totalWorkflows: number;
    activeWorkflows: number;
    publishedWorkflows: number;
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    queuedRuns: number;
    runningRuns: number;
    cancelledRuns: number;
    successRate: number;
    avgLatencyMs: number;
}

interface WorkflowRun {
    id: string;
    status: string;
    inputJson: unknown;
    outputJson: unknown;
    startedAt: string;
    completedAt: string | null;
    suspendedAt: string | null;
    suspendedStep: string | null;
    durationMs: number | null;
    environment: string;
    triggerType: string;
    stepsCount: number;
}

function formatLatency(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function getStatusBadgeVariant(
    status: string
): "default" | "secondary" | "destructive" | "outline" {
    switch (status.toUpperCase()) {
        case "COMPLETED":
            return "default";
        case "FAILED":
            return "destructive";
        case "RUNNING":
        case "QUEUED":
            return "secondary";
        default:
            return "outline";
    }
}

function getSuccessRate(stats: WorkflowStats) {
    return stats.totalRuns > 0 ? Math.round((stats.completedRuns / stats.totalRuns) * 100) : 0;
}

function isInteractiveTarget(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    return !!target?.closest("a,button");
}

function WorkflowCardView({ workflow }: { workflow: WorkflowSummaryItem }) {
    const router = useRouter();
    const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
        if (isInteractiveTarget(event)) return;
        router.push(`/workflows/${workflow.slug}`);
    };

    return (
        <Card className="cursor-pointer" onClick={handleCardClick}>
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle>{workflow.name}</CardTitle>
                        <CardDescription>{workflow.description}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Badge variant={workflow.isActive ? "default" : "secondary"}>
                            {workflow.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                            {workflow.isPublished ? "Published" : "Draft"}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="text-muted-foreground text-xs">
                    Version {workflow.version} · {workflow.stepCount} steps ·{" "}
                    {workflow.stats.totalRuns} runs
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <p className="text-muted-foreground text-xs">Success Rate</p>
                        <p className="font-semibold">{getSuccessRate(workflow.stats)}%</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Avg Latency</p>
                        <p className="font-semibold">
                            {workflow.stats.avgLatencyMs
                                ? formatLatency(workflow.stats.avgLatencyMs)
                                : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Last Run</p>
                        <p className="font-semibold">
                            {formatRelativeTime(workflow.stats.lastRunAt)}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Last Failed</p>
                        <p className="font-semibold">
                            {formatRelativeTime(workflow.stats.lastFailedAt)}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={`/workflows/${workflow.slug}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Overview
                    </Link>
                    <Link
                        href={`/workflows/${workflow.slug}/design`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Design
                    </Link>
                    <Link
                        href={`/workflows/${workflow.slug}/runs`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Runs
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

function WorkflowListView({ workflow }: { workflow: WorkflowSummaryItem }) {
    const router = useRouter();
    const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
        if (isInteractiveTarget(event)) return;
        router.push(`/workflows/${workflow.slug}`);
    };

    return (
        <Card className="cursor-pointer" onClick={handleCardClick}>
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{workflow.name}</h3>
                        <Badge variant={workflow.isActive ? "default" : "secondary"}>
                            {workflow.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                            {workflow.isPublished ? "Published" : "Draft"}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">{workflow.description}</p>
                    <p className="text-muted-foreground mt-2 text-xs">
                        Version {workflow.version} · {workflow.stepCount} steps ·{" "}
                        {workflow.stats.totalRuns} runs
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={`/workflows/${workflow.slug}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Overview
                    </Link>
                    <Link
                        href={`/workflows/${workflow.slug}/design`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Design
                    </Link>
                    <Link
                        href={`/workflows/${workflow.slug}/runs`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Runs
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

function WorkflowTableView({ workflows }: { workflows: WorkflowSummaryItem[] }) {
    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Workflow</TableHead>
                        <TableHead className="text-right">Version</TableHead>
                        <TableHead className="text-right">Steps</TableHead>
                        <TableHead className="text-right">Runs</TableHead>
                        <TableHead className="text-right">Success</TableHead>
                        <TableHead className="text-right">Avg Latency</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead>Last Run</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {workflows.map((workflow) => (
                        <TableRow key={workflow.id}>
                            <TableCell>
                                <div>
                                    <p className="font-medium">{workflow.name}</p>
                                    <p className="text-muted-foreground text-xs">{workflow.slug}</p>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">v{workflow.version}</TableCell>
                            <TableCell className="text-right">{workflow.stepCount}</TableCell>
                            <TableCell className="text-right">{workflow.stats.totalRuns}</TableCell>
                            <TableCell className="text-right">
                                {getSuccessRate(workflow.stats)}%
                            </TableCell>
                            <TableCell className="text-right">
                                {workflow.stats.avgLatencyMs
                                    ? formatLatency(workflow.stats.avgLatencyMs)
                                    : "—"}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline">
                                    {workflow.isPublished ? "Published" : "Draft"}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatRelativeTime(workflow.stats.lastRunAt)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}

export default function WorkflowsPage() {
    const [summary, setSummary] = useState<WorkflowsSummary | null>(null);
    const [workflows, setWorkflows] = useState<WorkflowSummaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("workflows");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [publishedFilter, setPublishedFilter] = useState("all");

    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);

    const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [runsLoading, setRunsLoading] = useState(false);
    const [runStatusFilter, setRunStatusFilter] = useState("all");
    const [runEnvironmentFilter, setRunEnvironmentFilter] = useState("all");
    const [runTriggerFilter, setRunTriggerFilter] = useState("all");
    const [runSearchQuery, setRunSearchQuery] = useState("");

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${getApiBase()}/api/workflows/stats`);
            const data = await res.json();
            if (data.success) {
                setSummary(data.summary);
                setWorkflows(data.workflows || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (!selectedWorkflow && workflows.length > 0) {
            setSelectedWorkflow(workflows[0].slug);
        }
    }, [selectedWorkflow, workflows]);

    const fetchRuns = useCallback(async () => {
        if (!selectedWorkflow) return;
        try {
            setRunsLoading(true);
            const params = new URLSearchParams();
            if (runStatusFilter !== "all") {
                params.set("status", runStatusFilter);
            }
            if (runEnvironmentFilter !== "all") {
                params.set("environment", runEnvironmentFilter);
            }
            if (runTriggerFilter !== "all") {
                params.set("triggerType", runTriggerFilter);
            }
            if (runSearchQuery) {
                params.set("search", runSearchQuery);
            }
            const res = await fetch(
                `${getApiBase()}/api/workflows/${selectedWorkflow}/runs?${params.toString()}`
            );
            const data = await res.json();
            if (data.success) {
                setRuns(data.runs || []);
            }
        } finally {
            setRunsLoading(false);
        }
    }, [selectedWorkflow, runStatusFilter, runEnvironmentFilter, runTriggerFilter, runSearchQuery]);

    useEffect(() => {
        if (activeTab !== "runs") return;
        fetchRuns();
    }, [activeTab, fetchRuns]);

    const filteredWorkflows = useMemo(() => {
        return workflows.filter((workflow) => {
            if (
                searchQuery &&
                !workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !workflow.slug.toLowerCase().includes(searchQuery.toLowerCase())
            ) {
                return false;
            }

            if (statusFilter === "active" && !workflow.isActive) return false;
            if (statusFilter === "inactive" && workflow.isActive) return false;

            if (publishedFilter === "published" && !workflow.isPublished) return false;
            if (publishedFilter === "unpublished" && workflow.isPublished) return false;

            return true;
        });
    }, [workflows, searchQuery, statusFilter, publishedFilter]);

    const selectedWorkflowStats = workflows.find(
        (workflow) => workflow.slug === selectedWorkflow
    )?.stats;

    if (loading) {
        return (
            <div className="container mx-auto space-y-6 py-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="container mx-auto space-y-6 py-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Workflows</h1>
                    <p className="text-muted-foreground">
                        Design step-by-step processes with branching, loops, and approvals
                    </p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <Button onClick={() => setCreateOpen(true)}>+ Create Workflow</Button>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Create workflow</DialogTitle>
                            <DialogDescription>
                                Start from a blank workflow definition.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            <Input
                                placeholder="Workflow name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                            <Input
                                placeholder="Description (optional)"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={async () => {
                                    if (!name.trim()) return;
                                    try {
                                        setCreating(true);
                                        const res = await fetch(`${getApiBase()}/api/workflows`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                                name,
                                                description,
                                                definitionJson: { steps: [] }
                                            })
                                        });
                                        if (res.ok) {
                                            setName("");
                                            setDescription("");
                                            setCreateOpen(false);
                                            await fetchStats();
                                        }
                                    } finally {
                                        setCreating(false);
                                    }
                                }}
                                disabled={creating || !name.trim()}
                            >
                                {creating ? "Creating..." : "Create workflow"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {summary && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Workflows</CardDescription>
                            <CardTitle className="text-2xl">{summary.totalWorkflows}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Active</CardDescription>
                            <CardTitle className="text-2xl text-green-600">
                                {summary.activeWorkflows}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Published</CardDescription>
                            <CardTitle className="text-2xl">{summary.publishedWorkflows}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Runs</CardDescription>
                            <CardTitle className="text-2xl">
                                {summary.totalRuns.toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Success Rate</CardDescription>
                            <CardTitle
                                className={`text-2xl ${
                                    summary.successRate >= 90
                                        ? "text-green-600"
                                        : summary.successRate >= 70
                                          ? "text-yellow-600"
                                          : "text-red-600"
                                }`}
                            >
                                {summary.successRate}%
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Avg Latency</CardDescription>
                            <CardTitle className="text-2xl">
                                {summary.avgLatencyMs ? formatLatency(summary.avgLatencyMs) : "—"}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            <Tabs defaultValue="workflows" value={activeTab} onValueChange={setActiveTab}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <TabsList>
                        <TabsTrigger value="workflows">Workflows</TabsTrigger>
                        <TabsTrigger value="runs">Runs</TabsTrigger>
                    </TabsList>

                    {activeTab === "workflows" && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant={viewMode === "grid" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setViewMode("grid")}
                            >
                                Grid
                            </Button>
                            <Button
                                variant={viewMode === "list" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setViewMode("list")}
                            >
                                List
                            </Button>
                            <Button
                                variant={viewMode === "table" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setViewMode("table")}
                            >
                                Table
                            </Button>
                        </div>
                    )}
                </div>

                <TabsContent value="workflows">
                    <div className="mb-4 flex flex-wrap items-center gap-4">
                        <div className="min-w-64 flex-1">
                            <Input
                                placeholder="Search workflows..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={publishedFilter}
                            onValueChange={(value) => setPublishedFilter(value ?? "all")}
                        >
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder="Published" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="unpublished">Draft</SelectItem>
                            </SelectContent>
                        </Select>
                        {(searchQuery || statusFilter !== "all" || publishedFilter !== "all") && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchQuery("");
                                    setStatusFilter("all");
                                    setPublishedFilter("all");
                                }}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>

                    {filteredWorkflows.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-muted-foreground text-lg">No workflows yet</p>
                                <p className="text-muted-foreground mt-2 text-sm">
                                    Workflows let you chain steps together with logic and approvals
                                </p>
                            </CardContent>
                        </Card>
                    ) : viewMode === "table" ? (
                        <WorkflowTableView workflows={filteredWorkflows} />
                    ) : viewMode === "list" ? (
                        <div className="space-y-3">
                            {filteredWorkflows.map((workflow) => (
                                <WorkflowListView key={workflow.id} workflow={workflow} />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredWorkflows.map((workflow) => (
                                <WorkflowCardView key={workflow.id} workflow={workflow} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="runs">
                    {workflows.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-muted-foreground text-lg">
                                    No workflows available
                                </p>
                                <p className="text-muted-foreground mt-2 text-sm">
                                    Create a workflow to start tracking runs.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <Select
                                    value={selectedWorkflow ?? undefined}
                                    onValueChange={(value) => setSelectedWorkflow(value ?? null)}
                                >
                                    <SelectTrigger className="w-64">
                                        <SelectValue placeholder="Select workflow" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {workflows.map((workflow) => (
                                            <SelectItem key={workflow.slug} value={workflow.slug}>
                                                {workflow.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={runStatusFilter}
                                    onValueChange={(value) => setRunStatusFilter(value ?? "all")}
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                        <SelectItem value="running">Running</SelectItem>
                                        <SelectItem value="queued">Queued</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={runEnvironmentFilter}
                                    onValueChange={(value) =>
                                        setRunEnvironmentFilter(value ?? "all")
                                    }
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue placeholder="Environment" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Environments</SelectItem>
                                        <SelectItem value="development">Development</SelectItem>
                                        <SelectItem value="staging">Staging</SelectItem>
                                        <SelectItem value="production">Production</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={runTriggerFilter}
                                    onValueChange={(value) => setRunTriggerFilter(value ?? "all")}
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue placeholder="Trigger" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Triggers</SelectItem>
                                        <SelectItem value="manual">Manual</SelectItem>
                                        <SelectItem value="api">API</SelectItem>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="webhook">Webhook</SelectItem>
                                        <SelectItem value="tool">Tool</SelectItem>
                                        <SelectItem value="test">Test</SelectItem>
                                        <SelectItem value="retry">Retry</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="min-w-56 flex-1">
                                    <Input
                                        placeholder="Search run ID"
                                        value={runSearchQuery}
                                        onChange={(e) => setRunSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {selectedWorkflowStats && (
                                <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                                    <Card
                                        className="cursor-pointer"
                                        onClick={() => setRunStatusFilter("all")}
                                    >
                                        <CardHeader className="pb-2">
                                            <CardDescription>Total</CardDescription>
                                            <CardTitle className="text-xl">
                                                {selectedWorkflowStats.totalRuns}
                                            </CardTitle>
                                        </CardHeader>
                                    </Card>
                                    <Card
                                        className="cursor-pointer"
                                        onClick={() => setRunStatusFilter("completed")}
                                    >
                                        <CardHeader className="pb-2">
                                            <CardDescription>Completed</CardDescription>
                                            <CardTitle className="text-xl text-green-600">
                                                {selectedWorkflowStats.completedRuns}
                                            </CardTitle>
                                        </CardHeader>
                                    </Card>
                                    <Card
                                        className="cursor-pointer"
                                        onClick={() => setRunStatusFilter("failed")}
                                    >
                                        <CardHeader className="pb-2">
                                            <CardDescription>Failed</CardDescription>
                                            <CardTitle className="text-xl text-red-600">
                                                {selectedWorkflowStats.failedRuns}
                                            </CardTitle>
                                        </CardHeader>
                                    </Card>
                                    <Card
                                        className="cursor-pointer"
                                        onClick={() => setRunStatusFilter("running")}
                                    >
                                        <CardHeader className="pb-2">
                                            <CardDescription>Running</CardDescription>
                                            <CardTitle className="text-xl text-blue-600">
                                                {selectedWorkflowStats.runningRuns}
                                            </CardTitle>
                                        </CardHeader>
                                    </Card>
                                    <Card
                                        className="cursor-pointer"
                                        onClick={() => setRunStatusFilter("queued")}
                                    >
                                        <CardHeader className="pb-2">
                                            <CardDescription>Queued</CardDescription>
                                            <CardTitle className="text-xl text-yellow-600">
                                                {selectedWorkflowStats.queuedRuns}
                                            </CardTitle>
                                        </CardHeader>
                                    </Card>
                                    <Card
                                        className="cursor-pointer"
                                        onClick={() => setRunStatusFilter("cancelled")}
                                    >
                                        <CardHeader className="pb-2">
                                            <CardDescription>Cancelled</CardDescription>
                                            <CardTitle className="text-xl text-gray-600">
                                                {selectedWorkflowStats.cancelledRuns}
                                            </CardTitle>
                                        </CardHeader>
                                    </Card>
                                </div>
                            )}

                            {runsLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <Skeleton key={i} className="h-16" />
                                    ))}
                                </div>
                            ) : runs.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center">
                                        <p className="text-muted-foreground text-lg">
                                            No runs found
                                        </p>
                                        <p className="text-muted-foreground mt-2 text-sm">
                                            Runs will appear here when workflows execute.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Environment</TableHead>
                                                <TableHead>Trigger</TableHead>
                                                <TableHead className="text-right">Steps</TableHead>
                                                <TableHead className="text-right">
                                                    Duration
                                                </TableHead>
                                                <TableHead>Suspended</TableHead>
                                                <TableHead className="text-right">
                                                    Started
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {runs.map((run) => (
                                                <TableRow key={run.id}>
                                                    <TableCell>
                                                        <Badge
                                                            variant={getStatusBadgeVariant(
                                                                run.status
                                                            )}
                                                        >
                                                            {run.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="capitalize">
                                                        {run.environment.toLowerCase()}
                                                    </TableCell>
                                                    <TableCell className="capitalize">
                                                        {run.triggerType.toLowerCase()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {run.stepsCount}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {run.durationMs
                                                            ? formatLatency(run.durationMs)
                                                            : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {run.suspendedStep || "—"}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-right">
                                                        {formatRelativeTime(run.startedAt)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Card>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
