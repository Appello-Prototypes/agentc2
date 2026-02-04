"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
    Badge,
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { BuilderShell } from "@/components/builder/BuilderShell";
import { OutlinePanel, type OutlineSection } from "@/components/builder/OutlinePanel";
import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas";
import { WorkflowNode } from "@/components/workflows/WorkflowNode";
import { workflowEdgeTypes } from "@/components/workflows/WorkflowEdge";
import {
    applyJsonPatch,
    patchTouchesProtectedPaths,
    type JsonPatchOperation
} from "@/lib/json-patch";
import { useBuilderSelection } from "@/hooks/useBuilderSelection";
import type { NodeTypes } from "@xyflow/react";

type StepType =
    | "agent"
    | "tool"
    | "workflow"
    | "branch"
    | "parallel"
    | "foreach"
    | "human"
    | "transform"
    | "delay";

interface StepForm {
    id: string;
    type: StepType;
    name?: string;
    inputMappingText: string;
    configText: string;
}

interface WorkflowStepDefinition {
    id: string;
    type: StepType;
    name?: string;
    inputMapping?: Record<string, unknown>;
    config?: Record<string, unknown>;
}

interface WorkflowDefinition {
    steps: WorkflowStepDefinition[];
}

interface ChatProposal {
    id: string;
    summary: string;
    patch: JsonPatchOperation[];
    beforeJson: string;
    afterJson: string;
    createdAt: string;
    applied?: boolean;
    requiresConfirmation?: boolean;
}

const SECTION_LABELS = ["Triggers", "Routers", "Actions", "Subflows", "Errors/Handlers"] as const;

const STEP_SECTION_MAP: Record<StepType, (typeof SECTION_LABELS)[number]> = {
    branch: "Routers",
    parallel: "Routers",
    foreach: "Routers",
    agent: "Actions",
    tool: "Actions",
    workflow: "Subflows",
    human: "Actions",
    transform: "Actions",
    delay: "Actions"
};

function stepsFromDefinition(definition: WorkflowDefinition): StepForm[] {
    return (definition.steps || []).map((step) => ({
        id: step.id,
        type: step.type,
        name: step.name,
        inputMappingText: JSON.stringify(step.inputMapping || {}, null, 2),
        configText: JSON.stringify(step.config || {}, null, 2)
    }));
}

function definitionFromSteps(steps: StepForm[]): WorkflowDefinition {
    return {
        steps: steps.map((step) => ({
            id: step.id,
            type: step.type,
            name: step.name,
            inputMapping: safeParseJson(step.inputMappingText, {}),
            config: safeParseJson(step.configText, {})
        }))
    };
}

function safeParseJson(value: string, fallback: Record<string, unknown>) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function getStepBadges(step: StepForm, invalidIds: Set<string>, missingMappingIds: Set<string>) {
    const badges: {
        label: string;
        variant?: "default" | "secondary" | "destructive" | "outline";
    }[] = [];
    if (invalidIds.has(step.id)) {
        badges.push({ label: "Invalid", variant: "destructive" });
    }
    if (missingMappingIds.has(step.id)) {
        badges.push({ label: "Mapping", variant: "secondary" });
    }
    return badges;
}

