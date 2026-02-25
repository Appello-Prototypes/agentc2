"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { FlagIcon, TargetIcon, CheckCircleIcon } from "lucide-react";

interface CampaignSnapshot {
    slug: string;
    name: string;
    intent: string;
    endState: string;
    description: string | null;
    constraints: string[];
    restraints: string[];
    requireApproval: boolean;
}

interface CampaignCardProps {
    campaign: CampaignSnapshot;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
    return (
        <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                            <FlagIcon className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base">{campaign.name}</CardTitle>
                            {campaign.description && (
                                <p className="text-muted-foreground mt-0.5 text-sm">
                                    {campaign.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {campaign.requireApproval && (
                            <Badge className="bg-amber-500/10 text-xs text-amber-400">
                                Requires Approval
                            </Badge>
                        )}
                        <Badge variant="outline" className="shrink-0 text-xs">
                            Campaign
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-blue-400 uppercase">
                            <TargetIcon className="h-3 w-3" />
                            Intent
                        </div>
                        <p className="text-sm leading-relaxed">{campaign.intent}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-green-400 uppercase">
                            <CheckCircleIcon className="h-3 w-3" />
                            End State
                        </div>
                        <p className="text-sm leading-relaxed">{campaign.endState}</p>
                    </div>
                </div>

                {(campaign.constraints.length > 0 || campaign.restraints.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                        {campaign.constraints.map((c, i) => (
                            <Badge key={`c-${i}`} variant="outline" className="text-xs">
                                {c}
                            </Badge>
                        ))}
                        {campaign.restraints.map((r, i) => (
                            <Badge
                                key={`r-${i}`}
                                variant="outline"
                                className="text-xs text-amber-400"
                            >
                                {r}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
