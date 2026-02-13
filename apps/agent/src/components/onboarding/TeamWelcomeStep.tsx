"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, Badge } from "@repo/ui";
import { BotIcon, PlugIcon, UsersIcon, Loader2Icon } from "lucide-react";
import { getApiBase } from "@/lib/utils";

interface TeamInfo {
    orgName: string;
    memberCount: number;
    agentCount: number;
    integrationCount: number;
    agents: Array<{ name: string; slug: string; description?: string }>;
}

interface TeamWelcomeStepProps {
    orgName: string;
    orgId: string;
    onContinue: () => void;
}

export function TeamWelcomeStep({ orgName, orgId, onContinue }: TeamWelcomeStepProps) {
    const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeamInfo = async () => {
            try {
                // Fetch agents for this workspace
                const agentsRes = await fetch(`${getApiBase()}/api/agents`, {
                    credentials: "include"
                });
                const agentsData = await agentsRes.json();
                const agents =
                    agentsData.success && Array.isArray(agentsData.agents) ? agentsData.agents : [];

                setTeamInfo({
                    orgName,
                    memberCount: 0, // Will be populated if needed
                    agentCount: agents.length,
                    integrationCount: 0,
                    agents: agents
                        .slice(0, 5)
                        .map((a: { name: string; slug: string; description?: string }) => ({
                            name: a.name,
                            slug: a.slug,
                            description: a.description
                        }))
                });
            } catch (error) {
                console.error("[TeamWelcomeStep] Failed to fetch team info:", error);
                setTeamInfo({
                    orgName,
                    memberCount: 0,
                    agentCount: 0,
                    integrationCount: 0,
                    agents: []
                });
            } finally {
                setLoading(false);
            }
        };

        fetchTeamInfo();
    }, [orgName, orgId]);

    if (loading) {
        return (
            <div className="flex min-h-[300px] items-center justify-center">
                <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold tracking-tight">
                    Welcome to {teamInfo?.orgName || orgName}
                </h2>
                <p className="text-muted-foreground mx-auto max-w-lg text-sm">
                    Your team already has agents set up and ready to use. Here&apos;s what&apos;s
                    available.
                </p>
            </div>

            {/* Team stats */}
            <div className="mx-auto grid max-w-md grid-cols-1 gap-3 sm:grid-cols-3">
                <Card>
                    <CardContent className="p-4 text-center">
                        <BotIcon className="text-primary mx-auto mb-1 size-5" />
                        <p className="text-lg font-bold">{teamInfo?.agentCount || 0}</p>
                        <p className="text-muted-foreground text-xs">Agents</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <PlugIcon className="text-primary mx-auto mb-1 size-5" />
                        <p className="text-lg font-bold">{teamInfo?.integrationCount || 0}</p>
                        <p className="text-muted-foreground text-xs">Integrations</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <UsersIcon className="text-primary mx-auto mb-1 size-5" />
                        <p className="text-lg font-bold">{teamInfo?.memberCount || 1}</p>
                        <p className="text-muted-foreground text-xs">Members</p>
                    </CardContent>
                </Card>
            </div>

            {/* Agent list */}
            {teamInfo && teamInfo.agents.length > 0 && (
                <div className="mx-auto max-w-md">
                    <h3 className="mb-2 text-sm font-medium">Available Agents</h3>
                    <div className="space-y-2">
                        {teamInfo.agents.map((agent) => (
                            <Card key={agent.slug}>
                                <CardContent className="flex items-center gap-3 p-3">
                                    <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                                        <BotIcon className="text-primary size-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">{agent.name}</p>
                                        {agent.description && (
                                            <p className="text-muted-foreground line-clamp-1 text-xs">
                                                {agent.description}
                                            </p>
                                        )}
                                    </div>
                                    <Badge variant="secondary" className="text-[10px]">
                                        Ready
                                    </Badge>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {teamInfo && teamInfo.agents.length === 0 && (
                <Card className="mx-auto max-w-md">
                    <CardContent className="p-6 text-center">
                        <BotIcon className="text-muted-foreground mx-auto mb-2 size-8" />
                        <p className="text-muted-foreground text-sm">
                            No agents have been set up yet. You can create one after onboarding.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* CTA */}
            <div className="flex justify-center pt-2">
                <Button size="lg" className="px-10" onClick={onContinue}>
                    Get Started
                </Button>
            </div>
        </div>
    );
}
