"use client";

import { useState, useCallback } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Skeleton,
    HugeiconsIcon,
    cn
} from "@repo/ui";
import {
    ServerStack01Icon,
    Link03Icon,
    Wrench01Icon,
    AiBrain04Icon,
    BookOpen01Icon,
    UserStar01Icon,
    WorkflowSquare06Icon,
    NeuralNetworkIcon,
    ArrowDown01Icon,
    Loading03Icon,
    PlayIcon,
    Telescope01Icon
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { getApiBase } from "@/lib/utils";

const LAYER_ORDER = [
    "infrastructure",
    "connections",
    "tools",
    "models",
    "skills",
    "agents",
    "workflows",
    "networks"
] as const;

type LayerName = (typeof LAYER_ORDER)[number];

type ComponentResult = {
    id: string;
    name: string;
    status: "ok" | "error" | "skipped" | "warning";
    latencyMs: number | null;
    detail: string | null;
    error: string | null;
    metadata?: Record<string, unknown>;
};

type LayerResult = {
    layer: LayerName;
    status: "ok" | "error" | "degraded" | "skipped";
    components: ComponentResult[];
    testedAt: string;
};

type HealthResponse = {
    success: boolean;
    status: "healthy" | "degraded" | "critical";
    layers: LayerResult[];
    testedAt: string;
    error?: string;
};

const LAYER_META: Record<LayerName, { label: string; description: string; icon: IconSvgElement }> =
    {
        infrastructure: {
            label: "Infrastructure",
            description: "Database, authentication, and runtime",
            icon: ServerStack01Icon
        },
        connections: {
            label: "Connections",
            description: "Integration connections (MCP, OAuth, API keys)",
            icon: Link03Icon
        },
        tools: {
            label: "Tools",
            description: "Native registry and MCP tool availability",
            icon: Wrench01Icon
        },
        models: {
            label: "AI Models",
            description: "Provider connectivity and model inference",
            icon: AiBrain04Icon
        },
        skills: {
            label: "Skills",
            description: "Skill definitions, tools, and documents",
            icon: BookOpen01Icon
        },
        agents: {
            label: "Agents",
            description: "Agent resolution, hydration, and model binding",
            icon: UserStar01Icon
        },
        workflows: {
            label: "Workflows",
            description: "Workflow definitions and step validation",
            icon: WorkflowSquare06Icon
        },
        networks: {
            label: "Networks",
            description: "Network topology and primitive references",
            icon: NeuralNetworkIcon
        }
    };

const STATUS_COLORS: Record<string, string> = {
    ok: "bg-emerald-500",
    error: "bg-red-500",
    warning: "bg-amber-500",
    skipped: "bg-zinc-400 dark:bg-zinc-600",
    degraded: "bg-amber-500",
    healthy: "bg-emerald-500",
    critical: "bg-red-500"
};

function StatusDot({ status }: { status: string }) {
    return (
        <span
            className={cn(
                "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                STATUS_COLORS[status] ?? "bg-zinc-400"
            )}
        />
    );
}

function LayerSummaryBadge({ components }: { components: ComponentResult[] }) {
    const ok = components.filter((c) => c.status === "ok").length;
    const total = components.length;
    const allSkipped = components.every((c) => c.status === "skipped");

    if (allSkipped) {
        return (
            <Badge variant="outline" className="text-xs font-normal">
                skipped
            </Badge>
        );
    }

    const variant = ok === total ? "default" : "secondary";
    return (
        <Badge variant={variant} className="text-xs font-normal tabular-nums">
            {ok}/{total} passed
        </Badge>
    );
}

function ComponentCard({ component }: { component: ComponentResult }) {
    const [expanded, setExpanded] = useState(false);
    const hasError = component.error && component.status !== "ok";

    return (
        <div
            className={cn(
                "rounded-lg border px-4 py-3 transition-colors",
                component.status === "error" && "border-red-500/30 bg-red-500/5",
                component.status === "warning" && "border-amber-500/30 bg-amber-500/5",
                component.status === "ok" && "border-border",
                component.status === "skipped" && "border-border opacity-60"
            )}
        >
            <div className="flex items-center gap-3">
                <StatusDot status={component.status} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{component.name}</span>
                        {component.latencyMs != null && (
                            <span className="text-muted-foreground text-xs tabular-nums">
                                {component.latencyMs}ms
                            </span>
                        )}
                    </div>
                    {component.detail && (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {component.detail}
                        </p>
                    )}
                </div>
                {hasError && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                    >
                        <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            size={14}
                            className={cn("transition-transform", expanded && "rotate-180")}
                        />
                    </button>
                )}
            </div>
            {expanded && hasError && (
                <div className="mt-2 rounded-md bg-red-500/10 px-3 py-2">
                    <p className="text-xs break-words text-red-600 dark:text-red-400">
                        {component.error}
                    </p>
                </div>
            )}
        </div>
    );
}

