"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";

// Check if user has completed onboarding
function useOnboardingRedirect() {
    const router = useRouter();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkOnboarding = async () => {
            try {
                const response = await fetch(`${getApiBase()}/api/onboarding/status`);
                const result = await response.json();
                if (!result.success || !result.onboardingComplete) {
                    router.replace("/onboarding");
                }
            } catch (error) {
                console.error("Failed to check onboarding status:", error);
                router.replace("/onboarding");
            } finally {
                if (isMounted) {
                    setChecked(true);
                }
            }
        };

        checkOnboarding();

        return () => {
            isMounted = false;
        };
    }, [router]);

    return checked;
}
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Input,
    Skeleton,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell
} from "@repo/ui";
import { FlaskConicalIcon } from "lucide-react";

interface AgentStats {
    runs: number;
    successRate: number;
    avgLatencyMs: number;
    completedRuns: number;
    failedRuns: number;
    queuedRuns: number;
    runningRuns: number;
    cancelledRuns: number;
    totalTokens: number;
    totalCostUsd: number;
    lastRunAt: string | null;
    lastFailedAt: string | null;
}

interface AgentTrendPoint {
    date: string;
    runs: number;
    costUsd: number;
    avgLatencyMs: number;
}

interface Agent {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    modelProvider: string;
    modelName: string;
    isActive: boolean;
    type: "SYSTEM" | "USER" | "DEMO";
    visibility?: "PRIVATE" | "ORGANIZATION" | "PUBLIC";
    toolCount?: number;
    memoryEnabled?: boolean;
    scorers?: string[];
    createdAt: string;
    updatedAt: string;
    stats: AgentStats;
    trends?: AgentTrendPoint[];
    healthScore?: {
        score: number;
        status: string;
        confidence: number;
    } | null;
}

interface WorkspaceSummary {
    totalAgents: number;
    activeAgents: number;
    systemAgents: number;
    userAgents: number;
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    successRate: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCostUsd: number;
}

interface Run {
    id: string;
    agentId: string;
    agentSlug: string;
    agentName: string;
    runType: string;
    status: string;
    inputText: string;
    outputText: string | null;
    durationMs: number | null;
    startedAt: string;
    completedAt: string | null;
    modelProvider: string | null;
    modelName: string | null;
    totalTokens: number | null;
    costUsd: number | null;
    toolCallCount: number;
    stepCount: number;
}

interface RunCounts {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
}

type ViewMode = "grid" | "list" | "table";

