"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Badge, Card, CardContent, Skeleton } from "@repo/ui";

interface SkillUsageData {
    agents: Array<{
        agentId: string;
        pinned: boolean;
        agent: { id: string; slug: string; name: string; type?: string };
    }>;
}

export default function SkillUsagePage() {
    const params = useParams();
    const skillSlug = params.skillSlug as string;
    const [data, setData] = useState<SkillUsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/skills/${skillSlug}`);
                if (res.ok) {
                    const json = await res.json();
                    const s = json.skill || json;
                    setData({ agents: s.agents || [] });
                }
            } catch (err) {
                console.error("Failed to load:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [skillSlug]);

    if (loading) return <Skeleton className="h-64 w-full" />;
    if (!data) return <p className="text-muted-foreground">Skill not found.</p>;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Agent Usage ({data.agents.length})</h2>

            {data.agents.length > 0 ? (
                <Card>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {data.agents.map((a) => (
                                <div
                                    key={a.agentId}
                                    className="flex items-center justify-between px-4 py-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/agents/${a.agent.slug}/configure`}
                                            className="text-primary text-sm font-medium hover:underline"
                                        >
                                            {a.agent.name}
                                        </Link>
                                        <span className="text-muted-foreground font-mono text-xs">
                                            {a.agent.slug}
                                        </span>
                                    </div>
                                    <Badge
                                        variant={a.pinned ? "default" : "secondary"}
                                        className="text-[10px]"
                                    >
                                        {a.pinned ? "Pinned" : "Discoverable"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground text-sm italic">
                            This skill is not attached to any agents yet.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
