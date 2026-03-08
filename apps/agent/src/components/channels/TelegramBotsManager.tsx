"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Skeleton
} from "@repo/ui";
import {
    ArrowLeftIcon,
    BotIcon,
    CheckCircle2Icon,
    ExternalLinkIcon,
    Loader2Icon,
    PlusIcon,
    Trash2Icon,
    WifiIcon,
    WifiOffIcon,
    XCircleIcon
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BotInfo {
    id: string;
    name: string;
    botUsername: string | null;
    botId: number | null;
    agentSlug: string | null;
    instanceId: string | null;
    instance: {
        id: string;
        name: string;
        slug: string;
        isActive: boolean;
        agent: { id: string; slug: string; name: string };
    } | null;
    agent: { id: string; slug: string; name: string } | null;
    webhookPath: string | null;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
}

interface AgentOption {
    id: string;
    slug: string;
    name: string;
}

interface InstanceOption {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    agent: { id: string; slug: string; name: string };
}

type WizardStep = "token" | "binding" | "creating";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TelegramBotsManager() {
    const apiBase = getApiBase();
    const [bots, setBots] = useState<BotInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // -----------------------------------------------------------------------
    // Fetch bots
    // -----------------------------------------------------------------------

    const fetchBots = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/api/channels/telegram/bots`);
            const data = await res.json();
            if (data.success) {
                setBots(data.bots || []);
            } else {
                setError(data.error || "Failed to load bots");
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load bots");
        } finally {
            setLoading(false);
        }
    }, [apiBase]);

    useEffect(() => {
        fetchBots();
    }, [fetchBots]);

    // -----------------------------------------------------------------------
    // Delete bot
    // -----------------------------------------------------------------------

    const handleDelete = async (botId: string) => {
        if (!confirm("Delete this bot? This will remove its webhook from Telegram.")) {
            return;
        }

        setDeletingId(botId);
        try {
            const res = await fetch(`${apiBase}/api/channels/telegram/bots/${botId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                setBots((prev) => prev.filter((b) => b.id !== botId));
            } else {
                alert(data.error || "Failed to delete bot");
            }
        } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to delete bot");
        } finally {
            setDeletingId(null);
        }
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href="/mcp/providers">
                    <Button variant="ghost" size="icon">
                        <ArrowLeftIcon className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">Telegram Bots</h1>
                    <p className="text-muted-foreground text-sm">
                        Connect Telegram bots to agents or agent instances
                    </p>
                </div>
                <Button onClick={() => setShowAddDialog(true)}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add Bot
                </Button>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="grid gap-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            )}

            {/* Empty state */}
            {!loading && bots.length === 0 && !error && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BotIcon className="text-muted-foreground mb-4 h-12 w-12" />
                        <h3 className="mb-2 text-lg font-semibold">No bots connected</h3>
                        <p className="text-muted-foreground mb-4 max-w-sm text-center text-sm">
                            Connect a Telegram bot to an agent or agent instance. Create a bot with
                            @BotFather on Telegram first.
                        </p>
                        <Button onClick={() => setShowAddDialog(true)}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            Add Your First Bot
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Bot cards */}
            <div className="grid gap-4">
                {bots.map((bot) => (
                    <BotCard
                        key={bot.id}
                        bot={bot}
                        onDelete={handleDelete}
                        deleting={deletingId === bot.id}
                    />
                ))}
            </div>

            {/* Add dialog */}
            <AddBotDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onCreated={() => {
                    setShowAddDialog(false);
                    fetchBots();
                }}
                apiBase={apiBase}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Bot Card
// ---------------------------------------------------------------------------

