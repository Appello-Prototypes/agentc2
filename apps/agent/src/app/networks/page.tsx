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
    Textarea,
    buttonVariants
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

type ViewMode = "grid" | "list" | "table";

interface NetworkStats {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    queuedRuns: number;
    runningRuns: number;
    cancelledRuns: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCostUsd: number;
    lastRunAt: string | null;
    lastFailedAt: string | null;
}

interface NetworkSummaryItem {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    version: number;
    modelProvider: string;
    modelName: string;
    isPublished: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    primitiveCount: number;
    stats: NetworkStats;
}

interface NetworksSummary {
    totalNetworks: number;
    activeNetworks: number;
    publishedNetworks: number;
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    queuedRuns: number;
    runningRuns: number;
    cancelledRuns: number;
    successRate: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCostUsd: number;
}

interface NetworkRun {
    id: string;
    status: string;
    inputText: string;
    outputText: string | null;
    outputJson: unknown;
    startedAt: string;
    completedAt: string | null;
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

function getSuccessRate(stats: NetworkStats) {
    return stats.totalRuns > 0 ? Math.round((stats.completedRuns / stats.totalRuns) * 100) : 0;
}

function formatModelLabel(modelName: string, modelProvider: string) {
    const cleaned = modelName
        .replace(/-\d{8}$/, "")
        .replace(/^claude-/, "")
        .replace(/^gpt-/, "");
    return `${cleaned} (${modelProvider})`;
}

function isInteractiveTarget(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    return !!target?.closest("a,button");
}

function NetworkCardView({ network }: { network: NetworkSummaryItem }) {
    const router = useRouter();
    const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
        if (isInteractiveTarget(event)) return;
        router.push(`/networks/${network.slug}`);
    };

