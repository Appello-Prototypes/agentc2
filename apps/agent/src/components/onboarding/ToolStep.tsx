"use client";

import { Button, Card, CardContent } from "@repo/ui";
import type { OnboardingData } from "@/app/onboarding/page";

interface Tool {
    id: string;
    name: string;
    description: string;
}

interface ToolStepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    availableTools: Tool[];
    onContinue: () => void;
    onBack: () => void;
    isCreating: boolean;
}

export function ToolStep({
    data,
    updateData,
    availableTools,
    onContinue,
    onBack,
    isCreating
}: ToolStepProps) {
    const toggleTool = (toolId: string) => {
        const current = data.selectedTools;
        if (current.includes(toolId)) {
            updateData({ selectedTools: current.filter((t) => t !== toolId) });
        } else {
            updateData({ selectedTools: [...current, toolId] });
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
                    ← Back
                </Button>
                <h2 className="text-2xl font-bold">Add superpowers to your agent</h2>
                <p className="text-muted-foreground">
                    Tools let your agent take actions. Select the ones you need, or skip for now.
                </p>
            </div>

            <Card>
                <CardContent className="space-y-3 p-4">
                    {availableTools.map((tool) => (
                        <label
                            key={tool.id}
                            className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors"
                        >
                            <input
                                id={tool.id}
                                type="checkbox"
                                checked={data.selectedTools.includes(tool.id)}
                                onChange={() => toggleTool(tool.id)}
                                className="mt-0.5"
                            />
                            <div className="flex-1">
                                <span className="font-medium">{tool.name}</span>
                                <p className="text-muted-foreground text-sm">{tool.description}</p>
                            </div>
                        </label>
                    ))}
                </CardContent>
            </Card>

            <p className="text-muted-foreground text-center text-sm">
                You can add more tools later, including MCP integrations like HubSpot, Jira, and
                Slack.
            </p>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack}>
                    Back
                </Button>
                <Button onClick={onContinue} disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create & Test Agent"}
                </Button>
            </div>
        </div>
    );
}
