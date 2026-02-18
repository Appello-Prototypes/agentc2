"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    Button,
    Input,
    Label,
    Switch,
    Badge,
    Skeleton,
    Alert,
    AlertDescription
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface OrgResult {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    createdAt: string;
}

interface AgentOption {
    id: string;
    slug: string;
    name: string;
    description: string | null;
}

interface ConnectionRequestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

type Step = "search" | "agents" | "confirm";

export function ConnectionRequestDialog({
    open,
    onOpenChange,
    onSuccess
}: ConnectionRequestDialogProps) {
    const [step, setStep] = useState<Step>("search");
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState<OrgResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<OrgResult | null>(null);
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
    const [loadingAgents, setLoadingAgents] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetState = useCallback(() => {
        setStep("search");
        setQuery("");
        setSearchResults([]);
        setSelectedOrg(null);
        setAgents([]);
        setSelectedAgentIds([]);
        setError(null);
    }, []);

    useEffect(() => {
        if (!open) resetState();
    }, [open, resetState]);

    useEffect(() => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        const timeout = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(
                    `${getApiBase()}/api/organizations/search?q=${encodeURIComponent(query)}`
                );
                const data = await res.json();
                if (data.success) setSearchResults(data.organizations);
            } catch {
                /* ignore */
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [query]);

    const selectOrg = async (org: OrgResult) => {
        setSelectedOrg(org);
        setStep("agents");
        setLoadingAgents(true);
        try {
            const res = await fetch(`${getApiBase()}/api/agents`);
            const data = await res.json();
            if (data.success) {
                setAgents(
                    (data.agents || []).map(
                        (a: {
                            id: string;
                            slug: string;
                            name: string;
                            description: string | null;
                        }) => ({
                            id: a.id,
                            slug: a.slug,
                            name: a.name,
                            description: a.description
                        })
                    )
                );
            }
        } catch {
            /* ignore */
        } finally {
            setLoadingAgents(false);
        }
    };

    const toggleAgent = (agentId: string) => {
        setSelectedAgentIds((prev) =>
            prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
        );
    };

    const handleSubmit = async () => {
        if (!selectedOrg) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`${getApiBase()}/api/federation/connections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetOrgSlug: selectedOrg.slug,
                    exposedAgentIds: selectedAgentIds
                })
            });
            const data = await res.json();
            if (data.success) {
                onSuccess();
            } else {
                setError(data.error || "Failed to send connection request");
            }
        } catch {
            setError("Failed to send connection request");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {step === "search" && "Connect an Organization"}
                        {step === "agents" && "Select Agents to Share"}
                        {step === "confirm" && "Confirm Connection"}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "search" &&
                            "Search for the organization you want to connect with."}
                        {step === "agents" &&
                            `Choose which of your agents ${selectedOrg?.name} can access.`}
                        {step === "confirm" && "Review and send your connection request."}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Step 1: Search */}
                {step === "search" && (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="org-search">Organization name or slug</Label>
                            <Input
                                id="org-search"
                                placeholder="Search..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="mt-1.5"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-64 space-y-2 overflow-y-auto">
                            {searching && (
                                <div className="space-y-2">
                                    <Skeleton className="h-14" />
                                    <Skeleton className="h-14" />
                                </div>
                            )}
                            {!searching && searchResults.length === 0 && query.length >= 2 && (
                                <p className="text-muted-foreground py-4 text-center text-sm">
                                    No organizations found
                                </p>
                            )}
                            {searchResults.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => selectOrg(org)}
                                    className="hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                                >
                                    <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                                        {org.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{org.name}</p>
                                        <p className="text-muted-foreground truncate text-xs">
                                            {org.slug}
                                            {org.description && ` — ${org.description}`}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Agent Selection */}
                {step === "agents" && (
                    <div className="space-y-4">
                        {loadingAgents ? (
                            <div className="space-y-2">
                                <Skeleton className="h-12" />
                                <Skeleton className="h-12" />
                                <Skeleton className="h-12" />
                            </div>
                        ) : agents.length === 0 ? (
                            <p className="text-muted-foreground py-4 text-center text-sm">
                                No agents available to share.
                            </p>
                        ) : (
                            <div className="max-h-72 space-y-2 overflow-y-auto">
                                {agents.map((agent) => (
                                    <label
                                        key={agent.id}
                                        className="hover:bg-accent/50 flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium">{agent.name}</p>
                                            {agent.description && (
                                                <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                                                    {agent.description}
                                                </p>
                                            )}
                                        </div>
                                        <Switch
                                            checked={selectedAgentIds.includes(agent.id)}
                                            onCheckedChange={() => toggleAgent(agent.id)}
                                        />
                                    </label>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between">
                            <Button variant="outline" size="sm" onClick={() => setStep("search")}>
                                Back
                            </Button>
                            <Button size="sm" onClick={() => setStep("confirm")}>
                                Continue
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirm */}
                {step === "confirm" && selectedOrg && (
                    <div className="space-y-4">
                        <div className="rounded-lg border p-4">
                            <p className="text-sm">
                                <span className="font-medium">Connect with:</span>{" "}
                                {selectedOrg.name}
                            </p>
                            <p className="text-sm">
                                <span className="font-medium">Sharing:</span>{" "}
                                {selectedAgentIds.length} agent
                                {selectedAgentIds.length !== 1 ? "s" : ""}
                            </p>
                            {selectedAgentIds.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {agents
                                        .filter((a) => selectedAgentIds.includes(a.id))
                                        .map((a) => (
                                            <Badge key={a.id} variant="secondary">
                                                {a.name}
                                            </Badge>
                                        ))}
                                </div>
                            )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            The other organization will need to accept your request and choose which
                            agents to share back with you.
                        </p>
                        <div className="flex justify-between">
                            <Button variant="outline" size="sm" onClick={() => setStep("agents")}>
                                Back
                            </Button>
                            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                                {submitting ? "Sending..." : "Send Request"}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
