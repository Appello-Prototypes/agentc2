"use client";

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
    TabsTrigger,
    Alert,
    AlertDescription
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

function mergeWithDefaults(partial: Record<string, unknown>): GuardrailConfig {
    const def = defaultConfig;
    const p = partial || {};
    const inp = (p.input as Record<string, unknown>) || {};
    const out = (p.output as Record<string, unknown>) || {};
    const exec = (p.execution as Record<string, unknown>) || {};
    return {
        input: {
            topicFiltering: {
                ...def.input.topicFiltering,
                ...((inp.topicFiltering as Record<string, unknown>) || {})
            } as GuardrailConfig["input"]["topicFiltering"],
            piiDetection: {
                ...def.input.piiDetection,
                ...((inp.piiDetection as Record<string, unknown>) || {})
            } as GuardrailConfig["input"]["piiDetection"],
            jailbreakDetection: {
                ...def.input.jailbreakDetection,
                ...((inp.jailbreakDetection as Record<string, unknown>) || {})
            },
            promptInjection: {
                ...def.input.promptInjection,
                ...((inp.promptInjection as Record<string, unknown>) || {})
            },
            maxInputLength:
                typeof inp.maxInputLength === "number"
                    ? inp.maxInputLength
                    : def.input.maxInputLength
        },
        output: {
            toxicityFilter: {
                ...def.output.toxicityFilter,
                ...((out.toxicityFilter as Record<string, unknown>) || {})
            } as GuardrailConfig["output"]["toxicityFilter"],
            hallucinationDetection: {
                ...def.output.hallucinationDetection,
                ...((out.hallucinationDetection as Record<string, unknown>) || {})
            },
            piiLeakPrevention: {
                ...def.output.piiLeakPrevention,
                ...((out.piiLeakPrevention as Record<string, unknown>) || {})
            },
            factualAccuracy: {
                ...def.output.factualAccuracy,
                ...((out.factualAccuracy as Record<string, unknown>) || {})
            },
            brandSafety: {
                ...def.output.brandSafety,
                ...((out.brandSafety as Record<string, unknown>) || {})
            } as GuardrailConfig["output"]["brandSafety"]
        },
        execution: {
            maxDuration:
                typeof exec.maxDuration === "number" ? exec.maxDuration : def.execution.maxDuration,
            maxToolCalls:
                typeof exec.maxToolCalls === "number"
                    ? exec.maxToolCalls
                    : def.execution.maxToolCalls,
            maxTokens:
                typeof exec.maxTokens === "number" ? exec.maxTokens : def.execution.maxTokens,
            costPerRequest:
                typeof exec.costPerRequest === "number"
                    ? exec.costPerRequest
                    : def.execution.costPerRequest,
            rateLimiting: {
                ...def.execution.rateLimiting,
                ...((exec.rateLimiting as Record<string, unknown>) || {})
            } as GuardrailConfig["execution"]["rateLimiting"]
        }
    };
}

export default function OrgGuardrailsPage() {
    const [orgId, setOrgId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<GuardrailConfig>(defaultConfig);
    const [activeTab, setActiveTab] = useState("input");
    const [hasChanges, setHasChanges] = useState(false);

    const fetchGuardrails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const orgRes = await fetch(`${getApiBase()}/api/user/organization`);
            const orgData = await orgRes.json();
            if (!orgData.success || !orgData.organization?.id) {
                setError("Failed to load organization");
                setLoading(false);
                return;
            }

            setOrgId(orgData.organization.id);

            const configRes = await fetch(
                `${getApiBase()}/api/organizations/${orgData.organization.id}/guardrails`
            );
            const configResult = await configRes.json();

            if (configResult.success && configResult.guardrailConfig?.configJson) {
                const raw = configResult.guardrailConfig.configJson as Record<string, unknown>;
                setConfig(mergeWithDefaults(raw));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load guardrails");
        } finally {
            setLoading(false);
        }
    }, []);

    const saveConfig = async () => {
        if (!orgId) return;
        try {
            setSaving(true);
            const response = await fetch(`${getApiBase()}/api/organizations/${orgId}/guardrails`, {
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

    if (error && !orgId) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Guardrails</h1>
                    <p className="text-muted-foreground">
                        Org-wide safety controls, content filtering, and execution limits
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Guardrails</h1>
                    <p className="text-muted-foreground">
                        Org-wide safety controls, content filtering, and execution limits
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

            <Alert>
                <AlertDescription>
                    These are org-wide defaults. Individual agents can override these in their own
                    guardrails settings.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle>Guardrail Configuration</CardTitle>
                    <CardDescription>
                        Configure org-wide safety rules applied to all agents by default
                    </CardDescription>
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
                                                maxInputLength: parseInt(e.target.value) || 0
                                            }
                                        }));
                                        setHasChanges(true);
                                    }}
                                />
                            </div>
                        </TabsContent>

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
                                                    maxDuration: parseInt(e.target.value) || 0
                                                }
                                            }));
                                            setHasChanges(true);
                                        }}
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        {(config.execution.maxDuration / 1000).toFixed(0)} seconds
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
                                                    maxToolCalls: parseInt(e.target.value) || 0
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
                                                    costPerRequest: parseFloat(e.target.value) || 0
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
                                            value={config.execution.rateLimiting.requestsPerMinute}
                                            onChange={(e) => {
                                                setConfig((p) => ({
                                                    ...p,
                                                    execution: {
                                                        ...p.execution,
                                                        rateLimiting: {
                                                            ...p.execution.rateLimiting,
                                                            requestsPerMinute:
                                                                parseInt(e.target.value) || 0
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
    );
}
