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
import { Badge, Button, Label, Textarea } from "@repo/ui";
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
import { NodePalette, type PaletteItem } from "@/components/builder/NodePalette";
import { InspectorPanel } from "@/components/builder/InspectorPanel";
import { UnsavedChangesGuard } from "@/components/builder/UnsavedChangesGuard";
import { builderNodeTypes } from "@/components/builder/nodes";
import { EdgeInspector } from "@/components/builder/inspectors/EdgeInspector";
import { RouterInspector } from "@/components/builder/inspectors/RouterInspector";
import { PrimitiveInspector } from "@/components/builder/inspectors/PrimitiveInspector";
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

interface NetworkTopology {
    nodes: Node[];
    edges: Edge[];
    viewport?: { x: number; y: number; zoom: number };
}

interface NetworkPrimitive {
    primitiveType?: string;
    agentId?: string | null;
    workflowId?: string | null;
    toolId?: string | null;
    description?: string;
    agent?: { id: string; name: string; slug?: string | null } | null;
    workflow?: { id: string; name: string; slug?: string | null } | null;
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

function normalizeTopology(input?: NetworkTopology | null): NetworkTopology {
    return {
        nodes: Array.isArray(input?.nodes) ? input.nodes : [],
        edges: Array.isArray(input?.edges) ? input.edges : [],
        viewport: input?.viewport
    };
}

function NetworkTopologyPageInner() {
    const params = useParams();
    const networkSlug = params.networkSlug as string;
    const reactFlowInstance = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [primitives, setPrimitives] = useState<NetworkPrimitive[]>([]);
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
        const topologyJson: NetworkTopology = {
            nodes: nodes.map((n) => ({
                ...n,
                measured: undefined
            })),
            edges: edges.map((e) => ({
                ...e
            })),
            viewport: reactFlowInstance.getViewport()
        };

        const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                topologyJson,
                primitives,
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

        setVersion(data.network?.version ?? version);
        lastSavedHash.current = JSON.stringify({ nodes, edges });
        isDirty.current = false;
        setError(null);
        return { success: true };
    }, [nodes, edges, primitives, networkSlug, version, reactFlowInstance]);

    const { saveStatus, saveNow } = useAutoSave(saveFn, isDirty.current, { enabled: true });

    // Build palette items from available primitives
    const networkPaletteItems: PaletteItem[] = useMemo(() => {
        const items: PaletteItem[] = [];

        primitives.forEach((p) => {
            const name = p.agent?.name || p.workflow?.name || p.toolId || "Unknown";
            const type = p.primitiveType || "agent";
            items.push({
                type,
                label: name,
                description: p.description || type,
                category: "Primitives",
                icon: (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                    </svg>
                ),
                defaultConfig: {
                    primitiveType: type,
                    agentSlug: p.agent?.slug || "",
                    workflowSlug: p.workflow?.slug || "",
                    toolId: p.toolId || "",
                    description: p.description || ""
                }
            });
        });

        return items;
    }, [primitives]);

    useEffect(() => {
        const fetchNetwork = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}`);
                const data = await res.json();
                const network = data.network || {};
                const topology = normalizeTopology(network.topologyJson);
                setVersion(network.version ?? 0);
                setPrimitives(Array.isArray(network.primitives) ? network.primitives : []);

                let initialNodes: Node[] = topology.nodes.map((node: Node, index: number) => ({
                    ...node,
                    type: node.type || "agent",
                    position: node.position || { x: 250, y: index * 140 },
                    data: {
                        ...node.data,
                        label: String(node.data?.label || node.id),
                        description: String(node.data?.description || node.type || "node"),
                        stepType: node.type || "agent",
                        config: (node.data as Record<string, unknown>)?.config || {},
                        status: "pending"
                    }
                }));
                const initialEdges = topology.edges.map((edge: Edge) => ({
                    ...edge,
                    id: edge.id || `edge-${edge.source}-${edge.target}`,
                    type: edge.type || "temporary",
                    data: { ...edge.data }
                }));

                if (!topology.viewport && initialNodes.length > 0) {
                    initialNodes = applyLayout(initialNodes, initialEdges);
                }

                if (topology.viewport) {
                    setSavedViewport(topology.viewport as Viewport);
                }

                setNodes(initialNodes);
                setEdges(initialEdges);
                undoRedo.resetState(initialNodes, initialEdges);
                lastSavedHash.current = JSON.stringify({
                    nodes: initialNodes,
                    edges: initialEdges
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load network");
            } finally {
                setLoading(false);
            }
        };
        fetchNetwork();
    }, [networkSlug]); // eslint-disable-line react-hooks/exhaustive-deps

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
                    type:
                        type === "agent" || type === "workflow" || type === "tool" ? type : "agent",
                    position,
                    data: {
                        label: label || type,
                        description: type,
                        stepType: type,
                        config: defaultConfig || {},
                        status: "pending"
                    }
                };

                // Auto-connect to router if present
                const routerNode = nodes.find((n) => n.type === "router");
                const newEdges = routerNode
                    ? [
                          ...edges,
                          {
                              id: `edge-${routerNode.id}-${id}`,
                              source: routerNode.id,
                              target: id,
                              type: "temporary" as const,
                              data: {}
                          }
                      ]
                    : edges;

                setNodes((nds) => [...nds, newNode]);
                if (routerNode) setEdges(newEdges);
                setSelectedNodeId(id);
                setSelectedEdgeId(null);
                setInspectorTab("form");
                undoRedo.pushState([...nodes, newNode], newEdges, `Add ${label}`);
            } catch {
                /* ignore */
            }
        },
        [nodes, edges, setNodes, setEdges, reactFlowInstance, undoRedo]
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
            return !edges.some(
                (e) => e.source === connection.source && e.target === connection.target
            );
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

    // Chat
    const handleChatSubmit = useCallback(async () => {
        if (!chatInput.trim()) return;
        try {
            setChatLoading(true);
            const topologyJson = { nodes, edges };
            const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}/designer-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: chatInput, topologyJson, primitives })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed");

            const nextNetwork = applyJsonPatch({ topologyJson, primitives }, data.patch || []);
            const proposal: ChatProposal = {
                id: crypto.randomUUID(),
                summary: data.summary || "Proposed change",
                patch: data.patch || [],
                beforeJson: JSON.stringify({ topologyJson, primitives }, null, 2),
                afterJson: JSON.stringify(nextNetwork, null, 2),
                createdAt: new Date().toISOString(),
                requiresConfirmation: patchTouchesProtectedPaths(data.patch || [], [
                    "/topologyJson"
                ])
            };
            setChatProposals((prev) => [proposal, ...prev]);
            setChatInput("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Chat failed");
        } finally {
            setChatLoading(false);
        }
    }, [chatInput, nodes, edges, primitives, networkSlug]);

    const applyProposal = useCallback(
        (proposal: ChatProposal) => {
            try {
                const topologyJson = { nodes, edges };
                const nextNetwork = applyJsonPatch(
                    { topologyJson, primitives },
                    proposal.patch
                ) as { topologyJson: NetworkTopology; primitives: NetworkPrimitive[] };
                const norm = normalizeTopology(nextNetwork.topologyJson);
                setNodes(norm.nodes);
                setEdges(norm.edges);
                setPrimitives(nextNetwork.primitives || primitives);
                undoRedo.pushState(norm.nodes, norm.edges, `AI: ${proposal.summary}`);
                setChatProposals((prev) =>
                    prev.map((p) => (p.id === proposal.id ? { ...p, applied: true } : p))
                );
            } catch (err) {
                setError(err instanceof Error ? err.message : "Apply failed");
            }
        },
        [nodes, edges, primitives, setNodes, setEdges, undoRedo]
    );

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

        const nodeType = selectedNode.type;
        const config = (selectedNode.data?.config as Record<string, unknown>) || {};

        if (nodeType === "router") {
            return (
                <RouterInspector
                    config={config}
                    onChange={(newConfig) => updateNodeConfig(selectedNode.id, newConfig)}
                />
            );
        }

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Label</Label>
                    <input
                        className="border-input bg-background ring-offset-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                        value={(selectedNode.data?.label as string) || ""}
                        onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    />
                </div>
                <PrimitiveInspector
                    config={config}
                    onChange={(newConfig) => updateNodeConfig(selectedNode.id, newConfig)}
                />
            </div>
        );
    }, [
        selectedNode,
        selectedEdge,
        updateNodeData,
        updateNodeConfig,
        updateEdge,
        handleDeleteEdge
    ]);

    const jsonTabContent = useMemo(() => {
        const entity = selectedNode || selectedEdge;
        if (!entity) return <div className="text-muted-foreground text-sm">Select an element.</div>;
        return (
            <Textarea
                rows={15}
                value={JSON.stringify(entity, null, 2)}
                readOnly
                className="font-mono text-xs"
            />
        );
    }, [selectedNode, selectedEdge]);

    const chatTabContent = useMemo(
        () => (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Ask the builder</Label>
                    <Textarea
                        rows={3}
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Describe changes to the network..."
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

    if (loading) {
        return (
            <div className="flex h-[calc(100dvh-64px)] items-center justify-center">
                <div className="text-muted-foreground animate-pulse text-sm">
                    Loading network...
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
                                      disabled:
                                          nodes.find((n) => n.id === contextMenu.nodeId)?.type ===
                                          "router",
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
                                    }
                                ]
                    }
                />
            )}
            <BuilderShell
                toolbar={
                    <BuilderToolbar
                        title="Network Topology"
                        subtitle={networkSlug}
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
                    />
                }
                palette={<NodePalette items={networkPaletteItems} />}
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
                                ? selectedNode.type || "Node"
                                : selectedEdge
                                  ? "Connection"
                                  : undefined
                        }
                        onDelete={
                            selectedNode && selectedNode.type !== "router"
                                ? () => handleDeleteNode(selectedNode.id)
                                : selectedEdge
                                  ? () => handleDeleteEdge(selectedEdge.id)
                                  : undefined
                        }
                        activeTab={inspectorTab}
                        onTabChange={setInspectorTab}
                        formTab={inspectorFormContent}
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

export default function NetworkTopologyPage() {
    return (
        <ReactFlowProvider>
            <NetworkTopologyPageInner />
        </ReactFlowProvider>
    );
}
