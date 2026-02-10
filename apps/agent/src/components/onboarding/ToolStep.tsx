"use client";

import { useMemo, useState } from "react";
import {
    Button,
    Card,
    CardContent,
    Input,
    Badge,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@repo/ui";
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import type { OnboardingData, ToolInfo } from "@/app/onboarding/page";

interface ToolStepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    availableTools: ToolInfo[];
    onContinue: () => void;
    onBack: () => void;
    isCreating: boolean;
    createError: string | null;
    mcpWarning?: string | null;
}

/** Human-friendly names for known MCP server prefixes */
const MCP_SERVER_LABELS: Record<string, { label: string; icon: string }> = {
    hubspot: { label: "HubSpot", icon: "\uD83D\uDCCA" },
    jira: { label: "Jira", icon: "\uD83D\uDCCB" },
    slack: { label: "Slack", icon: "\uD83D\uDCAC" },
    github: { label: "GitHub", icon: "\uD83D\uDC19" },
    gdrive: { label: "Google Drive", icon: "\uD83D\uDCC1" },
    firecrawl: { label: "Firecrawl", icon: "\uD83C\uDF10" },
    playwright: { label: "Playwright", icon: "\uD83C\uDFAD" },
    justcall: { label: "JustCall", icon: "\uD83D\uDCDE" },
    fathom: { label: "Fathom", icon: "\uD83C\uDF99\uFE0F" },
    atlas: { label: "ATLAS / n8n", icon: "\u2699\uFE0F" }
};

interface ToolGroup {
    key: string;
    label: string;
    icon: string;
    badge: string | null;
    tools: ToolInfo[];
    defaultCollapsed: boolean;
}