function BotCard({
    bot,
    onDelete,
    deleting
}: {
    bot: BotInfo;
    onDelete: (id: string) => void;
    deleting: boolean;
}) {
    const targetLabel = bot.instance
        ? `${bot.instance.agent.name} / ${bot.instance.name}`
        : bot.agent
          ? bot.agent.name
          : bot.agentSlug || "Unknown";

    const targetType = bot.instanceId ? "Instance" : "Agent";

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                            <BotIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-base">
                                {bot.botUsername ? `@${bot.botUsername}` : bot.name}
                            </CardTitle>
                            <CardDescription>
                                {targetType}: {targetLabel}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {bot.webhookPath ? (
                            <Badge variant="default" className="gap-1">
                                <WifiIcon className="h-3 w-3" />
                                Webhook Active
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="gap-1">
                                <WifiOffIcon className="h-3 w-3" />
                                No Webhook
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => onDelete(bot.id)}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2Icon className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="bg-muted/50 grid grid-cols-2 gap-x-6 gap-y-2 rounded-md p-3 text-sm md:grid-cols-3">
                    <div>
                        <span className="text-muted-foreground text-xs">Bot ID</span>
                        <p className="font-mono text-xs">{bot.botId || "-"}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground text-xs">Connection ID</span>
                        <p className="font-mono text-xs">{bot.id.slice(0, 12)}...</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground text-xs">Created</span>
                        <p className="text-xs">{new Date(bot.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                {bot.botUsername && (
                    <div className="mt-3">
                        <a
                            href={`https://t.me/${bot.botUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                        >
                            Open in Telegram
                            <ExternalLinkIcon className="h-3 w-3" />
                        </a>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Add Bot Dialog
// ---------------------------------------------------------------------------

function AddBotDialog({
    open,
    onOpenChange,
    onCreated,
    apiBase
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
    apiBase: string;
}) {
    const [step, setStep] = useState<WizardStep>("token");

    // Token step
    const [botToken, setBotToken] = useState("");
    const [validating, setValidating] = useState(false);
    const [validatedBot, setValidatedBot] = useState<{
        username: string;
        firstName: string;
        id: number;
    } | null>(null);
    const [tokenError, setTokenError] = useState<string | null>(null);

    // Binding step
    const [bindingType, setBindingType] = useState<"agent" | "instance">("agent");
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [instances, setInstances] = useState<InstanceOption[]>([]);
    const [selectedAgentSlug, setSelectedAgentSlug] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState("");
    const [selectedInstanceId, setSelectedInstanceId] = useState("");
    const [createNewInstance, setCreateNewInstance] = useState(false);
    const [newInstanceName, setNewInstanceName] = useState("");
    const [newInstanceSlug, setNewInstanceSlug] = useState("");
    const [newInstanceInstructions, setNewInstanceInstructions] = useState("");
    const [loadingAgents, setLoadingAgents] = useState(false);
    const [loadingInstances, setLoadingInstances] = useState(false);

    // Creating step
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createdBot, setCreatedBot] = useState<{
        botUsername: string;
        webhookRegistered: boolean;
        connectionId: string;
    } | null>(null);

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setStep("token");
                setBotToken("");
                setValidating(false);
                setValidatedBot(null);
                setTokenError(null);
                setBindingType("agent");
                setSelectedAgentSlug("");
                setSelectedAgentId("");
                setSelectedInstanceId("");
                setCreateNewInstance(false);
                setNewInstanceName("");
                setNewInstanceSlug("");
                setNewInstanceInstructions("");
                setCreating(false);
                setCreateError(null);
                setCreatedBot(null);
            }, 200);
        }
    }, [open]);

    // Fetch agents when entering binding step
    useEffect(() => {
        if (step !== "binding") return;
        let cancelled = false;
        setLoadingAgents(true);
        (async () => {
            try {
                const res = await fetch(`${apiBase}/api/agents`);
                const data = await res.json();
                if (!cancelled) {
                    const agentList = (data.agents || data || [])
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .filter((a: any) => a.isActive !== false)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .map((a: any) => ({
                            id: a.id,
                            slug: a.slug,
                            name: a.name
                        }));
                    setAgents(agentList);
                }
            } catch {
                // Agents might not load
            } finally {
                if (!cancelled) setLoadingAgents(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [step, apiBase]);

    // Fetch instances when an agent is selected and binding type is instance
    useEffect(() => {
        if (bindingType !== "instance" || !selectedAgentId || step !== "binding") return;
        let cancelled = false;
        setLoadingInstances(true);
        (async () => {
            try {
                const res = await fetch(`${apiBase}/api/instances?agentId=${selectedAgentId}`);
                const data = await res.json();
                if (!cancelled) {
                    setInstances(data.instances || []);
                }
            } catch {
                // Instances might not load
            } finally {
                if (!cancelled) setLoadingInstances(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [bindingType, selectedAgentId, step, apiBase]);

    // Auto-generate slug from instance name
    useEffect(() => {
        if (newInstanceName && createNewInstance) {
            setNewInstanceSlug(
                newInstanceName
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
            );
        }
    }, [newInstanceName, createNewInstance]);

    // -----------------------------------------------------------------------
    // Validate token
    // -----------------------------------------------------------------------

    const handleValidateToken = async () => {
        setValidating(true);
        setTokenError(null);
        try {
            const res = await fetch(
                `${apiBase}/api/channels/telegram/bots/validate`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ botToken: botToken.trim() })
                }
            );
            const data = await res.json();
            if (data.success) {
                setValidatedBot({
                    username: data.bot.username,
                    firstName: data.bot.firstName,
                    id: data.bot.id
                });
                setStep("binding");
            } else {
                setTokenError(
                    data.error ||
                        "Invalid bot token. Make sure you copied it correctly from @BotFather."
                );
            }
        } catch {
            setTokenError("Could not validate token. Check your network connection.");
        } finally {
            setValidating(false);
        }
    };

    // -----------------------------------------------------------------------
    // Create bot
    // -----------------------------------------------------------------------

    const handleCreate = async () => {
        setCreating(true);
        setCreateError(null);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body: any = {
            botToken: botToken.trim()
        };

        if (bindingType === "instance" && createNewInstance) {
            body.bindingType = "instance";
            body.createInstance = {
                agentId: selectedAgentId,
                name: newInstanceName,
                slug: newInstanceSlug,
                instructionOverrides: newInstanceInstructions || undefined
            };
        } else if (bindingType === "instance" && selectedInstanceId) {
            body.bindingType = "instance";
            body.instanceId = selectedInstanceId;
            body.agentSlug = selectedAgentSlug;
        } else {
            body.bindingType = "agent";
            body.agentSlug = selectedAgentSlug;
        }

        try {
            const res = await fetch(`${apiBase}/api/channels/telegram/bots`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.success) {
                setCreatedBot({
                    botUsername: data.bot.botUsername,
                    webhookRegistered: data.bot.webhookRegistered,
                    connectionId: data.bot.connectionId
                });
                setStep("creating");
            } else {
                setCreateError(data.error || "Failed to create bot");
            }
        } catch (e) {
            setCreateError(e instanceof Error ? e.message : "Failed to create bot");
        } finally {
            setCreating(false);
        }
    };

    // -----------------------------------------------------------------------
    // Can proceed?
    // -----------------------------------------------------------------------

    const canCreate =
        (bindingType === "agent" && selectedAgentSlug) ||
        (bindingType === "instance" && selectedInstanceId && !createNewInstance) ||
        (bindingType === "instance" &&
            createNewInstance &&
            newInstanceName &&
            newInstanceSlug &&
            selectedAgentId);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {step === "token" && "Connect a Telegram Bot"}
                        {step === "binding" && `Connect @${validatedBot?.username}`}
                        {step === "creating" && createdBot && "Bot Connected"}
                        {step === "creating" && !createdBot && "Creating..."}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "token" && "Enter the bot token from @BotFather to get started."}
                        {step === "binding" &&
                            "Choose which agent or instance this bot should connect to."}
                        {step === "creating" &&
                            createdBot &&
                            "Your bot is ready to receive messages."}
                        {step === "creating" && !createdBot && "Setting up your bot..."}
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: Token */}
                {step === "token" && (
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Bot Token</Label>
                            <Input
                                type="password"
                                placeholder="7123456789:AAH..."
                                value={botToken}
                                onChange={(e) => setBotToken(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && botToken.trim()) {
                                        handleValidateToken();
                                    }
                                }}
                            />
                            <p className="text-muted-foreground text-xs">
                                Get this from{" "}
                                <a
                                    href="https://t.me/BotFather"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    @BotFather
                                </a>{" "}
                                on Telegram.
                            </p>
                        </div>

                        {tokenError && (
                            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                                <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                {tokenError}
                            </div>
                        )}

                        <Button
                            className="w-full"
                            disabled={!botToken.trim() || validating}
                            onClick={handleValidateToken}
                        >
                            {validating ? (
                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Validate Token
                        </Button>
                    </div>
                )}

                {/* Step 2: Binding */}
                {step === "binding" && validatedBot && (
                    <div className="space-y-4 pt-2">
                        {/* Bot info */}
                        <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
                            <BotIcon className="text-muted-foreground h-8 w-8" />
                            <div>
                                <p className="font-medium">@{validatedBot.username}</p>
                                <p className="text-muted-foreground text-sm">
                                    {validatedBot.firstName} (ID: {validatedBot.id})
                                </p>
                            </div>
                            <CheckCircle2Icon className="ml-auto h-5 w-5 text-green-500" />
                        </div>

                        <Separator />

                        {/* Binding type */}
                        <div className="space-y-2">
                            <Label>Connect to</Label>
                            <Select
                                value={bindingType}
                                onValueChange={(v) => {
                                    if (!v) return;
                                    setBindingType(v as "agent" | "instance");
                                    setSelectedInstanceId("");
                                    setCreateNewInstance(false);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="agent">Agent (direct)</SelectItem>
                                    <SelectItem value="instance">Agent Instance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Agent selector */}
                        <div className="space-y-2">
                            <Label>Agent</Label>
                            {loadingAgents ? (
                                <Skeleton className="h-10 w-full" />
                            ) : (
                                <Select
                                    value={selectedAgentSlug}
                                    onValueChange={(slug) => {
                                        setSelectedAgentSlug(slug ?? "");
                                        const agent = agents.find((a) => a.slug === slug);
                                        setSelectedAgentId(agent?.id || "");
                                        setSelectedInstanceId("");
                                        setCreateNewInstance(false);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an agent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agents.map((a) => (
                                            <SelectItem key={a.slug} value={a.slug}>
                                                {a.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Instance selector (when binding to instance) */}
                        {bindingType === "instance" && selectedAgentId && (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label>Instance</Label>
                                    {loadingInstances ? (
                                        <Skeleton className="h-10 w-full" />
                                    ) : (
                                        <Select
                                            value={
                                                createNewInstance ? "__new__" : selectedInstanceId
                                            }
                                            onValueChange={(v) => {
                                                if (v === "__new__") {
                                                    setCreateNewInstance(true);
                                                    setSelectedInstanceId("");
                                                } else {
                                                    setCreateNewInstance(false);
                                                    setSelectedInstanceId(v ?? "");
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select or create" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {instances.map((inst) => (
                                                    <SelectItem key={inst.id} value={inst.id}>
                                                        {inst.name} ({inst.slug})
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="__new__">
                                                    + Create New Instance
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Inline instance creation */}
                                {createNewInstance && (
                                    <div className="space-y-3 rounded-lg border p-4">
                                        <h4 className="text-sm font-medium">New Instance</h4>
                                        <div className="space-y-2">
                                            <Label>Name</Label>
                                            <Input
                                                placeholder="e.g. John's Golf Caddie"
                                                value={newInstanceName}
                                                onChange={(e) => setNewInstanceName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Slug</Label>
                                            <Input
                                                placeholder="johns-golf-caddie"
                                                value={newInstanceSlug}
                                                onChange={(e) => setNewInstanceSlug(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Instruction Overrides (optional)</Label>
                                            <Input
                                                placeholder="Custom instructions for this instance..."
                                                value={newInstanceInstructions}
                                                onChange={(e) =>
                                                    setNewInstanceInstructions(e.target.value)
                                                }
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {createError && (
                            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                                <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                {createError}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep("token")}>
                                Back
                            </Button>
                            <Button
                                className="flex-1"
                                disabled={!canCreate || creating}
                                onClick={handleCreate}
                            >
                                {creating ? (
                                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Connect Bot
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === "creating" && createdBot && (
                    <div className="space-y-4 pt-2">
                        <div className="flex flex-col items-center gap-3 py-4">
                            <CheckCircle2Icon className="h-12 w-12 text-green-500" />
                            <h3 className="text-lg font-semibold">
                                @{createdBot.botUsername} is live
                            </h3>
                            <div className="flex items-center gap-2">
                                {createdBot.webhookRegistered ? (
                                    <Badge variant="default" className="gap-1">
                                        <WifiIcon className="h-3 w-3" />
                                        Webhook Active
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="gap-1">
                                        <WifiOffIcon className="h-3 w-3" />
                                        Webhook Not Set
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <a
                                href={`https://t.me/${createdBot.botUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1"
                            >
                                <Button variant="outline" className="w-full">
                                    <ExternalLinkIcon className="mr-2 h-4 w-4" />
                                    Open in Telegram
                                </Button>
                            </a>
                            <Button className="flex-1" onClick={onCreated}>
                                Done
                            </Button>
                        </div>
                    </div>
                )}

                {/* Creating spinner (transient state) */}
                {step === "creating" && !createdBot && (
                    <div className="flex flex-col items-center gap-3 py-8">
                        <Loader2Icon className="text-muted-foreground h-8 w-8 animate-spin" />
                        <p className="text-muted-foreground text-sm">
                            Creating bot connection and registering webhook...
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