function LayerSection({
    layer,
    result,
    isRunning,
    onTest
}: {
    layer: LayerName;
    result: LayerResult | null;
    isRunning: boolean;
    onTest: () => void;
}) {
    const meta = LAYER_META[layer];
    const [open, setOpen] = useState(false);

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <div className="rounded-lg border">
                <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center gap-4 px-5 py-4 text-left transition-colors">
                    <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                        <HugeiconsIcon icon={meta.icon} size={18} className="text-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{meta.label}</span>
                            {result && <LayerSummaryBadge components={result.components} />}
                            {isRunning && !result && (
                                <Badge variant="outline" className="text-xs font-normal">
                                    testing...
                                </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">{meta.description}</p>
                    </div>
                    {result && <StatusDot status={result.status} />}
                    <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        size={16}
                        className={cn(
                            "text-muted-foreground shrink-0 transition-transform",
                            open && "rotate-180"
                        )}
                    />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="border-t px-5 py-4">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">
                                {result
                                    ? `Tested at ${new Date(result.testedAt).toLocaleTimeString()}`
                                    : "Not tested yet"}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTest();
                                }}
                                disabled={isRunning}
                            >
                                {isRunning ? (
                                    <>
                                        <HugeiconsIcon
                                            icon={Loading03Icon}
                                            size={14}
                                            className="animate-spin"
                                        />
                                        Testing...
                                    </>
                                ) : (
                                    <>
                                        <HugeiconsIcon icon={PlayIcon} size={14} />
                                        Test Layer
                                    </>
                                )}
                            </Button>
                        </div>
                        {isRunning && !result && (
                            <div className="space-y-2">
                                <Skeleton className="h-14 w-full rounded-lg" />
                                <Skeleton className="h-14 w-full rounded-lg" />
                            </div>
                        )}
                        {result && (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {result.components.map((component) => (
                                    <ComponentCard key={component.id} component={component} />
                                ))}
                            </div>
                        )}
                        {!isRunning && !result && (
                            <p className="text-muted-foreground py-6 text-center text-sm">
                                Click &quot;Test Layer&quot; to run diagnostics
                            </p>
                        )}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

function OverallStatusHeader({
    status,
    testedAt,
    isRunning,
    onRunAll,
    onRunAllDeep
}: {
    status: "healthy" | "degraded" | "critical" | null;
    testedAt: string | null;
    isRunning: boolean;
    onRunAll: () => void;
    onRunAllDeep: () => void;
}) {
    const statusLabel =
        status === "healthy"
            ? "All Clear"
            : status === "degraded"
              ? "Degraded"
              : status === "critical"
                ? "Critical"
                : "Untested";

    const statusColor =
        status === "healthy"
            ? "text-emerald-600 dark:text-emerald-400"
            : status === "degraded"
              ? "text-amber-600 dark:text-amber-400"
              : status === "critical"
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground";

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
                <div className="mt-1 flex items-center gap-3">
                    {status && <StatusDot status={status} />}
                    <span className={cn("text-sm font-medium", statusColor)}>{statusLabel}</span>
                    {testedAt && (
                        <span className="text-muted-foreground text-xs">
                            Last run: {new Date(testedAt).toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onRunAllDeep} disabled={isRunning}>
                    {isRunning ? (
                        <>
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                size={14}
                                className="animate-spin"
                            />
                            Running...
                        </>
                    ) : (
                        <>
                            <HugeiconsIcon icon={Telescope01Icon} size={14} />
                            Deep Test
                        </>
                    )}
                </Button>
                <Button onClick={onRunAll} disabled={isRunning} size="sm">
                    {isRunning ? (
                        <>
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                size={14}
                                className="animate-spin"
                            />
                            Running...
                        </>
                    ) : (
                        <>
                            <HugeiconsIcon icon={PlayIcon} size={14} />
                            Run All
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

export default function SystemHealthPage() {
    const [layerResults, setLayerResults] = useState<Record<string, LayerResult>>({});
    const [runningLayers, setRunningLayers] = useState<Set<string>>(new Set());
    const [overallStatus, setOverallStatus] = useState<"healthy" | "degraded" | "critical" | null>(
        null
    );
    const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
    const [isRunningAll, setIsRunningAll] = useState(false);

    const testLayer = useCallback(async (layer: LayerName, deep = false) => {
        setRunningLayers((prev) => new Set(prev).add(layer));
        try {
            const res = await fetch(`${getApiBase()}/api/system/health`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ layers: [layer], deep })
            });
            const data: HealthResponse = await res.json();
            if (data.success && data.layers?.[0]) {
                setLayerResults((prev) => ({
                    ...prev,
                    [layer]: data.layers[0]!
                }));
            }
        } catch (err) {
            console.error(`Failed to test ${layer}:`, err);
        } finally {
            setRunningLayers((prev) => {
                const next = new Set(prev);
                next.delete(layer);
                return next;
            });
        }
    }, []);

    const runAll = useCallback(async (deep = false) => {
        setIsRunningAll(true);
        setRunningLayers(new Set(LAYER_ORDER));

        try {
            const res = await fetch(`${getApiBase()}/api/system/health`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deep })
            });
            const data: HealthResponse = await res.json();
            if (data.success) {
                const results: Record<string, LayerResult> = {};
                for (const lr of data.layers) {
                    results[lr.layer] = lr;
                }
                setLayerResults(results);
                setOverallStatus(data.status);
                setLastTestedAt(data.testedAt);
            }
        } catch (err) {
            console.error("Failed to run all tests:", err);
        } finally {
            setIsRunningAll(false);
            setRunningLayers(new Set());
        }
    }, []);

    return (
        <div className="mx-auto max-w-4xl px-6 py-8">
            <OverallStatusHeader
                status={overallStatus}
                testedAt={lastTestedAt}
                isRunning={isRunningAll}
                onRunAll={() => runAll(false)}
                onRunAllDeep={() => runAll(true)}
            />

            <Card className="mt-6">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">Dependency Chain</CardTitle>
                    <p className="text-muted-foreground text-xs">
                        Each layer depends on the layers above it. Test top-to-bottom to trace
                        failures to their root cause.
                    </p>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                    {LAYER_ORDER.map((layer) => (
                        <LayerSection
                            key={layer}
                            layer={layer}
                            result={layerResults[layer] ?? null}
                            isRunning={runningLayers.has(layer)}
                            onTest={() => testLayer(layer)}
                        />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