export function ToolStep({
    data,
    updateData,
    availableTools,
    onContinue,
    onBack,
    isCreating,
    createError,
    mcpWarning
}: ToolStepProps) {
    const [search, setSearch] = useState("");
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const toggleTool = (toolId: string) => {
        const current = data.selectedTools;
        if (current.includes(toolId)) {
            updateData({ selectedTools: current.filter((t) => t !== toolId) });
        } else {
            updateData({ selectedTools: [...current, toolId] });
        }
    };

    const toggleGroupCollapse = (key: string) => {
        setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // Group tools: System (registry) tools, then each MCP server as its own group
    const groups = useMemo((): ToolGroup[] => {
        const systemTools: ToolInfo[] = [];
        const mcpBuckets = new Map<string, ToolInfo[]>();

        for (const tool of availableTools) {
            if (!tool.source || tool.source === "registry" || tool.source === "builtin") {
                systemTools.push(tool);
            } else if (tool.source.startsWith("mcp:")) {
                const serverKey = tool.source.slice(4); // strip "mcp:"
                if (!mcpBuckets.has(serverKey)) {
                    mcpBuckets.set(serverKey, []);
                }
                mcpBuckets.get(serverKey)!.push(tool);
            } else {
                // Unknown source -- treat as system
                systemTools.push(tool);
            }
        }

        const result: ToolGroup[] = [];

        if (systemTools.length > 0) {
            result.push({
                key: "system",
                label: "System Tools",
                icon: "\uD83D\uDD27",
                badge: null,
                tools: systemTools,
                defaultCollapsed: false
            });
        }

        // Sort MCP servers alphabetically
        const sortedServers = [...mcpBuckets.entries()].sort(([a], [b]) => a.localeCompare(b));

        for (const [serverKey, tools] of sortedServers) {
            const info = MCP_SERVER_LABELS[serverKey];
            result.push({
                key: serverKey,
                label: info?.label || serverKey,
                icon: info?.icon || "\uD83D\uDD0C",
                badge: "MCP",
                tools,
                defaultCollapsed: true
            });
        }

        return result;
    }, [availableTools]);

    // Filter by search
    const filterTools = (tools: ToolInfo[]) => {
        if (!search.trim()) return tools;
        const q = search.toLowerCase();
        return tools.filter(
            (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
        );
    };

    // Count how many tools are selected in a group
    const selectedInGroup = (tools: ToolInfo[]) =>
        tools.filter((t) => data.selectedTools.includes(t.id)).length;

    const hasAnyResults = groups.some((g) => filterTools(g.tools).length > 0);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
                    <ArrowLeftIcon className="mr-1 size-4" />
                    Back
                </Button>
                <h2 className="text-2xl font-bold">Add tools to your agent</h2>
                <p className="text-muted-foreground text-sm">
                    Tools let your agent take real actions. System tools are built-in; MCP tools
                    come from your connected integrations.
                </p>
            </div>

            {/* Search */}
            {availableTools.length > 8 && (
                <div className="relative">
                    <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        placeholder="Search tools..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            )}

            {/* MCP warning */}
            {mcpWarning && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {mcpWarning}
                </div>
            )}

            {/* Tool groups */}
            <div className="space-y-3">
                {!hasAnyResults && search.trim() && (
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-muted-foreground py-4 text-center text-sm">
                                No tools match &quot;{search}&quot;
                            </p>
                        </CardContent>
                    </Card>
                )}

                {groups.map((group) => {
                    const filtered = filterTools(group.tools);
                    if (filtered.length === 0) return null;

                    const selected = selectedInGroup(group.tools);
                    const isCollapsed = collapsedGroups[group.key] ?? group.defaultCollapsed;

                    return (
                        <Card key={group.key}>
                            <Collapsible
                                open={!isCollapsed}
                                onOpenChange={() => toggleGroupCollapse(group.key)}
                            >
                                <CollapsibleTrigger className="flex w-full items-center gap-2 p-4">
                                    <span className="text-base">{group.icon}</span>
                                    <span className="text-sm font-medium">{group.label}</span>
                                    {group.badge && (
                                        <Badge variant="outline" className="text-[10px]">
                                            {group.badge}
                                        </Badge>
                                    )}
                                    <span className="text-muted-foreground ml-auto text-xs">
                                        {selected > 0 && (
                                            <span className="text-primary mr-2 font-medium">
                                                {selected} selected
                                            </span>
                                        )}
                                        {filtered.length} tool
                                        {filtered.length !== 1 ? "s" : ""}
                                    </span>
                                    {isCollapsed ? (
                                        <ChevronRightIcon className="text-muted-foreground size-4" />
                                    ) : (
                                        <ChevronDownIcon className="text-muted-foreground size-4" />
                                    )}
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <CardContent className="space-y-0.5 border-t px-4 pt-2 pb-3">
                                        {filtered.map((tool) => (
                                            <label
                                                key={tool.id}
                                                className="hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg p-2.5 transition-colors"
                                            >
                                                <input
                                                    id={tool.id}
                                                    type="checkbox"
                                                    checked={data.selectedTools.includes(tool.id)}
                                                    onChange={() => toggleTool(tool.id)}
                                                    className="mt-0.5 shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-sm font-medium">
                                                        {tool.name}
                                                    </span>
                                                    <p className="text-muted-foreground line-clamp-2 text-xs">
                                                        {tool.description}
                                                    </p>
                                                </div>
                                            </label>
                                        ))}
                                    </CardContent>
                                </CollapsibleContent>
                            </Collapsible>
                        </Card>
                    );
                })}
            </div>

            {data.selectedTools.length > 0 && (
                <p className="text-muted-foreground text-center text-xs">
                    {data.selectedTools.length} tool{data.selectedTools.length !== 1 ? "s" : ""}{" "}
                    selected. You can add or remove tools later from agent settings.
                </p>
            )}

            {/* Error message */}
            {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                    {createError}
                </div>
            )}

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack}>
                    Back
                </Button>
                <Button onClick={onContinue} disabled={isCreating}>
                    {isCreating ? "Creating Agent..." : "Create & Test Agent"}
                </Button>
            </div>
        </div>
    );
}
