"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge, Button, Skeleton, cn } from "@repo/ui";

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

const navItems = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "configure", label: "Configure", icon: "⚙️" },
    { id: "test", label: "Test", icon: "🧪" },
    { id: "runs", label: "Runs", icon: "📋" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "traces", label: "Traces", icon: "🔍" },
    { id: "evaluations", label: "Evaluations", icon: "✅" },
    { id: "costs", label: "Costs", icon: "💰" },
    { id: "versions", label: "Versions", icon: "📚" },
    { id: "guardrails", label: "Guardrails", icon: "🛡️" }
];

export default function AgentWorkspaceLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const agentSlug = params.agentSlug as string;

    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);

    // Determine active tab from pathname
    const activeTab = pathname.split("/").pop() || "overview";

    useEffect(() => {
        async function fetchAgent() {
            try {
                const res = await fetch(`/api/agents/${agentSlug}`);
                const data = await res.json();
                if (data.success && data.agent) {
                    setAgent(data.agent);
                }
            } catch (error) {
                console.error("Failed to fetch agent:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchAgent();
    }, [agentSlug]);

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
                    <Button onClick={() => router.push("/demos/agents/manage")}>
                        Back to Agents
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="bg-muted/30 flex w-64 flex-col border-r">
                {/* Agent Header */}
                <div className="border-b p-4">
                    <div className="mb-2 flex items-start justify-between">
                        <h1 className="truncate text-lg font-bold">{agent.name}</h1>
                        <Badge
                            variant={agent.isActive ? "default" : "secondary"}
                            className="ml-2 shrink-0"
                        >
                            {agent.isActive ? "Active" : "Inactive"}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground truncate font-mono text-xs">
                        {agent.modelProvider}/{agent.modelName}
                    </p>
                    {agent.type === "SYSTEM" && (
                        <Badge variant="outline" className="mt-2 text-xs">
                            SYSTEM
                        </Badge>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-2">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        const href = `/workspace/${agentSlug}/${item.id}`;

                        return (
                            <Link
                                key={item.id}
                                href={href}
                                className={cn(
                                    "mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="border-t p-4">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => router.push("/demos/agents/manage")}
                    >
                        ← Back to Agents
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
