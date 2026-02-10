"use client";

import { useMemo, useState } from "react";
import {
    Button,
    Card,
    CardContent,
    Badge,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@repo/ui";
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { ToolInfo } from "@/app/onboarding/page";

interface IntegrationsStepProps {
    onContinue: () => void;
    onBack: () => void;
    availableTools?: ToolInfo[];
}

/** Metadata for known MCP servers */
const MCP_SERVER_META: Record<
    string,
    { label: string; icon: string; description: string; category: string }
> = {
    slack: {
        label: "Slack",
        icon: "\uD83D\uDCAC",
        description: "Send messages, search channels, and manage conversations",
        category: "Communication"
    },
    hubspot: {
        label: "HubSpot",
        icon: "\uD83D\uDCCA",
        description: "Manage contacts, companies, deals, and your CRM pipeline",
        category: "CRM"
    },
    jira: {
        label: "Jira",
        icon: "\uD83D\uDCCB",
        description: "Track issues, manage sprints, and update project boards",
        category: "Project Management"
    },
    github: {
        label: "GitHub",
        icon: "\uD83D\uDC19",
        description: "Manage repos, issues, pull requests, and code reviews",
        category: "Development"
    },
    gdrive: {
        label: "Google Drive",
        icon: "\uD83D\uDCC1",
        description: "Search, read, and organize documents, sheets, and slides",
        category: "Productivity"
    },
    firecrawl: {
        label: "Firecrawl",
        icon: "\uD83C\uDF10",
        description: "Scrape and extract content from any website",
        category: "Web"
    },
    playwright: {
        label: "Playwright",
        icon: "\uD83C\uDFAD",
        description: "Browser automation, screenshots, and page interaction",
        category: "Web"
    },
    justcall: {
        label: "JustCall",
        icon: "\uD83D\uDCDE",
        description: "Call logs, SMS messaging, and phone management",
        category: "Communication"
    },
    fathom: {
        label: "Fathom",
        icon: "\uD83C\uDF99\uFE0F",
        description: "Meeting recordings, transcripts, and summaries",
        category: "Knowledge"
    },
    atlas: {
        label: "ATLAS / n8n",
        icon: "\u2699\uFE0F",
        description: "Workflow automation and triggers via n8n",
        category: "Automation"
    }
};

interface McpServerGroup {
    key: string;
    label: string;
    icon: string;
    description: string;
    category: string;
    connected: boolean;
    tools: ToolInfo[];
}

export function IntegrationsStep({
    onContinue,
    onBack,
    availableTools = []
}: IntegrationsStepProps) {
    const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>({});

    const toggleExpand = (key: string) => {
        setExpandedServers((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // Build server groups from actual tool data
    const serverGroups = useMemo((): McpServerGroup[] => {
        const mcpBuckets = new Map<string, ToolInfo[]>();

        for (const tool of availableTools) {
            if (tool.source?.startsWith("mcp:")) {
                const serverKey = tool.source.slice(4);
                if (!mcpBuckets.has(serverKey)) {
                    mcpBuckets.set(serverKey, []);
                }
                mcpBuckets.get(serverKey)!.push(tool);
            }
        }

        const groups: McpServerGroup[] = [];

        // Add all known servers (connected or not)
        for (const [key, meta] of Object.entries(MCP_SERVER_META)) {
            const tools = mcpBuckets.get(key) || [];
            groups.push({
                key,
                label: meta.label,
                icon: meta.icon,
                description: meta.description,
                category: meta.category,
                connected: tools.length > 0,
                tools
            });
            mcpBuckets.delete(key);
        }

        // Add any unknown MCP servers that returned tools
        for (const [key, tools] of mcpBuckets) {
            groups.push({
                key,
                label: key,
                icon: "\uD83D\uDD0C",
                description: `MCP server: ${key}`,
                category: "Other",
                connected: true,
                tools
            });
        }

        // Sort: connected first, then alphabetically
        groups.sort((a, b) => {
            if (a.connected !== b.connected) return a.connected ? -1 : 1;
            return a.label.localeCompare(b.label);
        });

        return groups;
    }, [availableTools]);

    const connectedCount = serverGroups.filter((g) => g.connected).length;

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
                    <ArrowLeftIcon className="mr-1 size-4" />
                    Back
                </Button>
                <h2 className="text-2xl font-bold">Supercharge with integrations</h2>
                <p className="text-muted-foreground text-sm">
                    Your agents can connect to the tools you already use via MCP (Model Context
                    Protocol).{" "}
                    {connectedCount > 0
                        ? `${connectedCount} integration${connectedCount !== 1 ? "s" : ""} connected with tools available.`
                        : "Connect integrations from the Integrations page after setup."}
                </p>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="grid gap-3">
                        {serverGroups.map((server) => (
                            <Collapsible
                                key={server.key}
                                open={expandedServers[server.key] ?? false}
                                onOpenChange={() => toggleExpand(server.key)}
                            >
                                <div className="rounded-lg border">
                                    <CollapsibleTrigger className="flex w-full items-center gap-3 p-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-800">
                                            {server.icon}
                                        </div>
                                        <div className="min-w-0 flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium">
                                                    {server.label}
                                                </p>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] font-normal"
                                                >
                                                    {server.category}
                                                </Badge>
                                            </div>
                                            <p className="text-muted-foreground text-xs">
                                                {server.description}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {server.connected ? (
                                                <Badge
                                                    variant="secondary"
                                                    className="bg-green-100 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                >
                                                    {server.tools.length} tool
                                                    {server.tools.length !== 1 ? "s" : ""}
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="text-muted-foreground text-[10px]"
                                                >
                                                    Not connected
                                                </Badge>
                                            )}
                                            {server.connected && server.tools.length > 0 && (
                                                <>
                                                    {expandedServers[server.key] ? (
                                                        <ChevronDownIcon className="text-muted-foreground size-4" />
                                                    ) : (
                                                        <ChevronRightIcon className="text-muted-foreground size-4" />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </CollapsibleTrigger>
                                    {server.connected && server.tools.length > 0 && (
                                        <CollapsibleContent>
                                            <div className="border-t px-3 pt-2 pb-3">
                                                <div className="grid gap-1">
                                                    {server.tools.map((tool) => (
                                                        <div
                                                            key={tool.id}
                                                            className="rounded px-2 py-1.5"
                                                        >
                                                            <p className="text-xs font-medium">
                                                                {tool.name}
                                                            </p>
                                                            <p className="text-muted-foreground line-clamp-1 text-[11px]">
                                                                {tool.description}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </CollapsibleContent>
                                    )}
                                </div>
                            </Collapsible>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <p className="text-muted-foreground text-center text-xs">
                You can connect integrations after setup from{" "}
                <span className="font-medium">Integrations</span> in the navigation bar.
            </p>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack}>
                    Back
                </Button>
                <Button onClick={onContinue}>Continue</Button>
            </div>
        </div>
    );
}
