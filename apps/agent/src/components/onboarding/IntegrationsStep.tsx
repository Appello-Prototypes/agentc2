"use client";

import { Button, Card, CardContent, Badge } from "@repo/ui";
import { ArrowLeftIcon } from "lucide-react";

interface IntegrationsStepProps {
    onContinue: () => void;
    onBack: () => void;
}

const INTEGRATIONS = [
    {
        name: "Slack",
        description: "Send messages, search channels, and manage conversations",
        icon: "\uD83D\uDCAC",
        category: "Communication"
    },
    {
        name: "HubSpot",
        description: "Manage contacts, companies, deals, and your CRM pipeline",
        icon: "\uD83D\uDCCA",
        category: "CRM"
    },
    {
        name: "Jira",
        description: "Track issues, manage sprints, and update project boards",
        icon: "\uD83D\uDCCB",
        category: "Project Management"
    },
    {
        name: "GitHub",
        description: "Manage repos, issues, pull requests, and code reviews",
        icon: "\uD83D\uDC19",
        category: "Development"
    },
    {
        name: "Google Drive",
        description: "Search, read, and organize documents, sheets, and slides",
        icon: "\uD83D\uDCC1",
        category: "Productivity"
    },
    {
        name: "Firecrawl",
        description: "Scrape and extract content from any website",
        icon: "\uD83C\uDF10",
        category: "Web"
    }
];

export function IntegrationsStep({ onContinue, onBack }: IntegrationsStepProps) {
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
                    Protocol). You can set these up later from the Integrations page.
                </p>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="grid gap-3">
                        {INTEGRATIONS.map((integration) => (
                            <div
                                key={integration.name}
                                className="flex items-center gap-3 rounded-lg border p-3"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-800">
                                    {integration.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">{integration.name}</p>
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] font-normal"
                                        >
                                            {integration.category}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        {integration.description}
                                    </p>
                                </div>
                                <Badge variant="secondary" className="shrink-0 text-[10px]">
                                    Available
                                </Badge>
                            </div>
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
