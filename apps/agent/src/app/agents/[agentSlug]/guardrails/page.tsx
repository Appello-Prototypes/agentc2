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
    Input,
    Label,
    Skeleton,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface GuardrailConfig {
    input: {
        topicFiltering: { enabled: boolean; blockedTopics: string[] };
        piiDetection: { enabled: boolean; action: "block" | "mask" };
        jailbreakDetection: { enabled: boolean };
        promptInjection: { enabled: boolean };
        maxInputLength: number;
    };
    output: {
        toxicityFilter: { enabled: boolean; threshold: number };
        hallucinationDetection: { enabled: boolean };
        piiLeakPrevention: { enabled: boolean };
        factualAccuracy: { enabled: boolean };
        brandSafety: { enabled: boolean; guidelines: string };
    };
    execution: {
        maxDuration: number;
        maxToolCalls: number;
        maxTokens: number;
        costPerRequest: number;
        rateLimiting: { enabled: boolean; requestsPerMinute: number };
    };
}

interface GuardrailEvent {
    id: string;
    type: "blocked" | "modified" | "flagged";
    guardrail: string;
    reason: string;
    input: string;
    timestamp: string;
}

interface EventSummary {
    totalRuns: number;
    totalEvents: number;
    blocked: number;
    modified: number;
    flagged: number;
}

const defaultConfig: GuardrailConfig = {
    input: {
        topicFiltering: { enabled: true, blockedTopics: ["violence", "illegal activities"] },
        piiDetection: { enabled: true, action: "mask" },
        jailbreakDetection: { enabled: true },
        promptInjection: { enabled: true },
        maxInputLength: 10000
    },
    output: {
        toxicityFilter: { enabled: true, threshold: 0.8 },
        hallucinationDetection: { enabled: false },
        piiLeakPrevention: { enabled: true },
        factualAccuracy: { enabled: false },
        brandSafety: { enabled: true, guidelines: "Maintain professional, helpful tone" }
    },
    execution: {
        maxDuration: 30000,
        maxToolCalls: 10,
        maxTokens: 4096,
        costPerRequest: 0.1,
        rateLimiting: { enabled: true, requestsPerMinute: 60 }
    }
};

