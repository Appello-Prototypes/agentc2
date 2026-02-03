"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Badge,
    Button,
    Skeleton,
    cn,
    icons,
    HugeiconsIcon,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@repo/ui";
import type { IconName } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Agent {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    modelProvider: string;
    modelName: string;
    isActive: boolean;
    type: "SYSTEM" | "USER";
}

interface AgentListItem {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    type: "SYSTEM" | "USER";
}

/** Format model name for display */
function formatModelName(modelName: string): string {
    const withoutDate = modelName.replace(/-\d{8}$/, "");
    return withoutDate
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// Production-focused navigation (no configure/test/versions)
const navItems: { id: string; label: string; icon: IconName }[] = [
    { id: "overview", label: "Overview", icon: "dashboard" },
    { id: "runs", label: "Runs", icon: "play-circle" },
    { id: "analytics", label: "Analytics", icon: "analytics" },
    { id: "traces", label: "Traces", icon: "activity" },
    { id: "evaluations", label: "Evaluations", icon: "chart-evaluation" },
    { id: "learning", label: "Learning", icon: "ai-network" },
    { id: "costs", label: "Costs", icon: "dollar" },
    { id: "guardrails", label: "Guardrails", icon: "shield" }
];

export default function LiveAgentLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const agentSlug = params.agentSlug as string;

    const [agent, setAgent] = useState<Agent | null>(null);
    const [allAgents, setAllAgents] = useState<AgentListItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Determine active tab from pathname
    const activeTab = pathname.split("/").pop() || "overview";

    useEffect(() => {
        async function fetchData() {
            try {
                const [agentRes, allAgentsRes] = await Promise.all([
                    fetch(`${getApiBase()}/api/agents/${agentSlug}`),
                    fetch(`${getApiBase()}/api/agents`)
                ]);

                const agentData = await agentRes.json();
                if (agentData.success && agentData.agent) {
                    setAgent(agentData.agent);
                }

                const allAgentsData = await allAgentsRes.json();
                if (allAgentsData.success && allAgentsData.agents) {
                    setAllAgents(allAgentsData.agents);
                }
            } catch (error) {
                console.error("Failed to fetch agent data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [agentSlug]);

    const handleAgentSwitch = (newSlug: string | null) => {
        if (newSlug && newSlug !== agentSlug) {
            router.push(`/live/${newSlug}/${activeTab}`);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen">
                <div className="w-64 border-r p-4">
                    <Skeleton className="mb-4 h-8 w-full" />
                    <Skeleton className="mb-8 h-6 w-3/4" />
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="mb-2 h-10 w-full" />
                    ))}
                </div>
                <div className="flex-1 p-6">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    if (!agent) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <h1 className="mb-2 text-2xl font-bold">Agent Not Found</h1>
                    <p className="text-muted-foreground mb-4">
                        The agent &ldquo;{agentSlug}&rdquo; could not be found.
                    </p>
                    <Button onClick={() => router.push("/live")}>Back to Live Dashboard</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="bg-muted/30 flex w-64 flex-col border-r">
                {/* Live Badge */}
                <div className="flex items-center gap-2 border-b px-3 py-2">
                    <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    >
                        LIVE
                    </Badge>
                    <span className="text-muted-foreground text-xs">Production Monitoring</span>
                </div>

                {/* Agent Header with Switcher */}
                <div className="border-b p-3">
                    <Select value={agentSlug} onValueChange={handleAgentSwitch}>
                        <SelectTrigger className="mb-2 w-full">
                            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                                <span
                                    className={cn(
                                        "size-2 shrink-0 rounded-full",
                                        agent.isActive ? "bg-green-500" : "bg-muted-foreground"
                                    )}
                                    title={agent.isActive ? "Active" : "Inactive"}
                                />
                                <SelectValue placeholder="Select agent">
                                    <span className="block truncate font-medium">{agent.name}</span>
                                </SelectValue>
                            </div>
                        </SelectTrigger>
                        <SelectContent className="w-auto max-w-80 min-w-(--radix-select-trigger-width)">
                            {allAgents.map((a) => (
                                <SelectItem key={a.slug} value={a.slug}>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={cn(
                                                "size-2 shrink-0 rounded-full",
                                                a.isActive ? "bg-green-500" : "bg-muted-foreground"
                                            )}
                                        />
                                        <span className="whitespace-nowrap">{a.name}</span>
                                        {a.type === "SYSTEM" && (
                                            <Badge
                                                variant="outline"
                                                className="text-muted-foreground h-4 shrink-0 px-1 text-[9px] font-normal"
                                            >
                                                System
                                            </Badge>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Model Info */}
                    <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
                        <span className="capitalize">{agent.modelProvider}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="truncate" title={agent.modelName}>
                            {formatModelName(agent.modelName)}
                        </span>
                    </div>

                    {agent.type === "SYSTEM" && (
                        <Badge
                            variant="outline"
                            className="text-muted-foreground h-5 px-1.5 text-[10px] font-normal"
                        >
                            System Agent
                        </Badge>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-2 py-1">
                    <ul className="flex flex-col gap-0.5">
                        {navItems.map((item) => {
                            const isActive = activeTab === item.id;
                            const href = `/live/${agentSlug}/${item.id}`;

                            return (
                                <li key={item.id}>
                                    <Link
                                        href={href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                            isActive
                                                ? "bg-accent text-accent-foreground font-medium"
                                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                        )}
                                    >
                                        <HugeiconsIcon
                                            icon={icons[item.icon]!}
                                            className="size-4 shrink-0"
                                            strokeWidth={1.5}
                                        />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="space-y-2 border-t p-4">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => router.push(`/workspace/${agentSlug}/overview`)}
                    >
                        Open in Workspace
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => router.push("/live")}
                    >
                        ← Back to Live
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-6">{children}</div>
            </main>
        </div>
    );
}
