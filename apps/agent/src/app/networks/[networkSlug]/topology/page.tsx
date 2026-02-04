"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
    Badge,
    Button,
    Input,
    Label,
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
import type { Edge, Node, NodeTypes } from "@xyflow/react";

interface NetworkTopology {
    nodes: Node[];
    edges: Edge[];
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

interface NetworkPrimitive {
    primitiveType?: string;
    agentId?: string | null;
    workflowId?: string | null;
    toolId?: string | null;
    agent?: { id: string; name: string; slug?: string | null } | null;
    workflow?: { id: string; name: string; slug?: string | null } | null;
}

const SECTION_LABELS = ["Triggers", "Routers", "Actions", "Subflows", "Errors/Handlers"] as const;

function normalizeTopology(input?: NetworkTopology | null): NetworkTopology {
    return {
        nodes: Array.isArray(input?.nodes) ? input?.nodes : [],
        edges: Array.isArray(input?.edges) ? input?.edges : []
    };
}

function categoryForNode(node: Node): (typeof SECTION_LABELS)[number] {
    const nodeType = `${node.data?.type || node.type || ""}`.toLowerCase();
    if (nodeType.includes("trigger")) return "Triggers";
    if (nodeType.includes("router")) return "Routers";
    if (nodeType.includes("subflow") || nodeType.includes("workflow")) return "Subflows";
    if (nodeType.includes("error") || nodeType.includes("handler")) return "Errors/Handlers";
    return "Actions";
}

function tryParseJson(value: string) {
    try {
        return { value: value ? JSON.parse(value) : {}, error: null };
    } catch {
        return { value: null, error: "Invalid JSON" };
    }
}

function resolvePrimitiveReference(primitive: NetworkPrimitive, index: number): string {
    if (primitive.primitiveType === "agent") {
        return primitive.agent?.slug || primitive.agentId || `agent-${index + 1}`;
    }
    if (primitive.primitiveType === "workflow") {
        return primitive.workflow?.slug || primitive.workflowId || `workflow-${index + 1}`;
    }
    if (primitive.primitiveType === "tool") {
        return primitive.toolId || `tool-${index + 1}`;
    }
    return (
        primitive.agent?.slug ||
        primitive.workflow?.slug ||
        primitive.toolId ||
        primitive.agentId ||
        primitive.workflowId ||
        `primitive-${index + 1}`
    );
}

export default function NetworkTopologyPage() {
    const params = useParams();
    const networkSlug = params.networkSlug as string;
    const [topology, setTopology] = useState<NetworkTopology>({ nodes: [], edges: [] });
    const [primitives, setPrimitives] = useState<NetworkPrimitive[]>([]);
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
    const [history, setHistory] = useState<
        { topology: NetworkTopology; primitives: NetworkPrimitive[] }[]
    >([]);
    const [mappingDraft, setMappingDraft] = useState("");
    const [configDraft, setConfigDraft] = useState("");

    const defaultSelection = useMemo(
        () => (topology.nodes.length > 0 ? { kind: "node", id: topology.nodes[0].id } : null),
        [topology.nodes]
    );
    const { selected, setSelection } = useBuilderSelection(defaultSelection);

    useEffect(() => {
        if (!selected && topology.nodes.length > 0) {
            setSelection({ kind: "node", id: topology.nodes[0].id });
        }
    }, [selected, topology.nodes, setSelection]);

    useEffect(() => {
        const fetchNetwork = async () => {
            const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}`);
            const data = await res.json();
            const network = data.network || {};
            setTopology(normalizeTopology(network.topologyJson));
            setPrimitives(Array.isArray(network.primitives) ? network.primitives : []);
        };
        fetchNetwork();
    }, [networkSlug]);

    useEffect(() => {
        const timeout = setTimeout(async () => {
            try {
                setValidationLoading(true);
                const res = await fetch(`${getApiBase()}/api/networks/validate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ topologyJson: topology, primitives })
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
    }, [topology, primitives]);

    const nodeTypes: NodeTypes = useMemo(
        () => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            workflow: WorkflowNode as any
        }),
        []
    );

    const flowNodes = useMemo(() => {
        return topology.nodes.map((node, index) => ({
            ...node,
            position: node.position || { x: 140, y: index * 140 },
            data: {
                ...node.data,
                label: String(node.data?.label || node.id),
                description: String(node.data?.description || node.type || "node"),
                status: validationErrors.length > 0 ? "error" : "pending",
                mapping: (node.data as Record<string, unknown>)?.mapping || {},
                config: (node.data as Record<string, unknown>)?.config || {}
            }
        }));
    }, [topology.nodes, validationErrors]);

    const flowEdges = useMemo(() => {
        return topology.edges.map((edge) => {
            const edgeId = edge.id || `edge-${edge.source}-${edge.target}`;
            return {
                ...edge,
                id: edgeId,
                type: edge.type || "temporary",
                data: {
                    ...edge.data,
                    label: edge.data?.label || ""
                }
            };
        });
    }, [topology.edges]);

    const selectedNode = useMemo(
        () =>
            selected?.kind === "node" ? flowNodes.find((node) => node.id === selected.id) : null,
        [selected, flowNodes]
    );

    const selectedEdge = useMemo(
        () =>
            selected?.kind === "link" ? flowEdges.find((edge) => edge.id === selected.id) : null,
        [selected, flowEdges]
    );

    useEffect(() => {
        if (selectedNode) {
            setMappingDraft(JSON.stringify(selectedNode.data?.mapping || {}, null, 2));
            setConfigDraft(JSON.stringify(selectedNode.data?.config || {}, null, 2));
        } else {
            setMappingDraft("");
            setConfigDraft("");
        }
    }, [selectedNode]);

    const selectedEntityJson = useMemo(() => {
        if (selectedNode) return selectedNode;
        if (selectedEdge) return selectedEdge;
        return null;
    }, [selectedNode, selectedEdge]);

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

        const nodeItems = flowNodes.map((node) => ({
            id: node.id,
            kind: "node",
            label: node.data?.label || node.id,
            description: node.data?.description || node.type || "node",
            meta: node.id
        }));

        const edgeItems = flowEdges.map((edge) => ({
            id: edge.id,
            kind: "link",
            label: `${edge.source} → ${edge.target}`,
            description: "link",
            meta: edge.id
        }));

        const sections: OutlineSection[] = SECTION_LABELS.map((label) => ({
            id: label,
            label,
            items: [],
            emptyState: "No items"
        }));

        nodeItems.forEach((item) => {
            if (!filterItem(item.label, item.description)) return;
            const node = flowNodes.find((candidate) => candidate.id === item.id);
            const sectionLabel = node ? categoryForNode(node) : "Actions";
            const section = sections.find((entry) => entry.label === sectionLabel);
            section?.items.push(item);
        });

        edgeItems.forEach((item) => {
            if (!filterItem(item.label, item.description)) return;
            const section = sections.find((entry) => entry.label === "Routers");
            section?.items.push(item);
        });

        return sections;
    }, [outlineSearch, flowNodes, flowEdges]);

    const availableTokens = useMemo(() => {
        const tokens = primitives.map((primitive, index) => {
            const type = primitive.primitiveType || "primitive";
            const ref = resolvePrimitiveReference(primitive, index);
            return `{{${type}:${ref}}}`;
        });
        tokens.unshift("{{input}}");
        tokens.push("{{context}}");
        return tokens;
    }, [primitives]);

    const updateNodeData = (nodeId: string, updates: Record<string, unknown>) => {
        setTopology((prev) => ({
            ...prev,
            nodes: prev.nodes.map((node) =>
                node.id === nodeId
                    ? {
                          ...node,
                          data: {
                              ...node.data,
                              ...updates
                          }
                      }
                    : node
            )
        }));
    };

    const saveTopology = async () => {
        try {
            setSaving(true);
            setError(null);
            const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topologyJson: topology,
                    primitives
                })
            });
            if (!res.ok) {
                throw new Error("Failed to save topology");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save topology");
        } finally {
            setSaving(false);
        }
    };

    const generateTopology = async () => {
        if (!aiPrompt.trim()) return;
        try {
            setAiGenerating(true);
            const res = await fetch(`${getApiBase()}/api/networks/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: aiPrompt })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to generate network");
            }
            if (!data.validation?.valid) {
                throw new Error(data.validation?.errors?.join("; ") || "Validation failed");
            }
            setTopology(normalizeTopology(data.topologyJson));
            setPrimitives(Array.isArray(data.primitives) ? data.primitives : []);
        } finally {
            setAiGenerating(false);
        }
    };

    const handleChatSubmit = async () => {
        if (!chatInput.trim()) return;
        try {
            setChatLoading(true);
            const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}/designer-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: chatInput,
                    topologyJson: topology,
                    primitives,
                    selected
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to generate proposal");
            }
            const nextNetwork = applyJsonPatch(
                { topologyJson: topology, primitives },
                data.patch || []
            ) as { topologyJson: NetworkTopology; primitives: NetworkPrimitive[] };
            const proposalId =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random()}`;
            const proposal: ChatProposal = {
                id: proposalId,
                summary: data.summary || "Proposed change",
                patch: data.patch || [],
                beforeJson: JSON.stringify({ topologyJson: topology, primitives }, null, 2),
                afterJson: JSON.stringify(nextNetwork, null, 2),
                createdAt: new Date().toISOString(),
                requiresConfirmation: patchTouchesProtectedPaths(data.patch || [], [
                    "/topologyJson"
                ])
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
            const nextNetwork = applyJsonPatch(
                { topologyJson: topology, primitives },
                proposal.patch
            ) as { topologyJson: NetworkTopology; primitives: NetworkPrimitive[] };
            setHistory((prev) => [{ topology, primitives }, ...prev]);
            setTopology(normalizeTopology(nextNetwork.topologyJson));
            setPrimitives(Array.isArray(nextNetwork.primitives) ? nextNetwork.primitives : []);
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
            setTopology(normalizeTopology(latest.topology));
            setPrimitives(latest.primitives);
            return rest;
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Network Topology</h1>
                    <p className="text-muted-foreground text-sm">
                        Design and debug network routing using a unified builder.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={saveTopology} disabled={saving}>
                        {saving ? "Saving..." : "Save topology"}
                    </Button>
                </div>
            </div>

            <BuilderShell
                outline={
                    <OutlinePanel
                        title="Outline"
                        searchValue={outlineSearch}
                        onSearchChange={setOutlineSearch}
                        searchPlaceholder="Search nodes..."
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
                            history.length > 0 ? (
                                <Button variant="ghost" onClick={undoLastChange}>
                                    Undo last change
                                </Button>
                            ) : null
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
                        onNodeClick={(_, node) => setSelection({ kind: "node", id: node.id })}
                        onEdgeClick={(_, edge) => setSelection({ kind: "link", id: edge.id })}
                        selectedNodeIds={selected?.kind === "node" ? [selected.id] : []}
                        selectedEdgeIds={selected?.kind === "link" ? [selected.id] : []}
                    />
                }
                inspector={
                    <div className="flex h-full flex-col">
                        <div className="border-b p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-sm font-semibold">
                                        {selectedNode?.data?.label ||
                                            selectedEdge?.id ||
                                            "Select an item"}
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                        {selectedNode
                                            ? "Node"
                                            : selectedEdge
                                              ? "Link"
                                              : "No selection"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3">
                            {error && (
                                <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-500">
                                    {error}
                                </div>
                            )}

                            <Tabs
                                defaultValue="details"
                                value={inspectorTab}
                                onValueChange={setInspectorTab}
                            >
                                <TabsList className="mb-3 w-full">
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                    <TabsTrigger value="mappings">Mappings</TabsTrigger>
                                    <TabsTrigger value="config">Config</TabsTrigger>
                                    <TabsTrigger value="json">JSON</TabsTrigger>
                                    <TabsTrigger value="chat">Chat</TabsTrigger>
                                </TabsList>

                                <TabsContent value="details" className="space-y-4">
                                    {selectedNode ? (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Node label</Label>
                                                <Input
                                                    value={selectedNode.data?.label || ""}
                                                    onChange={(event) =>
                                                        updateNodeData(selectedNode.id, {
                                                            label: event.target.value
                                                        })
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1 text-xs">
                                                <div className="text-muted-foreground">Node ID</div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <code className="text-xs">
                                                        {selectedNode.id}
                                                    </code>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            navigator.clipboard.writeText(
                                                                selectedNode.id
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
                                                    Link ID
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
                                            Select a node or link to view details.
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="mappings" className="space-y-3">
                                    {selectedNode ? (
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
                                                    value={mappingDraft}
                                                    onChange={(event) => {
                                                        setMappingDraft(event.target.value);
                                                        const parsed = tryParseJson(
                                                            event.target.value
                                                        );
                                                        if (!parsed.error) {
                                                            updateNodeData(selectedNode.id, {
                                                                mapping: parsed.value
                                                            });
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground text-sm">
                                            Select a node to edit mappings.
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="config" className="space-y-3">
                                    {selectedNode ? (
                                        <Textarea
                                            rows={10}
                                            value={configDraft}
                                            onChange={(event) => {
                                                setConfigDraft(event.target.value);
                                                const parsed = tryParseJson(event.target.value);
                                                if (!parsed.error) {
                                                    updateNodeData(selectedNode.id, {
                                                        config: parsed.value
                                                    });
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="text-muted-foreground text-sm">
                                            Select a node to edit config.
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
                                    {jsonPowerMode && selectedNode && (
                                        <Button
                                            onClick={() => {
                                                try {
                                                    const parsed = JSON.parse(jsonDraft);
                                                    updateNodeData(
                                                        selectedNode.id,
                                                        parsed.data || {}
                                                    );
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
                                            placeholder="Example: Add a router node between intake and ops."
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
                                            placeholder="Describe the network you want..."
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={generateTopology}
                                            disabled={aiGenerating || !aiPrompt.trim()}
                                        >
                                            {aiGenerating ? "Generating..." : "Generate topology"}
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
