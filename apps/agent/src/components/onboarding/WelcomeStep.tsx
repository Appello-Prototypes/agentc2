"use client";

import { AgentC2Logo, Button, Card, CardContent } from "@repo/ui";
import { BotIcon, GitBranchIcon, NetworkIcon, PlugIcon } from "lucide-react";

interface WelcomeStepProps {
    onContinue: () => void;
    onSkip: () => void;
}

const FEATURES = [
    {
        icon: BotIcon,
        title: "Agents",
        description: "AI assistants that use tools, remember context, and take action"
    },
    {
        icon: GitBranchIcon,
        title: "Workflows",
        description: "Multi-step automations with logic, approvals, and branching"
    },
    {
        icon: NetworkIcon,
        title: "Networks",
        description: "Orchestrate multiple agents to collaborate on complex tasks"
    },
    {
        icon: PlugIcon,
        title: "Integrations",
        description: "Connect HubSpot, Jira, Slack, GitHub, and more via MCP"
    }
];

export function WelcomeStep({ onContinue, onSkip }: WelcomeStepProps) {
    return (
        <Card className="border-0 shadow-none">
            <CardContent className="space-y-8 py-8 text-center">
                {/* Logo */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-violet-600 shadow-lg">
                    <AgentC2Logo size={36} className="[&_rect]:stroke-white [&_text]:fill-white" />
                </div>

                {/* Headline */}
                <div className="space-y-3">
                    <h1 className="text-3xl font-bold tracking-tight">Welcome to AgentC2</h1>
                    <p className="text-muted-foreground mx-auto max-w-lg text-base">
                        Build, deploy, and orchestrate AI agents that connect to your tools and
                        automate real work. Let&apos;s set up your first agent.
                    </p>
                </div>

                {/* Four pillars */}
                <div className="mx-auto grid max-w-lg gap-3 text-left">
                    {FEATURES.map((feature) => (
                        <div
                            key={feature.title}
                            className="flex items-start gap-3 rounded-lg border p-3"
                        >
                            <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                                <feature.icon className="size-4.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium">{feature.title}</p>
                                <p className="text-muted-foreground text-xs leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="flex flex-col items-center gap-3 pt-2">
                    <Button size="lg" className="px-10" onClick={onContinue}>
                        Get Started
                    </Button>
                    <button
                        onClick={onSkip}
                        className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                    >
                        Skip to dashboard
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}
