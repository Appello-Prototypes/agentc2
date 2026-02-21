"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
    Skeleton,
    Switch,
    cn
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface ChannelBinding {
    id: string;
    channelType: string;
    channelIdentifier: string;
    channelName: string | null;
    triggerOnAllMessages: boolean;
    triggerKeywords: string[];
    isActive: boolean;
}

interface Instance {
    id: string;
    name: string;
    slug: string;
    agentId: string;
    organizationId: string;
    contextType: string | null;
    contextId: string | null;
    contextData: Record<string, unknown> | null;
    instructionOverrides: string | null;
    memoryNamespace: string;
    ragCollectionId: string | null;
    temperatureOverride: number | null;
    maxStepsOverride: number | null;
    isActive: boolean;
    version: number;
    metadata: Record<string, unknown> | null;
    channelBindings: ChannelBinding[];
    createdAt: string;
    updatedAt: string;
}

const CHANNEL_TYPES = ["slack", "email", "whatsapp", "web", "voice"] as const;

export default function InstancesPage() {
    const params = useParams();
    const agentSlug = params.agentSlug as string;

    const [instances, setInstances] = useState<Instance[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [agentId, setAgentId] = useState<string | null>(null);

    // Add-binding form state (per instance)
    const [addingBindingFor, setAddingBindingFor] = useState<string | null>(null);
    const [bindingChannelType, setBindingChannelType] = useState<string>("slack");
    const [bindingChannelId, setBindingChannelId] = useState("");
    const [bindingChannelName, setBindingChannelName] = useState("");
    const [bindingTriggerAll, setBindingTriggerAll] = useState(false);
    const [bindingSaving, setBindingSaving] = useState(false);

    const fetchInstances = useCallback(async () => {
        try {
            const agentRes = await fetch(`${getApiBase()}/api/agents/${agentSlug}`);
            const agentData = await agentRes.json();
            if (!agentData.success || !agentData.agent) return;

            setAgentId(agentData.agent.id);

            const res = await fetch(`${getApiBase()}/api/instances?agentId=${agentData.agent.id}`);
            const data = await res.json();
            if (data.instances) {
                setInstances(data.instances);
            }
        } catch (error) {
            console.error("Failed to fetch instances:", error);
        } finally {
            setLoading(false);
        }
    }, [agentSlug]);

    useEffect(() => {
        fetchInstances();
    }, [fetchInstances]);

    const toggleActive = async (instanceId: string, currentActive: boolean) => {
        try {
            await fetch(`${getApiBase()}/api/instances/${instanceId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentActive })
            });
            fetchInstances();
        } catch (error) {
            console.error("Failed to toggle instance:", error);
        }
    };

    const deleteInstance = async (instanceId: string) => {
        if (!confirm("Delete this instance and all its channel bindings?")) return;
        try {
            await fetch(`${getApiBase()}/api/instances/${instanceId}`, {
                method: "DELETE"
            });
            fetchInstances();
        } catch (error) {
            console.error("Failed to delete instance:", error);
        }
    };

    const addBinding = async (instanceId: string) => {
        if (!bindingChannelId.trim()) return;
        setBindingSaving(true);
        try {
            await fetch(`${getApiBase()}/api/instances/${instanceId}/bindings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelType: bindingChannelType,
                    channelIdentifier: bindingChannelId.trim(),
                    channelName: bindingChannelName.trim() || null,
                    triggerOnAllMessages: bindingTriggerAll
                })
            });
            setAddingBindingFor(null);
            setBindingChannelId("");
            setBindingChannelName("");
            setBindingTriggerAll(false);
            fetchInstances();
        } catch (error) {
            console.error("Failed to add binding:", error);
        } finally {
            setBindingSaving(false);
        }
    };

    const removeBinding = async (instanceId: string, bindingId: string) => {
        try {
            await fetch(
                `${getApiBase()}/api/instances/${instanceId}/bindings?bindingId=${bindingId}`,
                { method: "DELETE" }
            );
            fetchInstances();
        } catch (error) {
            console.error("Failed to remove binding:", error);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 p-6">
                <Skeleton className="h-8 w-48" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Instances</h1>
                    <p className="text-muted-foreground text-sm">
                        Deployed copies of this agent, each with isolated memory and custom
                        configuration.
                    </p>
                </div>
                <Badge variant="outline" className="tabular-nums">
                    {instances.length} instance{instances.length !== 1 ? "s" : ""}
                </Badge>
            </div>

            {instances.length === 0 ? (
                <div className="border-border bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                    <p className="text-muted-foreground mb-1 text-sm font-medium">
                        No instances deployed
                    </p>
                    <p className="text-muted-foreground mb-4 text-xs">
                        Create an instance to deploy this agent with isolated memory and custom
                        overrides.
                    </p>
                    <p className="text-muted-foreground text-xs">
                        Use the{" "}
                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">
                            instance-create
                        </code>{" "}
                        MCP tool or the API to create instances.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {instances.map((instance) => {
                        const isExpanded = expandedId === instance.id;
                        return (
                            <div
                                key={instance.id}
                                className="border-border bg-card rounded-lg border"
                            >
                                <button
                                    className="flex w-full items-center justify-between p-4 text-left"
                                    onClick={() => setExpandedId(isExpanded ? null : instance.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={cn(
                                                "size-2 shrink-0 rounded-full",
                                                instance.isActive
                                                    ? "bg-green-500"
                                                    : "bg-muted-foreground"
                                            )}
                                        />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{instance.name}</span>
                                                <span className="text-muted-foreground font-mono text-xs">
                                                    {instance.slug}
                                                </span>
                                            </div>
                                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                                {instance.contextType && (
                                                    <Badge
                                                        variant="outline"
                                                        className="h-4 px-1 text-[9px]"
                                                    >
                                                        {instance.contextType}
                                                    </Badge>
                                                )}
                                                <span>
                                                    {instance.channelBindings.length} binding
                                                    {instance.channelBindings.length !== 1
                                                        ? "s"
                                                        : ""}
                                                </span>
                                                <span className="text-muted-foreground/50">·</span>
                                                <span className="font-mono">
                                                    {instance.memoryNamespace}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <span
                                        className={cn(
                                            "text-muted-foreground text-xs transition-transform",
                                            isExpanded && "rotate-180"
                                        )}
                                    >
                                        ▼
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="border-border space-y-4 border-t px-4 pt-3 pb-4">
                                        {instance.instructionOverrides && (
                                            <div>
                                                <h4 className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                                                    Instruction Overrides
                                                </h4>
                                                <pre className="bg-muted max-h-32 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
                                                    {instance.instructionOverrides}
                                                </pre>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <span className="text-muted-foreground text-xs">
                                                    Temperature
                                                </span>
                                                <p className="font-mono text-sm">
                                                    {instance.temperatureOverride ?? "default"}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-xs">
                                                    Max Steps
                                                </span>
                                                <p className="font-mono text-sm">
                                                    {instance.maxStepsOverride ?? "default"}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-xs">
                                                    Version
                                                </span>
                                                <p className="font-mono text-sm">
                                                    v{instance.version}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Channel Bindings */}
                                        <div>
                                            <div className="mb-2 flex items-center justify-between">
                                                <h4 className="text-muted-foreground text-xs font-medium uppercase">
                                                    Channel Bindings
                                                </h4>
                                                {addingBindingFor !== instance.id && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAddingBindingFor(instance.id);
                                                            setBindingChannelType("slack");
                                                            setBindingChannelId("");
                                                            setBindingChannelName("");
                                                            setBindingTriggerAll(false);
                                                        }}
                                                    >
                                                        + Add Binding
                                                    </Button>
                                                )}
                                            </div>

                                            {instance.channelBindings.length > 0 && (
                                                <div className="mb-2 space-y-1.5">
                                                    {instance.channelBindings.map((b) => (
                                                        <div
                                                            key={b.id}
                                                            className="bg-muted/50 flex items-center justify-between rounded px-3 py-1.5 text-xs"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="h-4 px-1 text-[9px]"
                                                                >
                                                                    {b.channelType}
                                                                </Badge>
                                                                <span className="font-medium">
                                                                    {b.channelName ||
                                                                        b.channelIdentifier}
                                                                </span>
                                                                <span className="text-muted-foreground font-mono">
                                                                    {b.channelIdentifier}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {b.triggerOnAllMessages && (
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className="h-4 px-1 text-[9px]"
                                                                    >
                                                                        all messages
                                                                    </Badge>
                                                                )}
                                                                {b.triggerKeywords.length > 0 && (
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className="h-4 px-1 text-[9px]"
                                                                    >
                                                                        {b.triggerKeywords.length}{" "}
                                                                        keyword
                                                                        {b.triggerKeywords
                                                                            .length !== 1
                                                                            ? "s"
                                                                            : ""}
                                                                    </Badge>
                                                                )}
                                                                <span
                                                                    className={cn(
                                                                        "size-1.5 rounded-full",
                                                                        b.isActive
                                                                            ? "bg-green-500"
                                                                            : "bg-muted-foreground"
                                                                    )}
                                                                />
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-destructive h-5 px-1 text-[10px]"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        removeBinding(
                                                                            instance.id,
                                                                            b.id
                                                                        );
                                                                    }}
                                                                >
                                                                    Remove
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {instance.channelBindings.length === 0 &&
                                                addingBindingFor !== instance.id && (
                                                    <p className="text-muted-foreground mb-2 text-xs">
                                                        No channel bindings configured.
                                                    </p>
                                                )}

                                            {/* Add Binding Form */}
                                            {addingBindingFor === instance.id && (
                                                <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">
                                                                Channel Type
                                                            </Label>
                                                            <Select
                                                                value={bindingChannelType}
                                                                onValueChange={(v) =>
                                                                    setBindingChannelType(
                                                                        v ?? "slack"
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {CHANNEL_TYPES.map((t) => (
                                                                        <SelectItem
                                                                            key={t}
                                                                            value={t}
                                                                        >
                                                                            {t
                                                                                .charAt(0)
                                                                                .toUpperCase() +
                                                                                t.slice(1)}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">
                                                                Channel ID
                                                            </Label>
                                                            <Input
                                                                className="h-8 text-xs"
                                                                placeholder={
                                                                    bindingChannelType === "slack"
                                                                        ? "C0123456789"
                                                                        : "identifier"
                                                                }
                                                                value={bindingChannelId}
                                                                onChange={(e) =>
                                                                    setBindingChannelId(
                                                                        e.target.value
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">
                                                            Display Name (optional)
                                                        </Label>
                                                        <Input
                                                            className="h-8 text-xs"
                                                            placeholder={
                                                                bindingChannelType === "slack"
                                                                    ? "#channel-name"
                                                                    : "name"
                                                            }
                                                            value={bindingChannelName}
                                                            onChange={(e) =>
                                                                setBindingChannelName(
                                                                    e.target.value
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={bindingTriggerAll}
                                                            onCheckedChange={setBindingTriggerAll}
                                                        />
                                                        <Label className="text-xs">
                                                            Trigger on all messages (no @mention
                                                            required)
                                                        </Label>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={
                                                                !bindingChannelId.trim() ||
                                                                bindingSaving
                                                            }
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                addBinding(instance.id);
                                                            }}
                                                        >
                                                            {bindingSaving
                                                                ? "Saving..."
                                                                : "Add Binding"}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setAddingBindingFor(null);
                                                            }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 pt-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    toggleActive(instance.id, instance.isActive)
                                                }
                                            >
                                                {instance.isActive ? "Deactivate" : "Activate"}
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => deleteInstance(instance.id)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