    return (
        <Card className="cursor-pointer" onClick={handleCardClick}>
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle>{network.name}</CardTitle>
                        <CardDescription>{network.description}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Badge variant={network.isActive ? "default" : "secondary"}>
                            {network.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                            {network.isPublished ? "Published" : "Draft"}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="text-muted-foreground text-xs">
                    Version {network.version} · {network.primitiveCount} primitives ·{" "}
                    {network.stats.totalRuns} runs
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <p className="text-muted-foreground text-xs">Model</p>
                        <p className="font-semibold">
                            {formatModelLabel(network.modelName, network.modelProvider)}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Success Rate</p>
                        <p className="font-semibold">{getSuccessRate(network.stats)}%</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Avg Latency</p>
                        <p className="font-semibold">
                            {network.stats.avgLatencyMs
                                ? formatLatency(network.stats.avgLatencyMs)
                                : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">Last Run</p>
                        <p className="font-semibold">
                            {formatRelativeTime(network.stats.lastRunAt)}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={`/networks/${network.slug}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Overview
                    </Link>
                    <Link
                        href={`/networks/${network.slug}/topology`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Design
                    </Link>
                    <Link
                        href={`/networks/${network.slug}/runs`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Runs
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

function NetworkListView({ network }: { network: NetworkSummaryItem }) {
    const router = useRouter();
    const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
        if (isInteractiveTarget(event)) return;
        router.push(`/networks/${network.slug}`);
    };

    return (
        <Card className="cursor-pointer" onClick={handleCardClick}>
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{network.name}</h3>
                        <Badge variant={network.isActive ? "default" : "secondary"}>
                            {network.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                            {network.isPublished ? "Published" : "Draft"}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">{network.description}</p>
                    <p className="text-muted-foreground mt-2 text-xs">
                        Version {network.version} · {network.primitiveCount} primitives ·{" "}
                        {network.stats.totalRuns} runs
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={`/networks/${network.slug}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Overview
                    </Link>
                    <Link
                        href={`/networks/${network.slug}/topology`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Design
                    </Link>
                    <Link
                        href={`/networks/${network.slug}/runs`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                        Runs
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

function NetworkTableView({ networks }: { networks: NetworkSummaryItem[] }) {
    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Network</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Version</TableHead>
                        <TableHead className="text-right">Primitives</TableHead>
                        <TableHead className="text-right">Runs</TableHead>
                        <TableHead className="text-right">Success</TableHead>
                        <TableHead className="text-right">Avg Latency</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead>Last Run</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {networks.map((network) => (
                        <TableRow key={network.id}>
                            <TableCell>
                                <div>
                                    <p className="font-medium">{network.name}</p>
                                    <p className="text-muted-foreground text-xs">{network.slug}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                {formatModelLabel(network.modelName, network.modelProvider)}
                            </TableCell>
                            <TableCell className="text-right">v{network.version}</TableCell>
                            <TableCell className="text-right">{network.primitiveCount}</TableCell>
                            <TableCell className="text-right">{network.stats.totalRuns}</TableCell>
                            <TableCell className="text-right">
                                {getSuccessRate(network.stats)}%
                            </TableCell>
                            <TableCell className="text-right">
                                {network.stats.avgLatencyMs
                                    ? formatLatency(network.stats.avgLatencyMs)
                                    : "—"}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline">
                                    {network.isPublished ? "Published" : "Draft"}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatRelativeTime(network.stats.lastRunAt)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}

export default function NetworksPage() {
    const [summary, setSummary] = useState<NetworksSummary | null>(null);
    const [networks, setNetworks] = useState<NetworkSummaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("networks");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [publishedFilter, setPublishedFilter] = useState("all");

    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [instructions, setInstructions] = useState("");
    const [modelProvider, setModelProvider] = useState("anthropic");
    const [modelName, setModelName] = useState("claude-sonnet-4-20250514");
    const [creating, setCreating] = useState(false);

    const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
    const [runs, setRuns] = useState<NetworkRun[]>([]);
    const [runsLoading, setRunsLoading] = useState(false);
    const [runStatusFilter, setRunStatusFilter] = useState("all");
    const [runEnvironmentFilter, setRunEnvironmentFilter] = useState("all");
    const [runTriggerFilter, setRunTriggerFilter] = useState("all");
    const [runSearchQuery, setRunSearchQuery] = useState("");

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${getApiBase()}/api/networks/stats`);
            const data = await res.json();
            if (data.success) {
                setSummary(data.summary);
                setNetworks(data.networks || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (!selectedNetwork && networks.length > 0) {
            setSelectedNetwork(networks[0].slug);
        }
    }, [selectedNetwork, networks]);

    const fetchRuns = useCallback(async () => {
        if (!selectedNetwork) return;
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
                `${getApiBase()}/api/networks/${selectedNetwork}/runs?${params.toString()}`
            );
            const data = await res.json();
            if (data.success) {
                setRuns(data.runs || []);
            }
        } finally {
            setRunsLoading(false);
        }
    }, [selectedNetwork, runStatusFilter, runEnvironmentFilter, runTriggerFilter, runSearchQuery]);

    useEffect(() => {
        if (activeTab !== "runs") return;
        fetchRuns();
    }, [activeTab, fetchRuns]);

    const filteredNetworks = useMemo(() => {
        return networks.filter((network) => {
            if (
                searchQuery &&
                !network.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !network.slug.toLowerCase().includes(searchQuery.toLowerCase())
            ) {
                return false;
            }

            if (statusFilter === "active" && !network.isActive) return false;
            if (statusFilter === "inactive" && network.isActive) return false;

            if (publishedFilter === "published" && !network.isPublished) return false;
            if (publishedFilter === "unpublished" && network.isPublished) return false;

            return true;
        });
    }, [networks, searchQuery, statusFilter, publishedFilter]);

    const selectedNetworkStats = networks.find(
        (network) => network.slug === selectedNetwork
    )?.stats;

    if (loading) {
        return (
            <div className="h-full overflow-y-auto">
                <div className="container mx-auto space-y-6 py-6">
                    <Skeleton className="h-8 w-48" />
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Skeleton key={i} className="h-24" />
                        ))}
                    </div>
                    <Skeleton className="h-96" />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Networks</h1>
                        <p className="text-muted-foreground">
                            Create smart routers that coordinate agents, workflows, and tools
                        </p>
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <Button onClick={() => setCreateOpen(true)}>+ Create Network</Button>
                        <DialogContent className="sm:max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Create network</DialogTitle>
                                <DialogDescription>
                                    Set up a routing agent configuration.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2 md:col-span-2">
                                    <Input
                                        placeholder="Network name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Input
                                        placeholder="Description (optional)"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Select
                                        value={modelProvider}
                                        onValueChange={(value) =>
                                            setModelProvider(value ?? "anthropic")
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Model provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="anthropic">Anthropic</SelectItem>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="google">Google</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Input
                                        placeholder="Model name"
                                        value={modelName}
                                        onChange={(e) => setModelName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Textarea
                                        rows={4}
                                        placeholder="Routing instructions"
                                        value={instructions}
                                        onChange={(e) => setInstructions(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={async () => {
                                        if (!name.trim() || !instructions.trim()) return;
                                        try {
                                            setCreating(true);
                                            const res = await fetch(
                                                `${getApiBase()}/api/networks`,
                                                {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({
                                                        name,
                                                        description,
                                                        instructions,
                                                        modelProvider,
                                                        modelName,
                                                        memoryConfig: {
                                                            lastMessages: 10,
                                                            semanticRecall: false,
                                                            workingMemory: { enabled: false }
                                                        },
                                                        topologyJson: { nodes: [], edges: [] }
                                                    })
                                                }
                                            );
                                            if (res.ok) {
                                                setName("");
                                                setDescription("");
                                                setInstructions("");
                                                setCreateOpen(false);
                                                await fetchStats();
                                            }
                                        } finally {
                                            setCreating(false);
                                        }
                                    }}
                                    disabled={creating || !name.trim() || !instructions.trim()}
                                >
                                    {creating ? "Creating..." : "Create network"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {summary && (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Networks</CardDescription>
                                <CardTitle className="text-2xl">{summary.totalNetworks}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Active</CardDescription>
                                <CardTitle className="text-2xl text-green-600">
                                    {summary.activeNetworks}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Published</CardDescription>
                                <CardTitle className="text-2xl">
                                    {summary.publishedNetworks}
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
                                    {summary.avgLatencyMs
                                        ? formatLatency(summary.avgLatencyMs)
                                        : "—"}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Tokens</CardDescription>
                                <CardTitle className="text-2xl">
                                    {summary.totalTokens.toLocaleString()}
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

                <Tabs defaultValue="networks" value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <TabsList>
                            <TabsTrigger value="networks">Networks</TabsTrigger>
                            <TabsTrigger value="runs">Runs</TabsTrigger>
                        </TabsList>

                        {activeTab === "networks" && (
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

                    <TabsContent value="networks">
                        <div className="mb-4 flex flex-wrap items-center gap-4">
                            <div className="min-w-64 flex-1">
                                <Input
                                    placeholder="Search networks..."
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
                            {(searchQuery ||
                                statusFilter !== "all" ||
                                publishedFilter !== "all") && (
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

                        {filteredNetworks.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <p className="text-muted-foreground text-lg">No networks yet</p>
                                    <p className="text-muted-foreground mt-2 text-sm">
                                        Networks let an AI decide which agents or workflows to use
                                    </p>
                                </CardContent>
                            </Card>
                        ) : viewMode === "table" ? (
                            <NetworkTableView networks={filteredNetworks} />
                        ) : viewMode === "list" ? (
                            <div className="space-y-3">
                                {filteredNetworks.map((network) => (
                                    <NetworkListView key={network.id} network={network} />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {filteredNetworks.map((network) => (
                                    <NetworkCardView key={network.id} network={network} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="runs">
                        {networks.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <p className="text-muted-foreground text-lg">
                                        No networks available
                                    </p>
                                    <p className="text-muted-foreground mt-2 text-sm">
                                        Create a network to start tracking runs.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <Select
                                        value={selectedNetwork ?? undefined}
                                        onValueChange={(value) => setSelectedNetwork(value ?? null)}
                                    >
                                        <SelectTrigger className="w-full sm:w-64">
                                            <SelectValue placeholder="Select network" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {networks.map((network) => (
                                                <SelectItem key={network.slug} value={network.slug}>
                                                    {network.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={runStatusFilter}
                                        onValueChange={(value) =>
                                            setRunStatusFilter(value ?? "all")
                                        }
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
                                        onValueChange={(value) =>
                                            setRunTriggerFilter(value ?? "all")
                                        }
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
                                            placeholder="Search run ID or input"
                                            value={runSearchQuery}
                                            onChange={(e) => setRunSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {selectedNetworkStats && (
                                    <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                                        <Card
                                            className="cursor-pointer"
                                            onClick={() => setRunStatusFilter("all")}
                                        >
                                            <CardHeader className="pb-2">
                                                <CardDescription>Total</CardDescription>
                                                <CardTitle className="text-xl">
                                                    {selectedNetworkStats.totalRuns}
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
                                                    {selectedNetworkStats.completedRuns}
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
                                                    {selectedNetworkStats.failedRuns}
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
                                                    {selectedNetworkStats.runningRuns}
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
                                                    {selectedNetworkStats.queuedRuns}
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
                                                    {selectedNetworkStats.cancelledRuns}
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
                                                Runs will appear here when networks execute.
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
                                                    <TableHead>Input</TableHead>
                                                    <TableHead className="text-right">
                                                        Steps
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Duration
                                                    </TableHead>
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
                                                        <TableCell>
                                                            <p className="max-w-xs truncate">
                                                                {run.inputText}
                                                            </p>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {run.stepsCount}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {run.durationMs
                                                                ? formatLatency(run.durationMs)
                                                                : "—"}
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
        </div>
    );
}
