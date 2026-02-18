"use client";

import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Badge,
    Button,
    Input,
    Skeleton
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface PublicAgent {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    orgName: string;
    orgSlug: string;
    skills: string[];
}

export default function MarketplacePage() {
    const [agents, setAgents] = useState<PublicAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch(`${getApiBase()}/api/federation/marketplace`)
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setAgents(data.agents);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = agents.filter((a) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            a.name.toLowerCase().includes(q) ||
            a.orgName.toLowerCase().includes(q) ||
            (a.description || "").toLowerCase().includes(q)
        );
    });

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-semibold">Agent Marketplace</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Discover agents from other organizations and connect to start collaborating.
                </p>
            </div>

            <Input
                placeholder="Search agents or organizations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md"
            />

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-44" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <p className="text-lg font-medium">No agents found</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {search
                                ? "Try a different search term."
                                : "No organizations have published agents to the marketplace yet."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((agent) => (
                        <Card key={agent.id} className="flex flex-col">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base">{agent.name}</CardTitle>
                                        <CardDescription className="text-xs">
                                            by {agent.orgName}
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                        {agent.orgSlug}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-1 flex-col justify-between space-y-3 pt-0">
                                {agent.description && (
                                    <p className="text-muted-foreground line-clamp-3 text-sm">
                                        {agent.description}
                                    </p>
                                )}
                                {agent.skills.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {agent.skills.slice(0, 5).map((skill) => (
                                            <Badge
                                                key={skill}
                                                variant="outline"
                                                className="text-[10px]"
                                            >
                                                {skill}
                                            </Badge>
                                        ))}
                                        {agent.skills.length > 5 && (
                                            <Badge variant="outline" className="text-[10px]">
                                                +{agent.skills.length - 5}
                                            </Badge>
                                        )}
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-auto self-start"
                                    onClick={() => {
                                        window.location.href = `/settings/connections?connect=${agent.orgSlug}`;
                                    }}
                                >
                                    Connect
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
