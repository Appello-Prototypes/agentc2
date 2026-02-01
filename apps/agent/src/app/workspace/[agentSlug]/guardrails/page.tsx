"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
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

const mockEvents: GuardrailEvent[] = [
    {
        id: "evt-1",
        type: "blocked",
        guardrail: "Topic Filtering",
        reason: "Request contained blocked topic: violence",
        input: "How to [blocked content]...",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
        id: "evt-2",
        type: "modified",
        guardrail: "PII Detection",
        reason: "Email address masked in input",
        input: "Contact me at [MASKED]@example.com",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
    },
    {
        id: "evt-3",
        type: "flagged",
        guardrail: "Toxicity Filter",
        reason: "Output flagged for review (score: 0.72)",
        input: "Respond aggressively to this complaint...",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
    }
];

export default function GuardrailsPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<GuardrailConfig>(defaultConfig);
    const [events, setEvents] = useState<GuardrailEvent[]>([]);
    const [activeTab, setActiveTab] = useState("input");
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setConfig(defaultConfig);
            setEvents(mockEvents);
            setLoading(false);
        }, 500);
    }, [agentSlug]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    const stats = {
        blocked: events.filter((e) => e.type === "blocked").length,
        modified: events.filter((e) => e.type === "modified").length,
        flagged: events.filter((e) => e.type === "flagged").length
    };

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
                    <Button disabled={!hasChanges}>Save Changes</Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Blocked (24h)</CardDescription>
                        <CardTitle className="text-2xl text-red-600">{stats.blocked}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Modified (24h)</CardDescription>
                        <CardTitle className="text-2xl text-yellow-600">{stats.modified}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Flagged (24h)</CardDescription>
                        <CardTitle className="text-2xl text-blue-600">{stats.flagged}</CardTitle>
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
                        <Button variant="outline" className="mt-4 w-full">
                            View All Events
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
