"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type DragEvent,
    type MouseEvent
} from "react";
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
    Textarea
} from "@repo/ui";
import {
    useNodesState,
    useEdgesState,
    addEdge,
    type Node,
    type Edge,
    type Connection,
    type Viewport,
    ReactFlowProvider,
    useReactFlow
} from "@xyflow/react";
import { getApiBase } from "@/lib/utils";
import { BuilderShell } from "@/components/builder/BuilderShell";
import { BuilderToolbar } from "@/components/builder/BuilderToolbar";
import { BuilderCanvas } from "@/components/builder/BuilderCanvas";
import { NodePalette, WORKFLOW_PALETTE_ITEMS } from "@/components/builder/NodePalette";
import { InspectorPanel } from "@/components/builder/InspectorPanel";
import { UnsavedChangesGuard } from "@/components/builder/UnsavedChangesGuard";
import { builderNodeTypes } from "@/components/builder/nodes";
import { getStepInspector } from "@/components/builder/inspectors";
import { EdgeInspector } from "@/components/builder/inspectors/EdgeInspector";
import { workflowEdgeTypes } from "@/components/workflows/WorkflowEdge";
import { useAutoLayout } from "@/components/builder/hooks/useAutoLayout";
import { useUndoRedo } from "@/components/builder/hooks/useUndoRedo";
import { useAutoSave } from "@/components/builder/hooks/useAutoSave";
import { useKeyboardShortcuts } from "@/components/builder/hooks/useKeyboardShortcuts";
import { CanvasContextMenu } from "@/components/builder/CanvasContextMenu";
import {
    applyJsonPatch,
    patchTouchesProtectedPaths,
    type JsonPatchOperation
} from "@/lib/json-patch";

type StepType =
    | "agent"
    | "tool"
    | "workflow"
    | "branch"
    | "parallel"
    | "foreach"
    | "dowhile"
    | "human"
    | "transform"
    | "delay";

interface WorkflowStepDefinition {
    id: string;
    type: StepType;
    name?: string;
    inputMapping?: Record<string, unknown>;
    config?: Record<string, unknown>;
}

interface WorkflowLayout {
    nodes: Array<{ id: string; position: { x: number; y: number }; type?: string }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
        type?: string;
        data?: Record<string, unknown>;
    }>;
    viewport?: { x: number; y: number; zoom: number };
}

interface WorkflowDefinition {
    steps: WorkflowStepDefinition[];
    layout?: WorkflowLayout;
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

function stepsFromNodes(nodes: Node[]): WorkflowStepDefinition[] {
    return nodes
        .filter((n) => n.type !== "trigger")
        .map((node) => ({
            id: node.id,
            type: (node.type || "agent") as StepType,
            name: (node.data?.label as string) || node.id,
            inputMapping: (node.data?.inputMapping as Record<string, unknown>) || {},
            config: (node.data?.config as Record<string, unknown>) || {}
        }));
}

function nodesFromSteps(steps: WorkflowStepDefinition[], layout?: WorkflowLayout): Node[] {
    const positionMap = new Map<string, { x: number; y: number }>();
    if (layout?.nodes) {
        layout.nodes.forEach((n) => positionMap.set(n.id, n.position));
    }

    return steps.map((step, index) => ({
        id: step.id,
        type: step.type,
        position: positionMap.get(step.id) || { x: 250, y: index * 140 },
        data: {
            label: step.name || step.id,
            description: step.type,
            stepType: step.type,
            config: step.config || {},
            inputMapping: step.inputMapping || {},
            status: "pending"
        }
    }));
}

function edgesFromLayout(layout?: WorkflowLayout, steps?: WorkflowStepDefinition[]): Edge[] {
    if (layout?.edges && layout.edges.length > 0) {
        return layout.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: e.type || "temporary",
            data: e.data || {}
        }));
    }
    if (!steps || steps.length <= 1) return [];
    return steps.slice(1).map((step, index) => ({
        id: `edge-${steps[index].id}-${step.id}`,
        source: steps[index].id,
        target: step.id,
        type: "temporary",
        data: {}
    }));
}

