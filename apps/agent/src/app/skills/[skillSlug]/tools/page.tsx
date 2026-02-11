"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Skeleton
} from "@repo/ui";

interface ToolInfo {
    id: string;
    name: string;
    description: string;
    source: string;
}

interface ToolGroup {
    source: string;
    displayName: string;
    tools: ToolInfo[];
}

export default function SkillToolsPage() {
    const params = useParams();
    const skillSlug = params.skillSlug as string;

    const [skillId, setSkillId] = useState("");
    const [attachedToolIds, setAttachedToolIds] = useState<Set<string>>(new Set());
    const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [toolsLoading, setToolsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [mcpError, setMcpError] = useState<string | null>(null);
    const [hasOrgContext, setHasOrgContext] = useState(false);

    // Fetch skill data (attached tools)
    const fetchSkill = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skillSlug}`);
            if (res.ok) {
                const data = await res.json();
                const s = data.skill || data;
                setSkillId(s.id);
                setAttachedToolIds(
                    new Set((s.tools || []).map((t: { toolId: string }) => t.toolId))
                );
            }
        } catch (err) {
            console.error("Failed to load skill:", err);
        } finally {
            setLoading(false);
        }
    }, [skillSlug]);

    // Fetch all available tools (registry + MCP). credentials: 'include' so session
    // is sent and org-scoped MCP connections are used (same as Integrations page).
    const fetchTools = useCallback(async () => {
        setToolsLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/agents/tools`, {
                credentials: "include"
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableTools(data.tools || []);
                setMcpError(data.mcpError ?? null);
                setHasOrgContext(data.hasOrgContext ?? false);
            }
        } catch (err) {
            console.error("Failed to load available tools:", err);
        } finally {
            setToolsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSkill();
        fetchTools();
    }, [fetchSkill, fetchTools]);

    // Group tools by source
    const groupToolsBySource = (tools: ToolInfo[]): ToolGroup[] => {
        const groups: Record<string, ToolInfo[]> = {};
        tools.forEach((tool) => {
            const source = tool.source || "registry";
            if (!groups[source]) groups[source] = [];
            groups[source]!.push(tool);
        });
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            if (a === "registry") return -1;
            if (b === "registry") return 1;
            return a.localeCompare(b);
        });
        return sortedKeys.map((key) => ({
            source: key,
            displayName: key === "registry" ? "Built-in Tools" : key.replace("mcp:", ""),
            tools: groups[key]!
        }));
    };

    // Toggle a single tool
    const toggleTool = async (toolId: string) => {
        if (!skillId || actionLoading) return;
        setActionLoading(toolId);

        const isAttached = attachedToolIds.has(toolId);

        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skillId}/tools`, {
                method: isAttached ? "DELETE" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toolId })
            });
            if (res.ok) {
                setAttachedToolIds((prev) => {
                    const next = new Set(prev);
                    if (isAttached) {
                        next.delete(toolId);
                    } else {
                        next.add(toolId);
                    }
                    return next;
                });
            }
        } catch (err) {
            console.error("Failed to toggle tool:", err);
        } finally {
            setActionLoading(null);
        }
    };

    // Select all tools in a source group
    const selectAllForSource = async (source: string) => {
        if (!skillId || actionLoading) return;
        const sourceTools = availableTools.filter((t) => t.source === source);
        const unattached = sourceTools.filter((t) => !attachedToolIds.has(t.id));
        if (unattached.length === 0) return;

        setActionLoading("bulk");
        try {
            for (const tool of unattached) {
                await fetch(`${getApiBase()}/api/skills/${skillId}/tools`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ toolId: tool.id })
                });
            }
            // Refresh from server
            await fetchSkill();
        } catch (err) {
            console.error("Failed to select all:", err);
        } finally {
            setActionLoading(null);
        }
    };

    // Deselect all tools in a source group
    const deselectAllForSource = async (source: string) => {
        if (!skillId || actionLoading) return;
        const sourceTools = availableTools.filter((t) => t.source === source);
        const attached = sourceTools.filter((t) => attachedToolIds.has(t.id));
        if (attached.length === 0) return;

        setActionLoading("bulk");
        try {
            for (const tool of attached) {
                await fetch(`${getApiBase()}/api/skills/${skillId}/tools`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ toolId: tool.id })
                });
            }
            await fetchSkill();
        } catch (err) {
            console.error("Failed to deselect all:", err);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading || toolsLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    const groups = groupToolsBySource(availableTools);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Tools</CardTitle>
                        <CardDescription>
                            {attachedToolIds.size} of {availableTools.length} tools selected
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="max-h-[600px] space-y-6 overflow-auto">
                    {groups.map((group) => {
                        const selectedCount = group.tools.filter((t) =>
                            attachedToolIds.has(t.id)
                        ).length;
                        const allSelected =
                            group.tools.length > 0 &&
                            group.tools.every((t) => attachedToolIds.has(t.id));

                        return (
                            <div key={group.source} className="space-y-3">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-medium">{group.displayName}</h4>
                                        <Badge variant="outline" className="text-xs">
                                            {selectedCount}/{group.tools.length}
                                        </Badge>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={!!actionLoading}
                                        onClick={() =>
                                            allSelected
                                                ? deselectAllForSource(group.source)
                                                : selectAllForSource(group.source)
                                        }
                                    >
                                        {allSelected ? "Deselect All" : "Select All"}
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {group.tools.map((tool) => {
                                        const isChecked = attachedToolIds.has(tool.id);
                                        const isToggling = actionLoading === tool.id;
                                        return (
                                            <label
                                                key={tool.id}
                                                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                                    isChecked
                                                        ? "border-primary bg-primary/5"
                                                        : "hover:bg-muted/50"
                                                } ${isToggling ? "opacity-50" : ""}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleTool(tool.id)}
                                                    disabled={!!actionLoading}
                                                    className="mt-0.5"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium">
                                                        {tool.name}
                                                    </p>
                                                    {tool.description && (
                                                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                                            {tool.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    {mcpError && (
                        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                            <p className="font-medium">MCP tools unavailable</p>
                            <p className="mt-0.5">{mcpError}</p>
                            <p className="mt-1 text-xs opacity-90">
                                Check Integrations (MCP) and test connections; ensure you are signed in so org-scoped connections are used.
                            </p>
                        </div>
                    )}
                    {hasOrgContext && availableTools.length > 0 && availableTools.every((t) => t.source === "registry") && (
                        <div className="text-muted-foreground rounded-md border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm">
                            <p>Only built-in tools are shown. To see MCP tools here, add and connect MCP servers under <strong>Integrations</strong> (same organization).</p>
                        </div>
                    )}
                    {availableTools.length === 0 && (
                        <div className="text-muted-foreground py-8 text-center">
                            <p>No tools available</p>
                            <p className="mt-1 text-sm">
                                Check MCP server connections in Integrations
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
