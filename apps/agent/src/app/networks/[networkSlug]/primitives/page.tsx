"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Primitive {
    id: string;
    primitiveType: string;
    agentId?: string | null;
    workflowId?: string | null;
    toolId?: string | null;
}

interface AgentOption {
    id: string;
    name: string;
}

interface WorkflowOption {
    id: string;
    name: string;
}

interface ToolOption {
    id: string;
    name: string;
}

export default function NetworkPrimitivesPage() {
    const params = useParams();
    const networkSlug = params.networkSlug as string;
    const [primitives, setPrimitives] = useState<Primitive[]>([]);
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
    const [tools, setTools] = useState<ToolOption[]>([]);
    const [newType, setNewType] = useState("agent");
    const [newTarget, setNewTarget] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const [networkRes, agentsRes, workflowsRes, toolsRes] = await Promise.all([
                fetch(`${getApiBase()}/api/networks/${networkSlug}`),
                fetch(`${getApiBase()}/api/agents`),
                fetch(`${getApiBase()}/api/workflows`),
                fetch(`${getApiBase()}/api/agents/tools`)
            ]);
            const networkData = await networkRes.json();
            const agentsData = await agentsRes.json();
            const workflowsData = await workflowsRes.json();
            const toolsData = await toolsRes.json();

            const agentItems = Array.isArray(agentsData.agents)
                ? (agentsData.agents as AgentOption[])
                : [];
            const workflowItems = Array.isArray(workflowsData.workflows)
                ? (workflowsData.workflows as WorkflowOption[])
                : [];
            const toolItems = Array.isArray(toolsData.tools)
                ? (toolsData.tools as ToolOption[])
                : [];

            setPrimitives(networkData.network?.primitives || []);
            setAgents(agentItems.map((agent) => ({ id: agent.id, name: agent.name })));
            setWorkflows(
                workflowItems.map((workflow) => ({ id: workflow.id, name: workflow.name }))
            );
            setTools(toolItems.map((tool) => ({ id: tool.id, name: tool.name })));
        };

        fetchData();
    }, [networkSlug]);

    const savePrimitives = async (updated: Primitive[]) => {
        setSaving(true);
        try {
            await fetch(`${getApiBase()}/api/networks/${networkSlug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    primitives: updated
                })
            });
            setPrimitives(updated);
        } finally {
            setSaving(false);
        }
    };

    const addPrimitive = () => {
        if (!newTarget) return;
        const newPrimitive: Primitive = {
            id: `temp-${Date.now()}`,
            primitiveType: newType,
            agentId: newType === "agent" ? newTarget : null,
            workflowId: newType === "workflow" ? newTarget : null,
            toolId: newType === "tool" ? newTarget : null
        };
        const updated = [...primitives, newPrimitive];
        savePrimitives(updated);
        setNewTarget("");
    };

    const removePrimitive = (index: number) => {
        const updated = primitives.filter((_, i) => i !== index);
        savePrimitives(updated);
    };

    const options = newType === "agent" ? agents : newType === "workflow" ? workflows : tools;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Primitives</CardTitle>
                    <CardDescription>Configure agents, workflows, and tools.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {primitives.length === 0 ? (
                        <div className="text-muted-foreground text-sm">No primitives yet.</div>
                    ) : (
                        primitives.map((primitive, index) => (
                            <div
                                key={`${primitive.primitiveType}-${primitive.id}-${index}`}
                                className="flex items-center justify-between gap-4 text-sm"
                            >
                                <div>
                                    {primitive.primitiveType}:{" "}
                                    {primitive.agentId ||
                                        primitive.workflowId ||
                                        primitive.toolId ||
                                        "Unknown"}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removePrimitive(index)}
                                >
                                    Remove
                                </Button>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Add primitive</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                        <Select
                            value={newType}
                            onValueChange={(value) => setNewType(value ?? "agent")}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="agent">Agent</SelectItem>
                                <SelectItem value="workflow">Workflow</SelectItem>
                                <SelectItem value="tool">Tool</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={newTarget}
                            onValueChange={(value) => setNewTarget(value ?? "")}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select target" />
                            </SelectTrigger>
                            <SelectContent>
                                {options.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                        {option.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={addPrimitive} disabled={saving || !newTarget}>
                        {saving ? "Saving..." : "Add primitive"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