export default function GuardrailsPage() {
    const params = useParams();
    const router = useRouter();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<GuardrailConfig>(defaultConfig);
    const [events, setEvents] = useState<GuardrailEvent[]>([]);
    const [eventSummary, setEventSummary] = useState<EventSummary>({
        totalRuns: 0,
        totalEvents: 0,
        blocked: 0,
        modified: 0,
        flagged: 0
    });
    const [activeTab, setActiveTab] = useState("input");
    const [hasChanges, setHasChanges] = useState(false);

    const fetchGuardrails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch guardrail config and events in parallel
            const [configRes, eventsRes] = await Promise.all([
                fetch(`${getApiBase()}/api/agents/${agentSlug}/guardrails`),
                fetch(`${getApiBase()}/api/agents/${agentSlug}/guardrails/events`)
            ]);

            const [configResult, eventsResult] = await Promise.all([
                configRes.json(),
                eventsRes.json()
            ]);

            // Handle guardrail config
            if (configResult.success && configResult.guardrailConfig?.configJson) {
                setConfig(configResult.guardrailConfig.configJson as GuardrailConfig);
            }

            // Handle events
            if (eventsResult.success) {
                const transformedEvents: GuardrailEvent[] = eventsResult.events.map(
                    (e: {
                        id: string;
                        type: string;
                        guardrailKey: string;
                        reason: string;
                        inputSnippet?: string;
                        createdAt: string;
                    }) => ({
                        id: e.id,
                        type: e.type.toLowerCase() as "blocked" | "modified" | "flagged",
                        guardrail: e.guardrailKey,
                        reason: e.reason,
                        input: e.inputSnippet || "",
                        timestamp: e.createdAt
                    })
                );
                setEvents(transformedEvents);
                setEventSummary(
                    eventsResult.summary || {
                        totalRuns: 0,
                        totalEvents: 0,
                        blocked: 0,
                        modified: 0,
                        flagged: 0
                    }
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load guardrails");
        } finally {
            setLoading(false);
        }
    }, [agentSlug]);

    const saveConfig = async () => {
        try {
            setSaving(true);
            const response = await fetch(`${getApiBase()}/api/agents/${agentSlug}/guardrails`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ configJson: config })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || "Failed to save guardrails");
            }

            setHasChanges(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save guardrails");
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchGuardrails();
    }, [fetchGuardrails]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (error && !config) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Guardrails</h1>
                    <p className="text-muted-foreground">
                        Safety controls, content filtering, and execution limits
                    </p>
                </div>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={fetchGuardrails}>Retry</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Calculate percentages
    const totalRuns = eventSummary.totalRuns;
    const blockedPct =
        totalRuns > 0 ? ((eventSummary.blocked / totalRuns) * 100).toFixed(1) : "0.0";
    const modifiedPct =
        totalRuns > 0 ? ((eventSummary.modified / totalRuns) * 100).toFixed(1) : "0.0";
    const flaggedPct =
        totalRuns > 0 ? ((eventSummary.flagged / totalRuns) * 100).toFixed(1) : "0.0";

    // Check if guardrails are actually enforced (no events = likely not enforced)
    const noGuardrailEvents = eventSummary.totalEvents === 0 && totalRuns > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Guardrails</h1>
                    <p className="text-muted-foreground">
                        Safety controls, content filtering, and execution limits
                    </p>
                </div>
                <div className="flex gap-2">
                    {hasChanges && (
                        <Badge variant="outline" className="text-yellow-600">
                            Unsaved Changes
                        </Badge>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => {
                            setConfig(defaultConfig);
                            setHasChanges(false);
                        }}
                    >
                        Reset
                    </Button>
                    <Button disabled={!hasChanges || saving} onClick={saveConfig}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>

            {/* Warning: Guardrails not enforced */}
            {noGuardrailEvents && (
                <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardContent className="flex items-start gap-3 py-4">
                        <span className="text-yellow-600">⚠️</span>
                        <div>
                            <p className="font-medium text-yellow-800 dark:text-yellow-200">
                                Guardrails Not Enforced
                            </p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                No guardrail events have been triggered despite {totalRuns} runs.
                                Guardrail configuration is saved but enforcement is not yet
                                implemented in the agent execution pipeline.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Runs (7d)</CardDescription>
                        <CardTitle className="text-2xl">{totalRuns}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Blocked (7d)</CardDescription>
                        <div className="flex items-baseline gap-2">
                            <CardTitle className="text-2xl text-red-600">
                                {eventSummary.blocked}
                            </CardTitle>
                            <span className="text-muted-foreground text-sm">({blockedPct}%)</span>
                        </div>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Modified (7d)</CardDescription>
                        <div className="flex items-baseline gap-2">
                            <CardTitle className="text-2xl text-yellow-600">
                                {eventSummary.modified}
                            </CardTitle>
                            <span className="text-muted-foreground text-sm">({modifiedPct}%)</span>
                        </div>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Flagged (7d)</CardDescription>
                        <div className="flex items-baseline gap-2">
                            <CardTitle className="text-2xl text-blue-600">
                                {eventSummary.flagged}
                            </CardTitle>
                            <span className="text-muted-foreground text-sm">({flaggedPct}%)</span>
                        </div>
                    </CardHeader>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Configuration */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Guardrail Configuration</CardTitle>
                            <CardDescription>Configure safety rules for your agent</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs
                                defaultValue="active"
                                value={activeTab}
                                onValueChange={(v) => v && setActiveTab(v)}
                            >
                                <TabsList className="mb-4">
                                    <TabsTrigger value="input">Input Guards</TabsTrigger>
                                    <TabsTrigger value="output">Output Guards</TabsTrigger>
                                    <TabsTrigger value="execution">Execution Limits</TabsTrigger>
                                </TabsList>

                                {/* Input Guards */}
                                <TabsContent value="input" className="space-y-6">
                                    <div className="bg-muted flex items-center justify-between rounded-lg p-4">
                                        <div>
                                            <Label>Topic Filtering</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Block requests containing prohibited topics
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.input.topicFiltering.enabled}
                                            onCheckedChange={(checked) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    input: {
                                                        ...p.input,
                                                        topicFiltering: {
                                                            ...p.input.topicFiltering,
                                                            enabled: checked
                                                        }
                                                    }
                                                }));
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>

                                    <div className="bg-muted flex items-center justify-between rounded-lg p-4">
                                        <div>
                                            <Label>PII Detection</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Detect and mask personal information
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.input.piiDetection.enabled}
                                            onCheckedChange={(checked) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    input: {
                                                        ...p.input,
                                                        piiDetection: {
                                                            ...p.input.piiDetection,
                                                            enabled: checked
                                                        }
                                                    }
                                                }));
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>

                                    <div className="bg-muted flex items-center justify-between rounded-lg p-4">
                                        <div>
                                            <Label>Jailbreak Detection</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Block attempts to bypass agent instructions
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.input.jailbreakDetection.enabled}
                                            onCheckedChange={(checked) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    input: {
                                                        ...p.input,
                                                        jailbreakDetection: {
                                                            ...p.input.jailbreakDetection,
                                                            enabled: checked
                                                        }
                                                    }
                                                }));
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>

                                    <div className="bg-muted flex items-center justify-between rounded-lg p-4">
                                        <div>
                                            <Label>Prompt Injection Prevention</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Detect and block prompt injection attacks
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.input.promptInjection.enabled}
                                            onCheckedChange={(checked) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    input: {
                                                        ...p.input,
                                                        promptInjection: {
                                                            ...p.input.promptInjection,
                                                            enabled: checked
                                                        }
                                                    }
                                                }));
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Max Input Length (characters)</Label>
                                        <Input
                                            type="number"
                                            value={config.input.maxInputLength}
                                            onChange={(e) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    input: {
                                                        ...p.input,
                                                        maxInputLength:
                                                            parseInt(e.target.value) || 0
                                                    }
                                                }));
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>
                                </TabsContent>

                                {/* Output Guards */}
                                <TabsContent value="output" className="space-y-6">
                                    <div className="bg-muted flex items-center justify-between rounded-lg p-4">
                                        <div>
                                            <Label>Toxicity Filter</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Block toxic or harmful responses
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.output.toxicityFilter.enabled}
                                            onCheckedChange={(checked) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    output: {
                                                        ...p.output,
                                                        toxicityFilter: {
                                                            ...p.output.toxicityFilter,
                                                            enabled: checked
                                                        }
                                                    }
                                                }));
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>

                                    <div className="bg-muted flex items-center justify-between rounded-lg p-4">
                                        <div>
                                            <Label>Hallucination Detection</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Flag responses that may contain made-up information
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.output.hallucinationDetection.enabled}
                                            onCheckedChange={(checked) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    output: {
                                                        ...p.output,
                                                        hallucinationDetection: {
                                                            ...p.output.hallucinationDetection,
                                                            enabled: checked
                                                        }
                                                    }
                                                }));
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>

                                    <div className="bg-muted flex items-center justify-between rounded-lg p-4">
                                        <div>
                                            <Label>PII Leak Prevention</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Prevent exposing sensitive data in responses
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.output.piiLeakPrevention.enabled}
                                            onCheckedChange={(checked) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    output: {
                                                        ...p.output,
                                                        piiLeakPrevention: {
                                                            ...p.output.piiLeakPrevention,
                                                            enabled: checked
                                                        }
                                                    }
                                                }));
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>

                                    <div className="bg-muted flex items-center justify-between rounded-lg p-4">
                                        <div>
                                            <Label>Brand Safety</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Ensure responses align with brand guidelines
                                            </p>
                                        </div>
                                        <Switch
                                            checked={config.output.brandSafety.enabled}
                                            onCheckedChange={(checked) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    output: {
                                                        ...p.output,
                                                        brandSafety: {
                                                            ...p.output.brandSafety,
                                                            enabled: checked
                                                        }
                                                    }
                                                }));
                                                setHasChanges(true);
                                            }}
                                        />
                                    </div>
                                </TabsContent>

                                {/* Execution Limits */}
                                <TabsContent value="execution" className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Max Duration (ms)</Label>
                                            <Input
                                                type="number"
                                                value={config.execution.maxDuration}
                                                onChange={(e) => {
                                                    setConfig((p) => ({
                                                        ...p,
                                                        execution: {
                                                            ...p.execution,
                                                            maxDuration:
                                                                parseInt(e.target.value) || 0
                                                        }
                                                    }));
                                                    setHasChanges(true);
                                                }}
                                            />
                                            <p className="text-muted-foreground text-xs">
                                                {(config.execution.maxDuration / 1000).toFixed(0)}{" "}
                                                seconds
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Max Tool Calls</Label>
                                            <Input
                                                type="number"
                                                value={config.execution.maxToolCalls}
                                                onChange={(e) => {
                                                    setConfig((p) => ({
                                                        ...p,
                                                        execution: {
                                                            ...p.execution,
                                                            maxToolCalls:
                                                                parseInt(e.target.value) || 0
                                                        }
                                                    }));
                                                    setHasChanges(true);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Max Tokens per Request</Label>
                                            <Input
                                                type="number"
                                                value={config.execution.maxTokens}
                                                onChange={(e) => {
                                                    setConfig((p) => ({
                                                        ...p,
                                                        execution: {
                                                            ...p.execution,
                                                            maxTokens: parseInt(e.target.value) || 0
                                                        }
                                                    }));
                                                    setHasChanges(true);
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Max Cost per Request ($)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={config.execution.costPerRequest}
                                                onChange={(e) => {
                                                    setConfig((p) => ({
                                                        ...p,
                                                        execution: {
                                                            ...p.execution,
                                                            costPerRequest:
                                                                parseFloat(e.target.value) || 0
                                                        }
                                                    }));
                                                    setHasChanges(true);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-muted space-y-4 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label>Rate Limiting</Label>
                                                <p className="text-muted-foreground text-xs">
                                                    Limit requests per minute
                                                </p>
                                            </div>
                                            <Switch
                                                checked={config.execution.rateLimiting.enabled}
                                                onCheckedChange={(checked) => {
                                                    setConfig((p) => ({
                                                        ...p,
                                                        execution: {
                                                            ...p.execution,
                                                            rateLimiting: {
                                                                ...p.execution.rateLimiting,
                                                                enabled: checked
                                                            }
                                                        }
                                                    }));
                                                    setHasChanges(true);
                                                }}
                                            />
                                        </div>
                                        {config.execution.rateLimiting.enabled && (
                                            <div className="space-y-2">
                                                <Label>Requests per Minute</Label>
                                                <Input
                                                    type="number"
                                                    value={
                                                        config.execution.rateLimiting
                                                            .requestsPerMinute
                                                    }
                                                    onChange={(e) => {
                                                        setConfig((p) => ({
                                                            ...p,
                                                            execution: {
                                                                ...p.execution,
                                                                rateLimiting: {
                                                                    ...p.execution.rateLimiting,
                                                                    requestsPerMinute:
                                                                        parseInt(e.target.value) ||
                                                                        0
                                                                }
                                                            }
                                                        }));
                                                        setHasChanges(true);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Events */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Events</CardTitle>
                        <CardDescription>Guardrail triggers</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {events.map((event) => (
                                <div key={event.id} className="rounded-lg border p-3">
                                    <div className="mb-1 flex items-center gap-2">
                                        <Badge
                                            variant={
                                                event.type === "blocked"
                                                    ? "destructive"
                                                    : event.type === "modified"
                                                      ? "secondary"
                                                      : "outline"
                                            }
                                        >
                                            {event.type}
                                        </Badge>
                                        <span className="text-muted-foreground text-xs">
                                            {event.guardrail}
                                        </span>
                                    </div>
                                    <p className="text-sm">{event.reason}</p>
                                    <p className="text-muted-foreground mt-2 text-xs">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            className="mt-4 w-full"
                            onClick={() =>
                                router.push(`/agents/${agentSlug}/runs?filter=guardrail`)
                            }
                        >
                            View All Events
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
