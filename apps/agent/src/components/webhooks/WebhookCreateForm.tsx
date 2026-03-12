"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { getApiBase } from "@/lib/utils";

type EntityOption = { id: string; slug: string; name: string };
type EntityType = "agent" | "workflow" | "network";

type WebhookCreateFormProps = {
    onCreated: () => void | Promise<void>;
    className?: string;
};

export default function WebhookCreateForm({ onCreated, className }: WebhookCreateFormProps) {
    const [entityType, setEntityType] = useState<EntityType>("agent");
    const [entityId, setEntityId] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [agents, setAgents] = useState<EntityOption[]>([]);
    const [workflows, setWorkflows] = useState<EntityOption[]>([]);
    const [networks, setNetworks] = useState<EntityOption[]>([]);
    const [loadingEntities, setLoadingEntities] = useState(true);

    const fetchEntities = useCallback(async () => {
        setLoadingEntities(true);
        try {
            const [agentsRes, workflowsRes, networksRes] = await Promise.all([
                fetch(`${getApiBase()}/api/agents`),
                fetch(`${getApiBase()}/api/workflows`),
                fetch(`${getApiBase()}/api/networks`)
            ]);
            const [agentsData, workflowsData, networksData] = await Promise.all([
                agentsRes.json(),
                workflowsRes.json(),
                networksRes.json()
            ]);

            if (agentsData.agents) {
                setAgents(
                    agentsData.agents.map((a: EntityOption) => ({
                        id: a.id,
                        slug: a.slug,
                        name: a.name
                    }))
                );
            }
            if (workflowsData.workflows) {
                setWorkflows(
                    workflowsData.workflows.map((w: EntityOption) => ({
                        id: w.id,
                        slug: w.slug,
                        name: w.name
                    }))
                );
            }
            if (networksData.networks) {
                setNetworks(
                    networksData.networks.map((n: EntityOption) => ({
                        id: n.id,
                        slug: n.slug,
                        name: n.name
                    }))
                );
            }
        } catch {
            console.error("Failed to fetch entities");
        } finally {
            setLoadingEntities(false);
        }
    }, []);

    useEffect(() => {
        fetchEntities();
    }, [fetchEntities]);

    useEffect(() => {
        setEntityId("");
    }, [entityType]);

    const currentOptions =
        entityType === "workflow" ? workflows : entityType === "network" ? networks : agents;

    const selectedEntity = currentOptions.find((e) => e.id === entityId);

    const handleSubmit = async () => {
        if (!entityId || !name.trim()) return;
        setSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            let url: string;
            if (entityType === "workflow") {
                url = `${getApiBase()}/api/workflows/${selectedEntity?.slug}/execution-triggers`;
            } else if (entityType === "network") {
                url = `${getApiBase()}/api/networks/${selectedEntity?.slug}/execution-triggers`;
            } else {
                url = `${getApiBase()}/api/agents/${entityId}/execution-triggers`;
            }

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "webhook",
                    name: name.trim(),
                    description: description.trim() || undefined
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || "Failed to create webhook");
                return;
            }

            setSuccess(`Webhook "${name.trim()}" created.`);
            setName("");
            setDescription("");
            setEntityId("");
            await onCreated();
        } catch {
            setError("Network error creating webhook");
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = entityId && name.trim() && !submitting;

    return (
        <div className={`flex flex-col rounded-lg border ${className || ""}`}>
            <div className="flex items-center justify-between border-b px-4 py-2.5">
                <span className="text-xs font-medium">Create Webhook</span>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
                {loadingEntities ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Loader2Icon className="text-muted-foreground h-5 w-5 animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Type</Label>
                            <Select
                                value={entityType}
                                onValueChange={(v) => setEntityType(v as EntityType)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="agent">Agent</SelectItem>
                                    <SelectItem value="workflow">Workflow</SelectItem>
                                    <SelectItem value="network">Network</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">
                                {entityType === "workflow"
                                    ? "Workflow"
                                    : entityType === "network"
                                      ? "Network"
                                      : "Agent"}
                            </Label>
                            {currentOptions.length === 0 ? (
                                <p className="text-muted-foreground text-xs">
                                    No {entityType}s found.
                                </p>
                            ) : (
                                <Select
                                    value={entityId}
                                    onValueChange={(v) => setEntityId(v ?? "")}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder={`Select a ${entityType}...`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {currentOptions.map((opt) => (
                                            <SelectItem key={opt.id} value={opt.id}>
                                                {opt.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Webhook Name</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Stripe Payment Received"
                                className="h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">
                                Description{" "}
                                <span className="text-muted-foreground">(optional)</span>
                            </Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What triggers this webhook?"
                                className="h-8 text-xs"
                            />
                        </div>

                        {error && (
                            <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-500">
                                {error}
                            </p>
                        )}
                        {success && (
                            <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
                                {success}
                            </p>
                        )}
                    </>
                )}
            </div>

            <div className="border-t p-3">
                <Button
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                >
                    {submitting ? (
                        <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <PlusIcon className="h-3.5 w-3.5" />
                    )}
                    Create Webhook
                </Button>
            </div>
        </div>
    );
}