export default function WorkflowDesignPage() {
    const params = useParams();
    const workflowSlug = params.workflowSlug as string;
    const [steps, setSteps] = useState<StepForm[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiGenerating, setAiGenerating] = useState(false);
    const [outlineSearch, setOutlineSearch] = useState("");
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [validationLoading, setValidationLoading] = useState(false);
    const [inspectorTab, setInspectorTab] = useState("details");
    const [jsonPowerMode, setJsonPowerMode] = useState(false);
    const [jsonDraft, setJsonDraft] = useState("");
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatProposals, setChatProposals] = useState<ChatProposal[]>([]);
    const [confirmedProposals, setConfirmedProposals] = useState<Record<string, boolean>>({});
    const [history, setHistory] = useState<WorkflowDefinition[]>([]);

    const compiledDefinition = useMemo(() => definitionFromSteps(steps), [steps]);

    const defaultSelection = useMemo(
        () => (steps.length > 0 ? { kind: "step", id: steps[0].id } : null),
        [steps]
    );
    const { selected, setSelection } = useBuilderSelection(defaultSelection);

    useEffect(() => {
        if (!selected && steps.length > 0) {
            setSelection({ kind: "step", id: steps[0].id });
        }
    }, [selected, steps, setSelection]);

    useEffect(() => {
        const fetchWorkflow = async () => {
            const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}`);
            const data = await res.json();
            const definition = data.workflow?.definitionJson || { steps: [] };
            setSteps(stepsFromDefinition(definition));
        };
        fetchWorkflow();
    }, [workflowSlug]);

    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                setValidationLoading(true);
                const res = await fetch(`${getApiBase()}/api/workflows/validate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ definitionJson: compiledDefinition })
                });
                const data = await res.json();
                setValidationErrors(data.errors || []);
            } catch {
                setValidationErrors([]);
            } finally {
                setValidationLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [compiledDefinition]);

    const invalidStepIds = useMemo(() => {
        return new Set(
            steps
                .filter((step) => validationErrors.some((errorText) => errorText.includes(step.id)))
                .map((step) => step.id)
        );
    }, [steps, validationErrors]);

    const missingMappingIds = useMemo(() => {
        return new Set(
            steps
                .filter((step) => {
                    const trimmed = step.inputMappingText.trim();
                    return trimmed === "" || trimmed === "{}";
                })
                .map((step) => step.id)
        );
    }, [steps]);

    const updateStep = (stepId: string, updates: Partial<StepForm>) => {
        setSteps((prev) =>
            prev.map((step) => (step.id === stepId ? { ...step, ...updates } : step))
        );
    };

    const addStep = () => {
        setSteps((prev) => [
            ...prev,
            {
                id: `step-${prev.length + 1}`,
                type: "agent",
                name: `Step ${prev.length + 1}`,
                inputMappingText: "{}",
                configText: "{}"
            }
        ]);
    };

    const removeStep = (stepId: string) => {
        setSteps((prev) => prev.filter((step) => step.id !== stepId));
        if (selected?.kind === "step" && selected.id === stepId) {
            setSelection(null);
        }
    };

    const saveWorkflow = async () => {
        try {
            setSaving(true);
            setError(null);

            const validateRes = await fetch(`${getApiBase()}/api/workflows/validate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ definitionJson: compiledDefinition })
            });
            const validateData = await validateRes.json();
            if (!validateData.valid) {
                throw new Error(validateData.errors?.join("; ") || "Workflow validation failed");
            }

            const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    definitionJson: compiledDefinition
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save workflow");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save workflow");
        } finally {
            setSaving(false);
        }
    };

    const generateWithAi = async () => {
        if (!aiPrompt.trim()) return;
        try {
            setAiGenerating(true);
            setError(null);
            const res = await fetch(`${getApiBase()}/api/workflows/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: aiPrompt })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to generate workflow");
            }
            if (!data.validation?.valid) {
                throw new Error(data.validation?.errors?.join("; ") || "Validation failed");
            }
            setSteps(stepsFromDefinition(data.definitionJson));
        } catch (err) {
            setError(err instanceof Error ? err.message : "AI generation failed");
        } finally {
            setAiGenerating(false);
        }
    };

    const nodeTypes: NodeTypes = useMemo(
        () => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            workflow: WorkflowNode as any
        }),
        []
    );

    const flowNodes = useMemo(() => {
        return steps.map((step, index) => ({
            id: step.id,
            type: "workflow",
            position: { x: 140, y: index * 140 },
            data: {
                label: step.name || step.id,
                description: step.type,
                status: invalidStepIds.has(step.id) ? "error" : "pending",
                badges: getStepBadges(step, invalidStepIds, missingMappingIds)
            }
        }));
    }, [steps, invalidStepIds, missingMappingIds]);

    const flowEdges = useMemo(() => {
        return steps.slice(1).map((step, index) => ({
            id: `edge-${steps[index].id}-${step.id}`,
            source: steps[index].id,
            target: step.id,
            type: "temporary",
            data: { label: "" }
        }));
    }, [steps]);

    const selectedStep = useMemo(
        () => (selected?.kind === "step" ? steps.find((step) => step.id === selected.id) : null),
        [selected, steps]
    );

    const selectedEdge = useMemo(
        () =>
            selected?.kind === "edge" ? flowEdges.find((edge) => edge.id === selected.id) : null,
        [selected, flowEdges]
    );

    const selectedEntityJson = useMemo(() => {
        if (selectedStep) {
            return compiledDefinition.steps.find((step) => step.id === selectedStep.id);
        }
        if (selectedEdge) {
            return selectedEdge;
        }
        return null;
    }, [compiledDefinition, selectedStep, selectedEdge]);

    useEffect(() => {
        if (selectedEntityJson) {
            setJsonDraft(JSON.stringify(selectedEntityJson, null, 2));
            setJsonError(null);
        } else {
            setJsonDraft("");
        }
    }, [selectedEntityJson]);

    const outlineSections: OutlineSection[] = useMemo(() => {
        const search = outlineSearch.trim().toLowerCase();
        const filterItem = (label: string, description?: string) => {
            if (!search) return true;
            return (
                label.toLowerCase().includes(search) ||
                (description ? description.toLowerCase().includes(search) : false)
            );
        };

        const stepItems = steps.map((step) => ({
            id: step.id,
            kind: "step",
            label: step.name || step.id,
            description: step.type,
            meta: step.id,
            badges: getStepBadges(step, invalidStepIds, missingMappingIds)
        }));

        const edgeItems = flowEdges.map((edge) => ({
            id: edge.id,
            kind: "edge",
            label: `${edge.source} → ${edge.target}`,
            description: "route",
            meta: edge.id
        }));

        const sections: OutlineSection[] = SECTION_LABELS.map((label) => ({
            id: label,
            label,
            items: [],
            emptyState: "No items"
        }));

        stepItems.forEach((item) => {
            if (!filterItem(item.label, item.description)) return;
            const step = steps.find((candidate) => candidate.id === item.id);
            const sectionLabel = step ? STEP_SECTION_MAP[step.type] : "Actions";
            const section = sections.find((entry) => entry.label === sectionLabel);
            section?.items.push(item);
        });

        edgeItems.forEach((item) => {
            if (!filterItem(item.label, item.description)) return;
            const section = sections.find((entry) => entry.label === "Routers");
            section?.items.push(item);
        });

        return sections;
    }, [outlineSearch, steps, flowEdges, invalidStepIds, missingMappingIds]);

    const availableTokens = useMemo(() => {
        const tokens = steps.map((step) => `{{steps.${step.id}.output}}`);
        tokens.unshift("{{input}}");
        tokens.push("{{context}}");
        return tokens;
    }, [steps]);

    const handleChatSubmit = async () => {
        if (!chatInput.trim()) return;
        try {
            setChatLoading(true);
            const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}/designer-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: chatInput,
                    definitionJson: compiledDefinition,
                    selected
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to generate proposal");
            }
            const nextDefinition = applyJsonPatch(compiledDefinition, data.patch || []);
            const proposalId =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random()}`;
            const proposal: ChatProposal = {
                id: proposalId,
                summary: data.summary || "Proposed change",
                patch: data.patch || [],
                beforeJson: JSON.stringify(compiledDefinition, null, 2),
                afterJson: JSON.stringify(nextDefinition, null, 2),
                createdAt: new Date().toISOString(),
                requiresConfirmation: patchTouchesProtectedPaths(data.patch || [], ["/steps/"])
            };
            setChatProposals((prev) => [proposal, ...prev]);
            setChatInput("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate proposal");
        } finally {
            setChatLoading(false);
        }
    };

    const applyProposal = (proposal: ChatProposal) => {
        try {
            const nextDefinition = applyJsonPatch(compiledDefinition, proposal.patch);
            setHistory((prev) => [compiledDefinition, ...prev]);
            setSteps(stepsFromDefinition(nextDefinition));
            setChatProposals((prev) =>
                prev.map((item) => (item.id === proposal.id ? { ...item, applied: true } : item))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to apply proposal");
        }
    };

    const undoLastChange = () => {
        setHistory((prev) => {
            if (prev.length === 0) return prev;
            const [latest, ...rest] = prev;
            setSteps(stepsFromDefinition(latest));
            return rest;
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Workflow Designer</h1>
                    <p className="text-muted-foreground text-sm">
                        Build the workflow definition with a unified builder experience.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={saveWorkflow} disabled={saving}>
                        {saving ? "Saving..." : "Save workflow"}
                    </Button>
                    <Button onClick={addStep}>Add step</Button>
                </div>
            </div>

            <BuilderShell
                outline={
                    <OutlinePanel
                        title="Outline"
                        searchValue={outlineSearch}
                        onSearchChange={setOutlineSearch}
                        searchPlaceholder="Search steps..."
                        sections={outlineSections}
                        selected={selected}
                        onSelect={setSelection}
                        headerActions={
                            validationLoading ? (
                                <Badge variant="secondary" className="text-[10px]">
                                    Validating
                                </Badge>
                            ) : validationErrors.length > 0 ? (
                                <Badge variant="destructive" className="text-[10px]">
                                    {validationErrors.length} issues
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-[10px]">
                                    Valid
                                </Badge>
                            )
                        }
                        footer={
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" onClick={addStep}>
                                    Add step
                                </Button>
                                {history.length > 0 && (
                                    <Button variant="ghost" onClick={undoLastChange}>
                                        Undo last change
                                    </Button>
                                )}
                            </div>
                        }
                    />
                }
                canvas={
                    <WorkflowCanvas
                        nodes={flowNodes}
                        edges={flowEdges}
                        nodeTypes={nodeTypes}
                        edgeTypes={workflowEdgeTypes}
                        className="h-full"
                        showMiniMap
                        showBackground
                        panOnScroll
                        zoomOnScroll
                        onNodeClick={(_, node) => setSelection({ kind: "step", id: node.id })}
                        onEdgeClick={(_, edge) => setSelection({ kind: "edge", id: edge.id })}
                        selectedNodeIds={selected?.kind === "step" ? [selected.id] : []}
                        selectedEdgeIds={selected?.kind === "edge" ? [selected.id] : []}
                    />
                }
                inspector={
                    <div className="flex h-full flex-col">
                        <div className="border-b p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-sm font-semibold">
                                        {selectedStep?.name || selectedEdge?.id || "Select an item"}
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                        {selectedStep
                                            ? `${selectedStep.type} step`
                                            : selectedEdge
                                              ? "Connection"
                                              : "No selection"}
                                    </div>
                                </div>
                                {selectedStep && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeStep(selectedStep.id)}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3">
                            {error && (
                                <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-500">
                                    {error}
                                </div>
                            )}

                            <Tabs defaultValue="details" value={inspectorTab} onValueChange={setInspectorTab}>
                                <TabsList className="mb-3 w-full">
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                    <TabsTrigger value="mappings">Mappings</TabsTrigger>
                                    <TabsTrigger value="config">Config</TabsTrigger>
                                    <TabsTrigger value="json">JSON</TabsTrigger>
                                    <TabsTrigger value="chat">Chat</TabsTrigger>
                                </TabsList>

                                <TabsContent value="details" className="space-y-4">
                                    {selectedStep ? (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Step name</Label>
                                                <Input
                                                    value={selectedStep.name || ""}
                                                    onChange={(event) =>
                                                        updateStep(selectedStep.id, {
                                                            name: event.target.value
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Step type</Label>
                                                <Select
                                                    value={selectedStep.type}
                                                    onValueChange={(value) => {
                                                        if (value) {
                                                            updateStep(selectedStep.id, {
                                                                type: value as StepType
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {[
                                                            "agent",
                                                            "tool",
                                                            "workflow",
                                                            "branch",
                                                            "parallel",
                                                            "foreach",
                                                            "human",
                                                            "transform",
                                                            "delay"
                                                        ].map((type) => (
                                                            <SelectItem key={type} value={type}>
                                                                {type}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1 text-xs">
                                                <div className="text-muted-foreground">Step ID</div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <code className="text-xs">
                                                        {selectedStep.id}
                                                    </code>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            navigator.clipboard.writeText(
                                                                selectedStep.id
                                                            )
                                                        }
                                                    >
                                                        Copy
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : selectedEdge ? (
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <div className="text-muted-foreground text-xs">
                                                    Edge ID
                                                </div>
                                                <div className="font-medium">{selectedEdge.id}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground text-xs">
                                                    Source
                                                </div>
                                                <div className="font-medium">
                                                    {selectedEdge.source}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground text-xs">
                                                    Target
                                                </div>
                                                <div className="font-medium">
                                                    {selectedEdge.target}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground text-sm">
                                            Select a step to edit details.
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="mappings" className="space-y-3">
                                    {selectedStep ? (
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div className="rounded border p-2">
                                                <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                                                    Available Data
                                                </div>
                                                <div className="space-y-1">
                                                    {availableTokens.map((token) => (
                                                        <Button
                                                            key={token}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full justify-start text-xs"
                                                            onClick={() =>
                                                                navigator.clipboard.writeText(token)
                                                            }
                                                        >
                                                            {token}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="rounded border p-2 md:col-span-2">
                                                <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                                                    Mapping Rules
                                                </div>
                                                <Textarea
                                                    rows={10}
                                                    value={selectedStep.inputMappingText}
                                                    onChange={(event) =>
                                                        updateStep(selectedStep.id, {
                                                            inputMappingText: event.target.value
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground text-sm">
                                            Select a step to edit mappings.
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="config" className="space-y-3">
                                    {selectedStep ? (
                                        <Textarea
                                            rows={10}
                                            value={selectedStep.configText}
                                            onChange={(event) =>
                                                updateStep(selectedStep.id, {
                                                    configText: event.target.value
                                                })
                                            }
                                        />
                                    ) : (
                                        <div className="text-muted-foreground text-sm">
                                            Select a step to edit config.
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="json" className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium">Power mode</div>
                                        <Switch
                                            checked={jsonPowerMode}
                                            onCheckedChange={setJsonPowerMode}
                                            size="sm"
                                        />
                                    </div>
                                    {jsonError && (
                                        <div className="text-destructive text-xs">{jsonError}</div>
                                    )}
                                    <Textarea
                                        rows={12}
                                        value={jsonDraft}
                                        onChange={(event) => setJsonDraft(event.target.value)}
                                        disabled={!jsonPowerMode}
                                    />
                                    {jsonPowerMode && selectedStep && (
                                        <Button
                                            onClick={() => {
                                                try {
                                                    const parsed = JSON.parse(jsonDraft);
                                                    const nextId = parsed.id || selectedStep.id;
                                                    updateStep(selectedStep.id, {
                                                        id: nextId,
                                                        name: parsed.name || selectedStep.name,
                                                        type: parsed.type || selectedStep.type,
                                                        inputMappingText: JSON.stringify(
                                                            parsed.inputMapping || {},
                                                            null,
                                                            2
                                                        ),
                                                        configText: JSON.stringify(
                                                            parsed.config || {},
                                                            null,
                                                            2
                                                        )
                                                    });
                                                    if (nextId !== selectedStep.id) {
                                                        setSelection({ kind: "step", id: nextId });
                                                    }
                                                    setJsonError(null);
                                                } catch {
                                                    setJsonError("Invalid JSON");
                                                }
                                            }}
                                        >
                                            Apply JSON
                                        </Button>
                                    )}
                                </TabsContent>

                                <TabsContent value="chat" className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Ask the builder</Label>
                                        <Textarea
                                            rows={3}
                                            value={chatInput}
                                            onChange={(event) => setChatInput(event.target.value)}
                                            placeholder="Example: Add a retry to step-3 and mark it as human approval."
                                        />
                                        <Button
                                            onClick={handleChatSubmit}
                                            disabled={chatLoading || !chatInput.trim()}
                                        >
                                            {chatLoading ? "Thinking..." : "Propose change"}
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {chatProposals.length === 0 ? (
                                            <div className="text-muted-foreground text-sm">
                                                Proposals will appear here after you ask for
                                                changes.
                                            </div>
                                        ) : (
                                            chatProposals.map((proposal) => {
                                                const confirmed =
                                                    confirmedProposals[proposal.id] || false;
                                                return (
                                                    <div
                                                        key={proposal.id}
                                                        className="rounded border p-3"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <div className="text-sm font-semibold">
                                                                    {proposal.summary}
                                                                </div>
                                                                <div className="text-muted-foreground text-xs">
                                                                    {new Date(
                                                                        proposal.createdAt
                                                                    ).toLocaleString()}
                                                                </div>
                                                            </div>
                                                            {proposal.applied ? (
                                                                <Badge variant="outline">
                                                                    Applied
                                                                </Badge>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    disabled={
                                                                        proposal.requiresConfirmation &&
                                                                        !confirmed
                                                                    }
                                                                    onClick={() =>
                                                                        applyProposal(proposal)
                                                                    }
                                                                >
                                                                    Apply
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {proposal.requiresConfirmation && (
                                                            <div className="mt-2 flex items-center justify-between rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                                                                <span>
                                                                    This change touches protected
                                                                    fields.
                                                                </span>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        setConfirmedProposals(
                                                                            (prev) => ({
                                                                                ...prev,
                                                                                [proposal.id]: true
                                                                            })
                                                                        )
                                                                    }
                                                                >
                                                                    Confirm
                                                                </Button>
                                                            </div>
                                                        )}

                                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                            <div>
                                                                <div className="text-muted-foreground mb-1 text-xs">
                                                                    Before
                                                                </div>
                                                                <pre className="bg-muted/40 max-h-40 overflow-auto rounded p-2 text-[10px]">
                                                                    {proposal.beforeJson}
                                                                </pre>
                                                            </div>
                                                            <div>
                                                                <div className="text-muted-foreground mb-1 text-xs">
                                                                    After
                                                                </div>
                                                                <pre className="bg-muted/40 max-h-40 overflow-auto rounded p-2 text-[10px]">
                                                                    {proposal.afterJson}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div className="space-y-2 border-t pt-3">
                                        <Label>Generate with AI</Label>
                                        <Textarea
                                            rows={3}
                                            value={aiPrompt}
                                            onChange={(event) => setAiPrompt(event.target.value)}
                                            placeholder="Describe the workflow you want..."
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={generateWithAi}
                                            disabled={aiGenerating || !aiPrompt.trim()}
                                        >
                                            {aiGenerating ? "Generating..." : "Generate workflow"}
                                        </Button>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                }
            />
        </div>
    );
}