function formatLatency(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(dateStr: string): string {
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

function SparklineBars({
    data,
    labels,
    height = 28,
    color = "bg-primary",
    valueFormatter
}: {
    data: number[];
    labels?: string[];
    height?: number;
    color?: string;
    valueFormatter?: (value: number, index: number) => string;
}) {
    const max = Math.max(...data, 0);

    if (!data.length || max === 0) {
        return (
            <div
                className="text-muted-foreground flex items-center justify-center"
                style={{ height }}
            >
                <span className="text-[10px]">No data</span>
            </div>
        );
    }

    return (
        <div className="flex items-end gap-0.5" style={{ height }}>
            {data.map((value, i) => {
                const label = labels?.[i];
                const formatted = valueFormatter ? valueFormatter(value, i) : `${value}`;
                const title = label ? `${label}: ${formatted}` : formatted;
                return (
                    <div
                        key={i}
                        className={`flex-1 ${color} rounded-sm opacity-80 transition-opacity hover:opacity-100`}
                        style={{
                            height: value > 0 ? `${Math.max((value / max) * 100, 4)}%` : "0%"
                        }}
                        title={title}
                    />
                );
            })}
        </div>
    );
}

function SparklineMetric({
    label,
    data,
    labels,
    color,
    valueFormatter
}: {
    label: string;
    data: number[];
    labels?: string[];
    color?: string;
    valueFormatter?: (value: number, index: number) => string;
}) {
    return (
        <div className="space-y-1">
            <p className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</p>
            <SparklineBars
                data={data}
                labels={labels}
                color={color}
                valueFormatter={valueFormatter}
            />
        </div>
    );
}

function AgentCardView({ agent, onClick }: { agent: Agent; onClick: () => void }) {
    const trends = agent.trends ?? [];
    const trendLabels = trends.map((point) => point.date);
    const runTrend = trends.map((point) => point.runs);
    const costTrend = trends.map((point) => point.costUsd);
    const latencyTrend = trends.map((point) => point.avgLatencyMs);
    const lastRunLabel = agent.stats.lastRunAt ? formatRelativeTime(agent.stats.lastRunAt) : "—";
    const lastErrorLabel = agent.stats.lastFailedAt
        ? formatRelativeTime(agent.stats.lastFailedAt)
        : "—";

    return (
        <Card
            className="hover:border-primary cursor-pointer transition-all hover:shadow-md"
            onClick={onClick}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-lg">{agent.name}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">
                            {agent.description || "No description"}
                        </CardDescription>
                    </div>
                    <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={agent.isActive ? "default" : "secondary"}>
                            {agent.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {agent.type === "SYSTEM" && (
                            <Badge variant="outline" className="text-xs">
                                SYSTEM
                            </Badge>
                        )}
                        {agent.visibility === "ORGANIZATION" && (
                            <Badge variant="outline" className="text-xs">
                                Org
                            </Badge>
                        )}
                        {agent.visibility === "PUBLIC" && (
                            <Badge variant="outline" className="text-xs">
                                Public
                            </Badge>
                        )}
                        {agent.healthScore && (
                            <div
                                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                    agent.healthScore.status === "excellent" ||
                                    agent.healthScore.status === "good"
                                        ? "bg-green-500/10 text-green-600"
                                        : agent.healthScore.status === "fair"
                                          ? "bg-yellow-500/10 text-yellow-600"
                                          : "bg-red-500/10 text-red-600"
                                }`}
                            >
                                <div
                                    className={`h-1.5 w-1.5 rounded-full ${
                                        agent.healthScore.status === "excellent" ||
                                        agent.healthScore.status === "good"
                                            ? "bg-green-500"
                                            : agent.healthScore.status === "fair"
                                              ? "bg-yellow-500"
                                              : "bg-red-500"
                                    }`}
                                />
                                {Math.round(agent.healthScore.score * 100)}%
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Model Info */}
                <div className="mb-3">
                    <p className="text-muted-foreground truncate font-mono text-xs">
                        {agent.modelProvider}/{agent.modelName}
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="bg-muted rounded p-2 text-center">
                        <p className="text-muted-foreground text-xs">Runs</p>
                        <p className="font-medium">{agent.stats.runs}</p>
                    </div>
                    <div className="bg-muted rounded p-2 text-center">
                        <p className="text-muted-foreground text-xs">Success</p>
                        <p
                            className={`font-medium ${agent.stats.successRate >= 90 ? "text-green-600" : agent.stats.successRate >= 70 ? "text-yellow-600" : "text-red-600"}`}
                        >
                            {agent.stats.successRate}%
                        </p>
                    </div>
                    <div className="bg-muted rounded p-2 text-center">
                        <p className="text-muted-foreground text-xs">Latency</p>
                        <p className="font-medium">{formatLatency(agent.stats.avgLatencyMs)}</p>
                    </div>
                    <div className="bg-muted rounded p-2 text-center">
                        <p className="text-muted-foreground text-xs">Cost</p>
                        <p className="font-medium">${agent.stats.totalCostUsd.toFixed(2)}</p>
                    </div>
                </div>

                {/* Trends */}
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <SparklineMetric label="Runs" data={runTrend} labels={trendLabels} />
                    <SparklineMetric
                        label="Cost"
                        data={costTrend}
                        labels={trendLabels}
                        color="bg-emerald-500"
                        valueFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <SparklineMetric
                        label="Latency"
                        data={latencyTrend}
                        labels={trendLabels}
                        color="bg-blue-500"
                        valueFormatter={(value) => formatLatency(value)}
                    />
                </div>

                {/* Status Strip */}
                <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        {agent.stats.runningRuns} running
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        {agent.stats.queuedRuns} queued
                    </span>
                    <span>•</span>
                    <span>Last run {lastRunLabel}</span>
                    <span>•</span>
                    <span>
                        {agent.stats.lastFailedAt ? `Last error ${lastErrorLabel}` : "No errors"}
                    </span>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1">
                    {agent.toolCount !== undefined && agent.toolCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                            {agent.toolCount} tools
                        </Badge>
                    )}
                    {agent.memoryEnabled && (
                        <Badge variant="outline" className="text-xs">
                            Memory
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function AgentListView({ agent, onClick }: { agent: Agent; onClick: () => void }) {
    return (
        <Card
            className="hover:border-primary cursor-pointer transition-all hover:shadow-md"
            onClick={onClick}
        >
            <CardContent className="flex items-center gap-4 py-4">
                {/* Agent Info */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium">{agent.name}</h3>
                        <Badge
                            variant={agent.isActive ? "default" : "secondary"}
                            className="text-xs"
                        >
                            {agent.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {agent.type === "SYSTEM" && (
                            <Badge variant="outline" className="text-xs">
                                SYSTEM
                            </Badge>
                        )}
                        {agent.visibility === "ORGANIZATION" && (
                            <Badge variant="outline" className="text-xs">
                                Org
                            </Badge>
                        )}
                        {agent.visibility === "PUBLIC" && (
                            <Badge variant="outline" className="text-xs">
                                Public
                            </Badge>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-1 truncate text-sm">
                        {agent.description || "No description"}
                    </p>
                    <p className="text-muted-foreground mt-1 font-mono text-xs">
                        {agent.modelProvider}/{agent.modelName}
                    </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                        <p className="text-muted-foreground text-xs">Runs</p>
                        <p className="font-medium">{agent.stats.runs}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-muted-foreground text-xs">Success</p>
                        <p
                            className={`font-medium ${agent.stats.successRate >= 90 ? "text-green-600" : agent.stats.successRate >= 70 ? "text-yellow-600" : "text-red-600"}`}
                        >
                            {agent.stats.successRate}%
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-muted-foreground text-xs">Latency</p>
                        <p className="font-medium">{formatLatency(agent.stats.avgLatencyMs)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-muted-foreground text-xs">Tokens</p>
                        <p className="font-medium">{agent.stats.totalTokens.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-muted-foreground text-xs">Cost</p>
                        <p className="font-medium">${agent.stats.totalCostUsd.toFixed(4)}</p>
                    </div>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-1">
                    {agent.toolCount !== undefined && agent.toolCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                            {agent.toolCount} tools
                        </Badge>
                    )}
                    {agent.memoryEnabled && (
                        <Badge variant="outline" className="text-xs">
                            Memory
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function AgentTableView({
    agents,
    onAgentClick
}: {
    agents: Agent[];
    onAgentClick: (agent: Agent) => void;
}) {
    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Visibility</TableHead>
                        <TableHead className="text-right">Runs</TableHead>
                        <TableHead className="text-right">Success</TableHead>
                        <TableHead className="text-right">Latency</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {agents.map((agent) => (
                        <TableRow
                            key={agent.id}
                            className="cursor-pointer"
                            onClick={() => onAgentClick(agent)}
                        >
                            <TableCell>
                                <div>
                                    <p className="font-medium">{agent.name}</p>
                                    <p className="text-muted-foreground max-w-xs truncate text-xs">
                                        {agent.description || "No description"}
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                                {agent.modelProvider}/{agent.modelName}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="text-xs">
                                    {agent.type}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                        agent.visibility === "PUBLIC"
                                            ? "border-blue-300 text-blue-600"
                                            : agent.visibility === "ORGANIZATION"
                                              ? "border-amber-300 text-amber-600"
                                              : ""
                                    }`}
                                >
                                    {agent.visibility === "ORGANIZATION"
                                        ? "Org"
                                        : agent.visibility === "PUBLIC"
                                          ? "Public"
                                          : "Private"}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">{agent.stats.runs}</TableCell>
                            <TableCell className="text-right">
                                <span
                                    className={
                                        agent.stats.successRate >= 90
                                            ? "text-green-600"
                                            : agent.stats.successRate >= 70
                                              ? "text-yellow-600"
                                              : "text-red-600"
                                    }
                                >
                                    {agent.stats.successRate}%
                                </span>
                            </TableCell>
                            <TableCell className="text-right">
                                {formatLatency(agent.stats.avgLatencyMs)}
                            </TableCell>
                            <TableCell className="text-right">
                                {agent.stats.totalTokens.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                                ${agent.stats.totalCostUsd.toFixed(4)}
                            </TableCell>
                            <TableCell>
                                <Badge variant={agent.isActive ? "default" : "secondary"}>
                                    {agent.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}

function formatModelName(provider: string | null, model: string | null): string {
    if (!model) return "-";
    // Extract just the model name without provider prefix for cleaner display
    const shortModel = model.replace(/^(openai\/|anthropic\/|google\/)/, "");
    return shortModel;
}

function RunsTable({ runs, onRunClick }: { runs: Run[]; onRunClick: (run: Run) => void }) {
    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Input</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Steps</TableHead>
                        <TableHead className="text-right">Tools</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead>Time</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {runs.map((run) => (
                        <TableRow
                            key={run.id}
                            className="cursor-pointer"
                            onClick={() => onRunClick(run)}
                        >
                            <TableCell>
                                <p className="font-medium">{run.agentName}</p>
                            </TableCell>
                            <TableCell>
                                <p className="max-w-xs truncate text-sm">
                                    {run.inputText.slice(0, 100)}
                                    {run.inputText.length > 100 ? "..." : ""}
                                </p>
                            </TableCell>
                            <TableCell>
                                <Badge variant={getStatusBadgeVariant(run.status)}>
                                    {run.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <p
                                    className="text-muted-foreground max-w-[120px] truncate font-mono text-xs"
                                    title={`${run.modelProvider}/${run.modelName}`}
                                >
                                    {formatModelName(run.modelProvider, run.modelName)}
                                </p>
                            </TableCell>
                            <TableCell className="text-right">
                                {run.stepCount > 0 ? run.stepCount : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                                {run.toolCallCount > 0 ? run.toolCallCount : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                                {run.durationMs ? formatLatency(run.durationMs) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                                {run.totalTokens?.toLocaleString() || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                                {run.costUsd ? `$${run.costUsd.toFixed(4)}` : "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                                {formatRelativeTime(run.startedAt)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}

export default function AgentsPage() {
    const router = useRouter();
    const onboardingChecked = useOnboardingRedirect();
    const [loading, setLoading] = useState(true);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
    const [runs, setRuns] = useState<Run[]>([]);
    const [runCounts, setRunCounts] = useState<RunCounts | null>(null);
    const [runsLoading, setRunsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [activeTab, setActiveTab] = useState("agents");
    const [runStatusFilter, setRunStatusFilter] = useState<string>("all");

    // Fetch workspace stats
    useEffect(() => {
        async function fetchWorkspaceStats() {
            try {
                const res = await fetch(`${getApiBase()}/api/agents-overview/stats`);
                const data = await res.json();
                if (data.success) {
                    setAgents(data.agents);
                    setSummary(data.summary);
                }
            } catch (error) {
                console.error("Failed to fetch workspace stats:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchWorkspaceStats();
    }, []);

    // Fetch runs when Runs tab is active
    useEffect(() => {
        if (activeTab !== "runs") return;

        async function fetchRuns() {
            setRunsLoading(true);
            try {
                const params = new URLSearchParams();
                if (runStatusFilter !== "all") {
                    params.set("status", runStatusFilter);
                }
                const res = await fetch(
                    `${getApiBase()}/api/agents-overview/runs?${params.toString()}`
                );
                const data = await res.json();
                if (data.success) {
                    setRuns(data.runs);
                    setRunCounts(data.counts);
                }
            } catch (error) {
                console.error("Failed to fetch runs:", error);
            } finally {
                setRunsLoading(false);
            }
        }
        fetchRuns();
    }, [activeTab, runStatusFilter]);

    const filteredAgents = agents.filter((agent) => {
        // Search filter
        if (
            searchQuery &&
            !agent.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
            return false;
        }
        // Type filter
        if (typeFilter !== "all" && agent.type !== typeFilter) {
            return false;
        }
        // Visibility filter
        if (visibilityFilter !== "all" && agent.visibility !== visibilityFilter) {
            return false;
        }
        // Status filter
        if (statusFilter === "active" && !agent.isActive) {
            return false;
        }
        if (statusFilter === "inactive" && agent.isActive) {
            return false;
        }
        return true;
    });

    // Primary agents (USER + SYSTEM) are shown prominently; DEMO agents are collapsible
    const primaryAgents = filteredAgents.filter((a) => a.type === "USER" || a.type === "SYSTEM");
    const demoAgents = filteredAgents.filter((a) => a.type === "DEMO");
    const [examplesOpen, setExamplesOpen] = useState(false);

    const handleAgentClick = (agent: Agent) => {
        router.push(`/agents/${agent.slug || agent.id}/overview`);
    };

    const handleRunClick = (run: Run) => {
        router.push(`/agents/${run.agentSlug}/runs`);
    };

    // Show nothing while checking onboarding status
    if (!onboardingChecked) {
        return null;
    }

    if (loading) {
        return (
            <div className="container mx-auto space-y-6 py-6">
                <Skeleton className="h-10 w-64" />
                <div className="flex gap-4">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-64" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Agents</h1>
                        <p className="text-muted-foreground">Build, run, and improve AI agents</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {demoAgents.length > 0 && (
                            <Button
                                variant={examplesOpen ? "secondary" : "outline"}
                                onClick={() => setExamplesOpen(!examplesOpen)}
                            >
                                <FlaskConicalIcon className="mr-1.5 size-4" />
                                Examples
                                <Badge variant="secondary" className="ml-1.5">
                                    {demoAgents.length}
                                </Badge>
                            </Button>
                        )}
                        <Button onClick={() => router.push("/demos/agents/manage")}>
                            + Create Agent
                        </Button>
                    </div>
                </div>

                {/* Summary Stats */}
                {summary && (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Agents</CardDescription>
                                <CardTitle className="text-2xl">{summary.totalAgents}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Active</CardDescription>
                                <CardTitle className="text-2xl text-green-600">
                                    {summary.activeAgents}
                                </CardTitle>
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
                                    className={`text-2xl ${summary.successRate >= 90 ? "text-green-600" : summary.successRate >= 70 ? "text-yellow-600" : "text-red-600"}`}
                                >
                                    {summary.successRate}%
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Avg Latency</CardDescription>
                                <CardTitle className="text-2xl">
                                    {formatLatency(summary.avgLatencyMs)}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Cost</CardDescription>
                                <CardTitle className="text-2xl">
                                    ${summary.totalCostUsd.toFixed(2)}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                    </div>
                )}

                {/* Tabs */}
                <Tabs
                    defaultValue="agents"
                    value={activeTab}
                    onValueChange={(val) => setActiveTab(val as typeof activeTab)}
                >
                    <div className="flex items-center justify-between">
                        <TabsList>
                            <TabsTrigger value="agents">Agents</TabsTrigger>
                            <TabsTrigger value="runs">Runs</TabsTrigger>
                        </TabsList>

                        {activeTab === "agents" && (
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

                    <TabsContent value="agents">
                        {/* Filters */}
                        <div className="mb-4 flex flex-wrap items-center gap-4">
                            <div className="min-w-64 flex-1">
                                <Input
                                    placeholder="Search agents..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select
                                value={typeFilter}
                                onValueChange={(v) => setTypeFilter(v ?? "all")}
                            >
                                <SelectTrigger className="w-32">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="USER">User</SelectItem>
                                    <SelectItem value="SYSTEM">System</SelectItem>
                                    <SelectItem value="DEMO">Demo</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                value={visibilityFilter}
                                onValueChange={(v) => setVisibilityFilter(v ?? "all")}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Visibility" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Visibility</SelectItem>
                                    <SelectItem value="PRIVATE">Private</SelectItem>
                                    <SelectItem value="ORGANIZATION">Organization</SelectItem>
                                    <SelectItem value="PUBLIC">Public</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                value={statusFilter}
                                onValueChange={(v) => setStatusFilter(v ?? "all")}
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
                        </div>

                        {/* Agents */}
                        {primaryAgents.length === 0 && demoAgents.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    {agents.length === 0 ? (
                                        <div>
                                            <p className="text-muted-foreground text-lg">
                                                Ready to build your first agent?
                                            </p>
                                            <p className="text-muted-foreground mt-2 text-sm">
                                                Start with a template or build from scratch
                                            </p>
                                            <Button
                                                className="mt-4"
                                                onClick={() => router.push("/demos/agents/manage")}
                                            >
                                                Create Agent
                                            </Button>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-muted-foreground text-lg">
                                                No agents match your filters
                                            </p>
                                            <Button
                                                variant="outline"
                                                className="mt-4"
                                                onClick={() => {
                                                    setSearchQuery("");
                                                    setTypeFilter("all");
                                                    setVisibilityFilter("all");
                                                    setStatusFilter("all");
                                                }}
                                            >
                                                Clear Filters
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-6">
                                {/* Primary section: User + System agents */}
                                {primaryAgents.length > 0 ? (
                                    viewMode === "table" ? (
                                        <AgentTableView
                                            agents={primaryAgents}
                                            onAgentClick={handleAgentClick}
                                        />
                                    ) : viewMode === "list" ? (
                                        <div className="space-y-3">
                                            {primaryAgents.map((agent) => (
                                                <AgentListView
                                                    key={agent.id}
                                                    agent={agent}
                                                    onClick={() => handleAgentClick(agent)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {primaryAgents.map((agent) => (
                                                <AgentCardView
                                                    key={agent.id}
                                                    agent={agent}
                                                    onClick={() => handleAgentClick(agent)}
                                                />
                                            ))}
                                        </div>
                                    )
                                ) : typeFilter === "all" ? (
                                    <Card>
                                        <CardContent className="py-8 text-center">
                                            <p className="text-muted-foreground text-lg">
                                                No agents yet
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                Create your first agent, or try one of the examples
                                                below
                                            </p>
                                            <Button
                                                className="mt-4"
                                                onClick={() => router.push("/demos/agents/manage")}
                                            >
                                                Create Agent
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : null}

                                {/* Demo/example agents -- shown when Examples button is active */}
                                {examplesOpen && demoAgents.length > 0 && (
                                    <div>
                                        <div className="mb-4 flex items-center gap-2">
                                            <FlaskConicalIcon className="text-muted-foreground size-4" />
                                            <span className="text-muted-foreground text-sm font-medium">
                                                Examples &amp; Templates
                                            </span>
                                            <div className="bg-border h-px flex-1" />
                                        </div>
                                        {viewMode === "table" ? (
                                            <AgentTableView
                                                agents={demoAgents}
                                                onAgentClick={handleAgentClick}
                                            />
                                        ) : viewMode === "list" ? (
                                            <div className="space-y-3">
                                                {demoAgents.map((agent) => (
                                                    <AgentListView
                                                        key={agent.id}
                                                        agent={agent}
                                                        onClick={() => handleAgentClick(agent)}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                {demoAgents.map((agent) => (
                                                    <AgentCardView
                                                        key={agent.id}
                                                        agent={agent}
                                                        onClick={() => handleAgentClick(agent)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="runs">
                        {/* Run Counts Summary */}
                        {runCounts && (
                            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-6">
                                <Card
                                    className="cursor-pointer"
                                    onClick={() => setRunStatusFilter("all")}
                                >
                                    <CardHeader className="pb-2">
                                        <CardDescription>Total</CardDescription>
                                        <CardTitle className="text-xl">
                                            {runCounts.total.toLocaleString()}
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
                                            {runCounts.completed.toLocaleString()}
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
                                            {runCounts.failed.toLocaleString()}
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
                                            {runCounts.running.toLocaleString()}
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
                                            {runCounts.queued.toLocaleString()}
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
                                            {runCounts.cancelled.toLocaleString()}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>
                        )}

                        {/* Status Filter */}
                        <div className="mb-4 flex items-center gap-4">
                            <Select
                                value={runStatusFilter}
                                onValueChange={(v) => setRunStatusFilter(v ?? "all")}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Runs</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                    <SelectItem value="running">Running</SelectItem>
                                    <SelectItem value="queued">Queued</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                            {runStatusFilter !== "all" && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setRunStatusFilter("all")}
                                >
                                    Clear Filter
                                </Button>
                            )}
                        </div>

                        {/* Runs Table */}
                        {runsLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Skeleton key={i} className="h-16" />
                                ))}
                            </div>
                        ) : runs.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <p className="text-muted-foreground text-lg">No runs found</p>
                                    <p className="text-muted-foreground mt-2 text-sm">
                                        Runs will appear here when agents are executed
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <RunsTable runs={runs} onRunClick={handleRunClick} />
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
