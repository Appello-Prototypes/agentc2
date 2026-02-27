"use client";

import { useCallback, useRef, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { JsonPatchOperation } from "@/lib/json-patch";
import { applyJsonPatch } from "@/lib/json-patch";

interface Snapshot {
    nodes: Node[];
    edges: Edge[];
    timestamp: number;
    description?: string;
}

interface UndoRedoState {
    past: Snapshot[];
    present: Snapshot;
    future: Snapshot[];
}

const MAX_HISTORY = 50;

function cloneSnapshot(nodes: Node[], edges: Edge[], description?: string): Snapshot {
    return {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        timestamp: Date.now(),
        description
    };
}

export function useUndoRedo(initialNodes: Node[], initialEdges: Edge[]) {
    const [state, setState] = useState<UndoRedoState>({
        past: [],
        present: cloneSnapshot(initialNodes, initialEdges, "Initial"),
        future: []
    });

    const skipNextPush = useRef(false);

    const pushState = useCallback((nodes: Node[], edges: Edge[], description?: string) => {
        if (skipNextPush.current) {
            skipNextPush.current = false;
            return;
        }
        setState((prev) => ({
            past: [...prev.past.slice(-(MAX_HISTORY - 1)), prev.present],
            present: cloneSnapshot(nodes, edges, description),
            future: []
        }));
    }, []);

    const undo = useCallback(() => {
        setState((prev) => {
            if (prev.past.length === 0) return prev;
            const newPast = [...prev.past];
            const previous = newPast.pop()!;
            skipNextPush.current = true;
            return {
                past: newPast,
                present: previous,
                future: [prev.present, ...prev.future]
            };
        });
    }, []);

    const redo = useCallback(() => {
        setState((prev) => {
            if (prev.future.length === 0) return prev;
            const newFuture = [...prev.future];
            const next = newFuture.shift()!;
            skipNextPush.current = true;
            return {
                past: [...prev.past, prev.present],
                present: next,
                future: newFuture
            };
        });
    }, []);

    const applyPatch = useCallback(
        (
            currentNodes: Node[],
            currentEdges: Edge[],
            patch: JsonPatchOperation[],
            description: string
        ) => {
            const data = { nodes: currentNodes, edges: currentEdges };
            const patched = applyJsonPatch(data, patch) as { nodes: Node[]; edges: Edge[] };
            pushState(patched.nodes, patched.edges, description);
            return patched;
        },
        [pushState]
    );

    const resetState = useCallback((nodes: Node[], edges: Edge[]) => {
        setState({
            past: [],
            present: cloneSnapshot(nodes, edges, "Reset"),
            future: []
        });
    }, []);

    return {
        currentSnapshot: state.present,
        pushState,
        undo,
        redo,
        applyPatch,
        resetState,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
        undoCount: state.past.length,
        redoCount: state.future.length
    };
}