function WorkflowDesignPageInner() {
    const params = useParams();
    const workflowSlug = params.workflowSlug as string;
    const reactFlowInstance = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [inspectorTab, setInspectorTab] = useState("form");
    const [savedViewport, setSavedViewport] = useState<Viewport | undefined>(undefined);
    const [version, setVersion] = useState(0);
    const [paletteOpen, setPaletteOpen] = useState(true);

    // Chat state
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatProposals, setChatProposals] = useState<ChatProposal[]>([]);
    const [contextMenu, setContextMenu] = useState<{
        position: { x: number; y: number };
        nodeId?: string;
        edgeId?: string;
    } | null>(null);

    const { applyLayout } = useAutoLayout();
    const undoRedo = useUndoRedo(nodes, edges);

    const isDirty = useRef(false);
    const lastSavedHash = useRef("");
    const currentHash = useMemo(() => JSON.stringify({ nodes, edges }), [nodes, edges]);

    useEffect(() => {
        isDirty.current = currentHash !== lastSavedHash.current;
    }, [currentHash]);

    const saveFn = useCallback(async () => {
        const steps = stepsFromNodes(nodes);
        const layout: WorkflowLayout = {
            nodes: nodes.map((n) => ({ id: n.id, position: n.position, type: n.type })),
            edges: edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: e.type,
                data: e.data as Record<string, unknown>
            })),
            viewport: reactFlowInstance.getViewport()
        };

        const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                definitionJson: { steps, layout },
                expectedVersion: version
            })
        });
        const data = await res.json();

        if (res.status === 409) {
            return { success: false, status: 409, currentVersion: data.currentVersion };
        }
        if (!res.ok) {
            setError(data.error || "Save failed");
            return { success: false, status: res.status };
        }

        setVersion(data.workflow?.version ?? version);
        lastSavedHash.current = JSON.stringify({ nodes, edges });
        isDirty.current = false;
        setError(null);
        return { success: true };
    }, [nodes, edges, workflowSlug, version, reactFlowInstance]);

    const { saveStatus, saveNow } = useAutoSave(saveFn, isDirty.current, { enabled: true });

    useEffect(() => {
        const fetchWorkflow = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}`);
                const data = await res.json();
                const definition: WorkflowDefinition = data.workflow?.definitionJson || {
                    steps: []
                };
                setVersion(data.workflow?.version ?? 0);

                let initialNodes = nodesFromSteps(definition.steps, definition.layout);
                const initialEdges = edgesFromLayout(definition.layout, definition.steps);

                if (!definition.layout) {
                    initialNodes = applyLayout(initialNodes, initialEdges);
                }

                if (definition.layout?.viewport) {
                    setSavedViewport(definition.layout.viewport);
                }

                setNodes(initialNodes);
                setEdges(initialEdges);
                undoRedo.resetState(initialNodes, initialEdges);
                lastSavedHash.current = JSON.stringify({
                    nodes: initialNodes,
                    edges: initialEdges
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load workflow");
            } finally {
                setLoading(false);
            }
        };
        fetchWorkflow();
    }, [workflowSlug]); // eslint-disable-line react-hooks/exhaustive-deps

    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((eds) => addEdge({ ...connection, type: "temporary", data: {} }, eds));
            undoRedo.pushState(nodes, edges, "Connect nodes");
        },
        [nodes, edges, setEdges, undoRedo]
    );

    const onNodeDragStop = useCallback(
        (_event: MouseEvent, node: Node) => {
            setNodes((nds) =>
                nds.map((n) =>
                    n.id === node.id ? { ...n, data: { ...n.data, manuallyPositioned: true } } : n
                )
            );
            undoRedo.pushState(nodes, edges, `Move ${node.data?.label || node.id}`);
        },
        [nodes, edges, setNodes, undoRedo]
    );

    const handleDrop = useCallback(
        (event: DragEvent) => {
            event.preventDefault();
            const raw = event.dataTransfer.getData("application/json");
            if (!raw) return;

            try {
                const { type, label, defaultConfig } = JSON.parse(raw);
                const position = reactFlowInstance.screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY
                });

                const id = `${type}-${Date.now()}`;
                const newNode: Node = {
                    id,
                    type,
                    position,
                    data: {
                        label: label || type,
                        description: type,
                        stepType: type,
                        config: defaultConfig || {},
                        inputMapping: {},
                        status: "pending"
                    }
                };

                setNodes((nds) => [...nds, newNode]);
                setSelectedNodeId(id);
                setSelectedEdgeId(null);
                setInspectorTab("form");
                undoRedo.pushState([...nodes, newNode], edges, `Add ${label}`);
            } catch {
                /* ignore invalid data */
            }
        },
        [nodes, edges, setNodes, reactFlowInstance, undoRedo]
    );

    const handleNodeClick = useCallback((_event: MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
        setInspectorTab("form");
    }, []);

    const handleEdgeClick = useCallback((_event: MouseEvent, edge: Edge) => {
        setSelectedEdgeId(edge.id);
        setSelectedNodeId(null);
        setInspectorTab("form");
    }, []);

    const handlePaneClick = useCallback(() => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setContextMenu(null);
    }, []);

    const handleNodeContextMenu = useCallback((event: MouseEvent, node: Node) => {
        event.preventDefault();
        setContextMenu({ position: { x: event.clientX, y: event.clientY }, nodeId: node.id });
    }, []);

    const handleEdgeContextMenu = useCallback((event: MouseEvent, edge: Edge) => {
        event.preventDefault();
        setContextMenu({ position: { x: event.clientX, y: event.clientY }, edgeId: edge.id });
    }, []);

    const handlePaneContextMenu = useCallback((event: MouseEvent) => {
        event.preventDefault();
        setContextMenu({ position: { x: event.clientX, y: event.clientY } });
    }, []);

    const handleDeleteNode = useCallback(
        (nodeId: string) => {
            setNodes((nds) => nds.filter((n) => n.id !== nodeId));
            setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
            setSelectedNodeId(null);
            undoRedo.pushState(
                nodes.filter((n) => n.id !== nodeId),
                edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
                "Delete node"
            );
        },
        [nodes, edges, setNodes, setEdges, undoRedo]
    );

    const handleDeleteEdge = useCallback(
        (edgeId: string) => {
            setEdges((eds) => eds.filter((e) => e.id !== edgeId));
            setSelectedEdgeId(null);
            undoRedo.pushState(
                nodes,
                edges.filter((e) => e.id !== edgeId),
                "Delete edge"
            );
        },
        [nodes, edges, setEdges, undoRedo]
    );

    const handleAutoLayout = useCallback(() => {
        const layouted = applyLayout(nodes, edges);
        setNodes(layouted);
        undoRedo.pushState(layouted, edges, "Auto-layout");
    }, [nodes, edges, setNodes, applyLayout, undoRedo]);

    const handleFitView = useCallback(() => {
        reactFlowInstance.fitView({ padding: 0.15 });
    }, [reactFlowInstance]);

    const handleUndo = useCallback(() => {
        undoRedo.undo();
        setNodes(undoRedo.currentSnapshot.nodes);
        setEdges(undoRedo.currentSnapshot.edges);
    }, [undoRedo, setNodes, setEdges]);

    const handleRedo = useCallback(() => {
        undoRedo.redo();
        setNodes(undoRedo.currentSnapshot.nodes);
        setEdges(undoRedo.currentSnapshot.edges);
    }, [undoRedo, setNodes, setEdges]);

    const isValidConnection = useCallback(
        (connection: Connection) => {
            if (connection.source === connection.target) return false;
            const hasDuplicate = edges.some(
                (e) => e.source === connection.source && e.target === connection.target
            );
            return !hasDuplicate;
        },
        [edges]
    );

    const updateNodeConfig = useCallback(
        (nodeId: string, config: Record<string, unknown>) => {
            setNodes((nds) =>
                nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config } } : n))
            );
        },
        [setNodes]
    );

    const updateNodeData = useCallback(
        (nodeId: string, updates: Record<string, unknown>) => {
            setNodes((nds) =>
                nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n))
            );
        },
        [setNodes]
    );

    const updateEdge = useCallback(
        (edgeId: string, updates: Partial<Edge>) => {
            setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, ...updates } : e)));
        },
        [setEdges]
    );

    // Chat handler
    const handleChatSubmit = useCallback(async () => {
        if (!chatInput.trim()) return;
        try {
            setChatLoading(true);
            const steps = stepsFromNodes(nodes);
            const definition = { steps };
            const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}/designer-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: chatInput, definitionJson: definition })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");

            const nextDefinition = applyJsonPatch(definition, data.patch || []);
            const proposal: ChatProposal = {
                id: crypto.randomUUID(),
                summary: data.summary || "Proposed change",
                patch: data.patch || [],
                beforeJson: JSON.stringify(definition, null, 2),
                afterJson: JSON.stringify(nextDefinition, null, 2),
                createdAt: new Date().toISOString(),
                requiresConfirmation: patchTouchesProtectedPaths(data.patch || [], ["/steps/"])
            };
            setChatProposals((prev) => [proposal, ...prev]);
            setChatInput("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Chat failed");
        } finally {
            setChatLoading(false);
        }
    }, [chatInput, nodes, workflowSlug]);

    const applyProposal = useCallback(
        (proposal: ChatProposal) => {
            try {
                const steps = stepsFromNodes(nodes);
                const definition = { steps };
                const nextDefinition = applyJsonPatch(
                    definition,
                    proposal.patch
                ) as WorkflowDefinition;
                const nextNodes = nodesFromSteps(nextDefinition.steps);
                const layouted = applyLayout(nextNodes, edges);
                setNodes(layouted);
                undoRedo.pushState(layouted, edges, `AI: ${proposal.summary}`);
                setChatProposals((prev) =>
                    prev.map((p) => (p.id === proposal.id ? { ...p, applied: true } : p))
                );
            } catch (err) {
                setError(err instanceof Error ? err.message : "Apply failed");
            }
        },
        [nodes, edges, setNodes, applyLayout, undoRedo]
    );

    // Keyboard shortcuts
    const shortcuts = useMemo(
        () => [
            { key: "z", meta: true, handler: handleUndo },
            { key: "z", meta: true, shift: true, handler: handleRedo },
            { key: "s", meta: true, handler: () => saveNow(), guard: "always" as const },
            { key: "0", meta: true, handler: handleFitView }
        ],
        [handleUndo, handleRedo, saveNow, handleFitView]
    );
    useKeyboardShortcuts(shortcuts);

    const selectedNode = useMemo(
        () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null),
        [selectedNodeId, nodes]
    );
    const selectedEdge = useMemo(
        () => (selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : null),
        [selectedEdgeId, edges]
    );

    // Inspector form for selected node
    const inspectorFormContent = useMemo(() => {
        if (selectedEdge) {
            return (
                <EdgeInspector
                    edge={selectedEdge}
                    onUpdate={(updates) => updateEdge(selectedEdge.id, updates)}
                    onDelete={() => handleDeleteEdge(selectedEdge.id)}
                />
            );
        }
        if (!selectedNode) {
            return (
                <div className="text-muted-foreground text-sm">
                    Select a node or edge to configure.
                </div>
            );
        }

        const stepType = (selectedNode.data?.stepType as string) || selectedNode.type || "agent";
        const config = (selectedNode.data?.config as Record<string, unknown>) || {};

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                        value={(selectedNode.data?.label as string) || ""}
                        onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                        value={stepType}
                        onValueChange={(v) => {
                            if (!v) return;
                            setNodes((nds) =>
                                nds.map((n) =>
                                    n.id === selectedNode.id
                                        ? {
                                              ...n,
                                              type: v as string,
                                              data: { ...n.data, stepType: v, description: v }
                                          }
                                        : n
                                )
                            );
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
                                "dowhile",
                                "human",
                                "transform",
                                "delay"
                            ].map((t) => (
                                <SelectItem key={t} value={t}>
                                    {t}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1 text-xs">
                    <div className="text-muted-foreground">Step ID</div>
                    <code>{selectedNode.id}</code>
                </div>
                <div className="border-t pt-4">
                    {getStepInspector({
                        stepType,
                        config,
                        onChange: (newConfig) => updateNodeConfig(selectedNode.id, newConfig)
                    })}
                </div>
            </div>
        );
    }, [
        selectedNode,
        selectedEdge,
        updateNodeData,
        updateNodeConfig,
        updateEdge,
        handleDeleteEdge,
        setNodes
    ]);

    // JSON tab
    const jsonTabContent = useMemo(() => {
        const entity = selectedNode || selectedEdge;
        if (!entity)
            return (
                <div className="text-muted-foreground text-sm">Select an element to see JSON.</div>
            );
        return (
            <Textarea
                rows={15}
                value={JSON.stringify(entity, null, 2)}
                readOnly
                className="font-mono text-xs"
            />
        );
    }, [selectedNode, selectedEdge]);

    // Chat tab
    const chatTabContent = useMemo(
        () => (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Ask the builder</Label>
                    <Textarea
                        rows={3}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Describe changes to the workflow..."
                    />
                    <Button
                        onClick={handleChatSubmit}
                        disabled={chatLoading || !chatInput.trim()}
                        size="sm"
                    >
                        {chatLoading ? "Thinking..." : "Propose change"}
                    </Button>
                </div>
                {chatProposals.map((proposal) => (
                    <div key={proposal.id} className="space-y-2 rounded border p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold">{proposal.summary}</div>
                            {proposal.applied ? (
                                <Badge variant="outline">Applied</Badge>
                            ) : (
                                <Button size="sm" onClick={() => applyProposal(proposal)}>
                                    Apply
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        ),
        [chatInput, chatLoading, chatProposals, handleChatSubmit, applyProposal]
    );

    // Mappings tab
    const mappingsTabContent = useMemo(() => {
        if (!selectedNode) return null;
        const mapping = (selectedNode.data?.inputMapping as Record<string, unknown>) || {};
        return (
            <div className="space-y-2">
                <Label>Input Mapping (JSON)</Label>
                <Textarea
                    rows={10}
                    value={JSON.stringify(mapping, null, 2)}
                    onChange={(e) => {
                        try {
                            updateNodeData(selectedNode.id, {
                                inputMapping: JSON.parse(e.target.value)
                            });
                        } catch {
                            /* keep draft */
                        }
                    }}
                />
            </div>
        );
    }, [selectedNode, updateNodeData]);

    if (loading) {
        return (
            <div className="flex h-[calc(100dvh-64px)] items-center justify-center">
                <div className="text-muted-foreground animate-pulse text-sm">
                    Loading workflow...
                </div>
            </div>
        );
    }

    return (
        <>
            <UnsavedChangesGuard isDirty={isDirty.current} />
            {contextMenu && (
                <CanvasContextMenu
                    position={contextMenu.position}
                    onClose={() => setContextMenu(null)}
                    items={
                        contextMenu.nodeId
                            ? [
                                  {
                                      label: "Edit",
                                      onClick: () => {
                                          setSelectedNodeId(contextMenu.nodeId!);
                                          setInspectorTab("form");
                                      }
                                  },
                                  {
                                      label: "Duplicate",
                                      shortcut: "\u2318D",
                                      onClick: () => {
                                          const node = nodes.find(
                                              (n) => n.id === contextMenu.nodeId
                                          );
                                          if (!node) return;
                                          const id = `${node.type}-${Date.now()}`;
                                          const newNode: Node = {
                                              ...node,
                                              id,
                                              position: {
                                                  x: node.position.x + 30,
                                                  y: node.position.y + 30
                                              }
                                          };
                                          setNodes((nds) => [...nds, newNode]);
                                          undoRedo.pushState(
                                              [...nodes, newNode],
                                              edges,
                                              "Duplicate node"
                                          );
                                      }
                                  },
                                  { label: "", onClick: () => {}, separator: true },
                                  {
                                      label: "Delete",
                                      shortcut: "\u232B",
                                      destructive: true,
                                      onClick: () => handleDeleteNode(contextMenu.nodeId!)
                                  }
                              ]
                            : contextMenu.edgeId
                              ? [
                                    {
                                        label: "Edit",
                                        onClick: () => {
                                            setSelectedEdgeId(contextMenu.edgeId!);
                                            setInspectorTab("form");
                                        }
                                    },
                                    { label: "", onClick: () => {}, separator: true },
                                    {
                                        label: "Delete Edge",
                                        destructive: true,
                                        onClick: () => handleDeleteEdge(contextMenu.edgeId!)
                                    }
                                ]
                              : [
                                    {
                                        label: "Auto-layout",
                                        shortcut: "\u2318\u21E7L",
                                        onClick: handleAutoLayout
                                    },
                                    {
                                        label: "Fit to View",
                                        shortcut: "\u23180",
                                        onClick: handleFitView
                                    },
                                    { label: "", onClick: () => {}, separator: true },
                                    {
                                        label: "Select All",
                                        shortcut: "\u2318A",
                                        onClick: () => {
                                            setNodes((nds) =>
                                                nds.map((n) => ({ ...n, selected: true }))
                                            );
                                        }
                                    }
                                ]
                    }
                />
            )}
            <BuilderShell
                toolbar={
                    <BuilderToolbar
                        title="Workflow Designer"
                        subtitle={workflowSlug}
                        saveStatus={saveStatus}
                        onSave={saveNow}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={undoRedo.canUndo}
                        canRedo={undoRedo.canRedo}
                        onAutoLayout={handleAutoLayout}
                        onFitView={handleFitView}
                        onTogglePalette={() => setPaletteOpen((p) => !p)}
                        paletteOpen={paletteOpen}
                        actions={
                            <Button
                                variant="default"
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={async () => {
                                    try {
                                        await saveNow();
                                        const res = await fetch(
                                            `${getApiBase()}/api/workflows/${workflowSlug}/execute`,
                                            {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({})
                                            }
                                        );
                                        if (!res.ok) throw new Error("Execution failed");
                                    } catch (err) {
                                        setError(err instanceof Error ? err.message : "Run failed");
                                    }
                                }}
                            >
                                Run
                            </Button>
                        }
                    />
                }
                palette={<NodePalette items={WORKFLOW_PALETTE_ITEMS} />}
                defaultPaletteOpen={paletteOpen}
                canvas={
                    <BuilderCanvas
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeDragStop={onNodeDragStop}
                        onDrop={handleDrop}
                        onNodeClick={handleNodeClick}
                        onEdgeClick={handleEdgeClick}
                        onPaneClick={handlePaneClick}
                        onNodeContextMenu={handleNodeContextMenu}
                        onEdgeContextMenu={handleEdgeContextMenu}
                        onPaneContextMenu={handlePaneContextMenu}
                        isValidConnection={isValidConnection}
                        nodeTypes={builderNodeTypes}
                        edgeTypes={workflowEdgeTypes}
                        defaultViewport={savedViewport}
                    />
                }
                inspector={
                    <InspectorPanel
                        title={
                            selectedNode
                                ? (selectedNode.data?.label as string) || selectedNode.id
                                : selectedEdge
                                  ? `${selectedEdge.source} → ${selectedEdge.target}`
                                  : "No selection"
                        }
                        subtitle={
                            selectedNode
                                ? `${selectedNode.type} step`
                                : selectedEdge
                                  ? "Connection"
                                  : undefined
                        }
                        onDelete={
                            selectedNode
                                ? () => handleDeleteNode(selectedNode.id)
                                : selectedEdge
                                  ? () => handleDeleteEdge(selectedEdge.id)
                                  : undefined
                        }
                        activeTab={inspectorTab}
                        onTabChange={setInspectorTab}
                        formTab={inspectorFormContent}
                        mappingsTab={mappingsTabContent}
                        jsonTab={jsonTabContent}
                        chatTab={chatTabContent}
                        footer={
                            error ? (
                                <div className="text-destructive text-xs">{error}</div>
                            ) : undefined
                        }
                    />
                }
            />
        </>
    );
}

export default function WorkflowDesignPage() {
    return (
        <ReactFlowProvider>
            <WorkflowDesignPageInner />
        </ReactFlowProvider>
    );
}
