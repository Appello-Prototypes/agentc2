"use client";

import { Button, Card, CardContent, Badge } from "@repo/ui";
import { CheckCircleIcon } from "lucide-react";

interface SuccessStepProps {
    agentName: string;
    agentSlug: string;
    modelProvider: string;
    modelName: string;
    toolCount: number;
    onFinish: (navigateTo?: string) => void;
}

const MODEL_DISPLAY: Record<string, string> = {
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-haiku-3-5-20241022": "Claude Haiku 3.5"
};

const NEXT_STEPS = [
    {
        href: "/workspace",
        title: "Chat with your agent",
        description: "Open the Workspace and start a conversation"
    },
    {
        href: "/mcp",
        title: "Set up integrations",
        description: "Connect HubSpot, Jira, Slack, and more via MCP"
    }
];

export function SuccessStep({
    agentName,
    agentSlug,
    modelProvider,
    modelName,
    toolCount,
    onFinish
}: SuccessStepProps) {
    const displayModel = MODEL_DISPLAY[modelName] || modelName;

    const allNextSteps = [
        ...NEXT_STEPS,
        {
            href: `/agents/${agentSlug}/overview`,
            title: "View agent details",
            description: "Monitor runs, analytics, and performance"
        },
        {
            href: "/workflows",
            title: "Create a workflow",
            description: "Chain multiple steps with logic and approvals"
        }
    ];

    return (
        <Card className="border-0 shadow-none">
            <CardContent className="space-y-8 py-8 text-center">
                {/* Success icon */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircleIcon className="size-8 text-green-600 dark:text-green-400" />
                </div>

                {/* Message */}
                <div className="space-y-3">
                    <h1 className="text-3xl font-bold">You&apos;re all set!</h1>
                    <p className="text-muted-foreground mx-auto max-w-md text-base">
                        Your agent is live and ready to work.
                    </p>
                </div>

                {/* Agent summary */}
                <div className="bg-muted/50 mx-auto max-w-sm rounded-lg border p-4 text-left">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{agentName}</span>
                            <Badge variant="outline" className="text-[10px]">
                                {displayModel}
                            </Badge>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-3 text-xs">
                            <span className="capitalize">{modelProvider}</span>
                            <span>&middot;</span>
                            <span>
                                {toolCount} tool{toolCount !== 1 ? "s" : ""}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Next steps */}
                <div className="mx-auto max-w-md space-y-4 text-left">
                    <p className="text-sm font-medium">What&apos;s next?</p>
                    <div className="space-y-2">
                        {allNextSteps.map((step) => (
                            <button
                                key={step.href}
                                type="button"
                                onClick={() => onFinish(step.href)}
                                className="hover:bg-accent/50 block w-full rounded-lg border p-3 text-left transition-colors"
                            >
                                <p className="text-sm font-medium">{step.title}</p>
                                <p className="text-muted-foreground text-xs">{step.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <Button size="lg" className="px-10" onClick={() => onFinish()}>
                    Go to Workspace
                </Button>
            </CardContent>
        </Card>
    );
}
