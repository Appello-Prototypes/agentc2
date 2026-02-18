"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Badge,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Separator
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentOption {
    id: string;
    slug: string;
    name: string;
}

interface ChannelBinding {
    id: string;
    channelType: string;
    channelIdentifier: string;
    channelName: string | null;
    replyMode: string | null;
    triggerOnAllMessages: boolean;
    triggerKeywords: string[];
    isActive: boolean;
}

interface AgentInstance {
    id: string;
    name: string;
    slug: string;
    agentId: string;
    agent: AgentOption;
    contextType: string | null;
    contextId: string | null;
    contextData: Record<string, unknown> | null;
    instructionOverrides: string | null;
    memoryNamespace: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    channelBindings: ChannelBinding[];
}

interface SlackChannel {
    id: string;
    name: string;
    isPrivate: boolean;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function InstancesPage() {
    const [instances, setInstances] = useState<AgentInstance[]>([]);
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
    const [loading, setLoading] = useState(true);

    // Create dialog state
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [newAgentId, setNewAgentId] = useState("");
    const [newContextType, setNewContextType] = useState("");
    const [newContextId, setNewContextId] = useState("");
    const [newOverrides, setNewOverrides] = useState("");

    // Binding dialog state
    const [showBinding, setShowBinding] = useState(false);
    const [bindingInstanceId, setBindingInstanceId] = useState("");
    const [bindingChannelType, setBindingChannelType] = useState("slack");
    const [bindingChannelId, setBindingChannelId] = useState("");
    const [bindingTriggerAll, setBindingTriggerAll] = useState(false);
    const [addingBinding, setAddingBinding] = useState(false);

    // Detail panel
    const [selectedInstance, setSelectedInstance] = useState<AgentInstance | null>(null);
    const [editingOverrides, setEditingOverrides] = useState(false);
    const [overridesText, setOverridesText] = useState("");
    const [savingOverrides, setSavingOverrides] = useState(false);

    const base = getApiBase();

    const fetchInstances = useCallback(async () => {
        try {
            const res = await fetch(`${base}/api/instances`);
            const data = await res.json();
            setInstances(data.instances || []);
        } catch (e) {
            console.error("Failed to fetch instances:", e);
        }
    }, [base]);

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(`${base}/api/agents`);
            const data = await res.json();
            const list = (data.agents || data || []).map(
                (a: { id: string; slug: string; name: string }) => ({
                    id: a.id,
                    slug: a.slug,
                    name: a.name
                })
            );
            setAgents(list);
        } catch (e) {
            console.error("Failed to fetch agents:", e);
        }
    }, [base]);

    const fetchSlackChannels = useCallback(async () => {
        try {
            const res = await fetch(`${base}/api/slack/channels?available`);
            const data = await res.json();
            setSlackChannels(data.channels || []);
        } catch {
            // Slack may not be connected
        }
    }, [base]);

    useEffect(() => {
        Promise.all([fetchInstances(), fetchAgents(), fetchSlackChannels()]).finally(() =>
            setLoading(false)
        );
    }, [fetchInstances, fetchAgents, fetchSlackChannels]);

    // Auto-generate slug from name
    useEffect(() => {
        if (newName && !newSlug) {
            setNewSlug(
                newName
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
            );
        }
    }, [newName, newSlug]);

    const handleCreate = async () => {
        if (!newAgentId || !newName || !newSlug) return;
        setCreating(true);

        try {
            const res = await fetch(`${base}/api/instances`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agentId: newAgentId,
                    name: newName,
                    slug: newSlug,
                    contextType: newContextType || undefined,
                    contextId: newContextId || undefined,
                    instructionOverrides: newOverrides || undefined
                })
            });

            if (res.ok) {
                setShowCreate(false);
                setNewName("");
                setNewSlug("");
                setNewAgentId("");
                setNewContextType("");
                setNewContextId("");
                setNewOverrides("");
                await fetchInstances();
            } else {
                const err = await res.json();
                alert(err.error || "Failed to create instance");
            }
        } catch (e) {
            console.error("Failed to create instance:", e);
        } finally {
            setCreating(false);
        }
    };

    const handleAddBinding = async () => {
        if (!bindingInstanceId || !bindingChannelId) return;
        setAddingBinding(true);

        const channelName =
            bindingChannelType === "slack"
                ? slackChannels.find((c) => c.id === bindingChannelId)?.name || null
                : null;

        try {
            const res = await fetch(`${base}/api/instances/${bindingInstanceId}/bindings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channelType: bindingChannelType,
                    channelIdentifier: bindingChannelId,
                    channelName: channelName ? `#${channelName}` : undefined,
                    channelMetadata:
                        bindingChannelType === "slack" ? { teamId: "auto" } : undefined,
                    triggerOnAllMessages: bindingTriggerAll
                })
            });

            if (res.ok) {
                setShowBinding(false);
                setBindingChannelId("");
                setBindingTriggerAll(false);
                await fetchInstances();
            } else {
                const err = await res.json();
                alert(err.error || "Failed to add binding");
            }
        } catch (e) {
            console.error("Failed to add binding:", e);
        } finally {
            setAddingBinding(false);
        }
    };

    const handleRemoveBinding = async (instanceId: string, bindingId: string) => {
        try {
            await fetch(`${base}/api/instances/${instanceId}/bindings?bindingId=${bindingId}`, {
                method: "DELETE"
            });
            await fetchInstances();
            if (selectedInstance?.id === instanceId) {
                const updated = instances.find((i) => i.id === instanceId);
                if (updated) {
                    setSelectedInstance({
                        ...updated,
                        channelBindings: updated.channelBindings.filter((b) => b.id !== bindingId)
                    });
                }
            }
        } catch (e) {
            console.error("Failed to remove binding:", e);
        }
    };

    const handleDeleteInstance = async (id: string) => {
        if (!confirm("Delete this agent instance? This cannot be undone.")) return;
        try {
            await fetch(`${base}/api/instances/${id}`, { method: "DELETE" });
            if (selectedInstance?.id === id) setSelectedInstance(null);
            await fetchInstances();
        } catch (e) {
            console.error("Failed to delete instance:", e);
        }
    };

    const handleSaveOverrides = async () => {
        if (!selectedInstance) return;
        setSavingOverrides(true);
        try {
            const res = await fetch(`${base}/api/instances/${selectedInstance.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instructionOverrides: overridesText || null
                })
            });
            if (res.ok) {
                setEditingOverrides(false);
                await fetchInstances();
                const data = await res.json();
                setSelectedInstance(data.instance);
            }
        } catch (e) {
            console.error("Failed to save overrides:", e);
        } finally {
            setSavingOverrides(false);
        }
    };

    const channelTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            slack: "Slack",
            email: "Email",
            whatsapp: "WhatsApp",
            web: "Web",
            voice: "Voice"
        };
        return labels[type] || type;
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Agent Instances</h2>
                <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Agent Instances</h2>
                    <p className="text-muted-foreground text-sm">
                        Create isolated instances of agent templates, each bound to a specific deal,
                        customer, or project with its own memory and channel bindings.
                    </p>
                </div>
                <Button onClick={() => setShowCreate(true)}>Create Instance</Button>
            </div>

            {/* Instances Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Active Instances</CardTitle>
                    <CardDescription>
                        {instances.length} instance{instances.length !== 1 ? "s" : ""} configured
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {instances.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center text-sm">
                            No instances yet. Create one to bind an agent template to a deal,
                            customer, or project.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Instance</TableHead>
                                    <TableHead>Agent Template</TableHead>
                                    <TableHead>Context</TableHead>
                                    <TableHead>Channels</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[100px]" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {instances.map((inst) => (
                                    <TableRow
                                        key={inst.id}
                                        className="cursor-pointer"
                                        onClick={() => {
                                            setSelectedInstance(inst);
                                            setEditingOverrides(false);
                                        }}
                                    >
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{inst.name}</p>
                                                <p className="text-muted-foreground text-xs">
                                                    {inst.slug}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{inst.agent.name}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {inst.contextType ? (
                                                <div>
                                                    <Badge
                                                        variant="secondary"
                                                        className="capitalize"
                                                    >
                                                        {inst.contextType}
                                                    </Badge>
                                                    {inst.contextId && (
                                                        <p className="text-muted-foreground mt-0.5 text-xs">
                                                            {inst.contextId}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">
                                                    None
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {inst.channelBindings.length === 0 ? (
                                                    <span className="text-muted-foreground text-xs">
                                                        No channels
                                                    </span>
                                                ) : (
                                                    inst.channelBindings.map((b) => (
                                                        <Badge
                                                            key={b.id}
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {channelTypeLabel(b.channelType)}
                                                            {b.channelName
                                                                ? `: ${b.channelName}`
                                                                : ""}
                                                        </Badge>
                                                    ))
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={inst.isActive ? "default" : "secondary"}
                                            >
                                                {inst.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setBindingInstanceId(inst.id);
                                                        setShowBinding(true);
                                                    }}
                                                >
                                                    + Channel
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Instance Detail Panel */}
            {selectedInstance && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{selectedInstance.name}</CardTitle>
                                <CardDescription>
                                    Instance of <strong>{selectedInstance.agent.name}</strong>{" "}
                                    &middot; Memory: {selectedInstance.memoryNamespace}
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setBindingInstanceId(selectedInstance.id);
                                        setShowBinding(true);
                                    }}
                                >
                                    Add Channel
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteInstance(selectedInstance.id)}
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Context Data */}
                        {selectedInstance.contextType && (
                            <div>
                                <h4 className="mb-2 text-sm font-medium">Context</h4>
                                <div className="bg-muted/50 rounded-md border p-3">
                                    <p className="text-sm">
                                        <strong className="capitalize">
                                            {selectedInstance.contextType}
                                        </strong>
                                        {selectedInstance.contextId &&
                                            ` — ${selectedInstance.contextId}`}
                                    </p>
                                    {selectedInstance.contextData && (
                                        <pre className="text-muted-foreground mt-2 text-xs">
                                            {JSON.stringify(selectedInstance.contextData, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Instruction Overrides */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h4 className="text-sm font-medium">
                                    Instance-Specific Instructions
                                </h4>
                                {!editingOverrides && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setOverridesText(
                                                selectedInstance.instructionOverrides || ""
                                            );
                                            setEditingOverrides(true);
                                        }}
                                    >
                                        Edit
                                    </Button>
                                )}
                            </div>
                            {editingOverrides ? (
                                <div className="space-y-2">
                                    <Textarea
                                        value={overridesText}
                                        onChange={(e) => setOverridesText(e.target.value)}
                                        placeholder="Add special instructions for this instance... (e.g., 'Customer is price-sensitive. Push for close by March 31.')"
                                        rows={6}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={handleSaveOverrides}
                                            disabled={savingOverrides}
                                        >
                                            {savingOverrides ? "Saving..." : "Save"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingOverrides(false)}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-muted/50 rounded-md border p-3">
                                    {selectedInstance.instructionOverrides ? (
                                        <pre className="text-sm whitespace-pre-wrap">
                                            {selectedInstance.instructionOverrides}
                                        </pre>
                                    ) : (
                                        <p className="text-muted-foreground text-sm italic">
                                            No instance-specific instructions. Click Edit to add
                                            notes specific to this deal/customer.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Channel Bindings */}
                        <div>
                            <h4 className="mb-2 text-sm font-medium">Channel Bindings</h4>
                            {selectedInstance.channelBindings.length === 0 ? (
                                <p className="text-muted-foreground text-sm italic">
                                    No channels connected. Add a channel to start using this
                                    instance.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {selectedInstance.channelBindings.map((b) => (
                                        <div
                                            key={b.id}
                                            className="bg-muted/50 flex items-center justify-between rounded-md border p-3"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">
                                                        {channelTypeLabel(b.channelType)}
                                                    </Badge>
                                                    <span className="text-sm font-medium">
                                                        {b.channelName || b.channelIdentifier}
                                                    </span>
                                                </div>
                                                <div className="text-muted-foreground mt-1 flex gap-2 text-xs">
                                                    {b.triggerOnAllMessages && (
                                                        <span>All messages</span>
                                                    )}
                                                    {b.triggerKeywords.length > 0 && (
                                                        <span>
                                                            Keywords: {b.triggerKeywords.join(", ")}
                                                        </span>
                                                    )}
                                                    {b.replyMode && (
                                                        <span>Reply: {b.replyMode}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive"
                                                onClick={() =>
                                                    handleRemoveBinding(selectedInstance.id, b.id)
                                                }
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Create Instance Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Agent Instance</DialogTitle>
                        <DialogDescription>
                            Create an isolated instance of an agent template, bound to a specific
                            deal, customer, or project.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Agent Template</Label>
                            <Select
                                value={newAgentId}
                                onValueChange={(v: string | null) => {
                                    if (v) setNewAgentId(v);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an agent template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                            {a.name} ({a.slug})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Instance Name</Label>
                            <Input
                                value={newName}
                                onChange={(e) => {
                                    setNewName(e.target.value);
                                    if (!newSlug) {
                                        setNewSlug(
                                            e.target.value
                                                .toLowerCase()
                                                .replace(/[^a-z0-9]+/g, "-")
                                                .replace(/^-|-$/g, "")
                                        );
                                    }
                                }}
                                placeholder="e.g., Owens Insulation Deal Manager"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Slug</Label>
                            <Input
                                value={newSlug}
                                onChange={(e) => setNewSlug(e.target.value)}
                                placeholder="e.g., owens-insulation"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Context Type</Label>
                                <Select
                                    value={newContextType}
                                    onValueChange={(v: string | null) => {
                                        if (v) setNewContextType(v);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Optional" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="deal">Deal</SelectItem>
                                        <SelectItem value="customer">Customer</SelectItem>
                                        <SelectItem value="project">Project</SelectItem>
                                        <SelectItem value="support">Support</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Context ID</Label>
                                <Input
                                    value={newContextId}
                                    onChange={(e) => setNewContextId(e.target.value)}
                                    placeholder="e.g., HubSpot deal ID"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Instance-Specific Instructions</Label>
                            <Textarea
                                value={newOverrides}
                                onChange={(e) => setNewOverrides(e.target.value)}
                                placeholder="Optional notes specific to this instance..."
                                rows={4}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCreate(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={creating || !newAgentId || !newName || !newSlug}
                        >
                            {creating ? "Creating..." : "Create Instance"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Channel Binding Dialog */}
            <Dialog open={showBinding} onOpenChange={setShowBinding}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Channel Binding</DialogTitle>
                        <DialogDescription>
                            Connect a communication channel to this agent instance. Messages on this
                            channel will be routed to the instance with its isolated context and
                            memory.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Channel Type</Label>
                            <Select
                                value={bindingChannelType}
                                onValueChange={(v: string | null) => {
                                    if (v) {
                                        setBindingChannelType(v);
                                        setBindingChannelId("");
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="slack">Slack</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    <SelectItem value="web">Web Embed</SelectItem>
                                    <SelectItem value="voice">Voice</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {bindingChannelType === "slack" ? (
                            <div className="space-y-2">
                                <Label>Slack Channel</Label>
                                {slackChannels.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">
                                        No Slack channels available. Connect Slack in Organization
                                        settings first.
                                    </p>
                                ) : (
                                    <Select
                                        value={bindingChannelId}
                                        onValueChange={(v: string | null) => {
                                            if (v) setBindingChannelId(v);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a channel" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {slackChannels
                                                .slice()
                                                .sort((a, b) => a.name.localeCompare(b.name))
                                                .map((ch) => (
                                                    <SelectItem key={ch.id} value={ch.id}>
                                                        #{ch.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Channel Identifier</Label>
                                <Input
                                    value={bindingChannelId}
                                    onChange={(e) => setBindingChannelId(e.target.value)}
                                    placeholder={
                                        bindingChannelType === "email"
                                            ? "deals+owens@agentc2.ai"
                                            : bindingChannelType === "whatsapp"
                                              ? "+1-555-0100"
                                              : bindingChannelType === "web"
                                                ? "embed-token"
                                                : "identifier"
                                    }
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="triggerAll"
                                checked={bindingTriggerAll}
                                onChange={(e) => setBindingTriggerAll(e.target.checked)}
                                className="rounded"
                            />
                            <Label htmlFor="triggerAll" className="cursor-pointer text-sm">
                                Respond to all messages (no @mention required)
                            </Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowBinding(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddBinding}
                            disabled={addingBinding || !bindingChannelId}
                        >
                            {addingBinding ? "Adding..." : "Add Channel"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
