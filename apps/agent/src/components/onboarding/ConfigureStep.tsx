"use client";

import { Button, Card, CardContent, Input, Textarea, Label } from "@repo/ui";
import type { OnboardingData } from "@/app/onboarding/page";

interface ConfigureStepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onContinue: () => void;
    onBack: () => void;
    isCreating: boolean;
}

export function ConfigureStep({
    data,
    updateData,
    onContinue,
    onBack,
    isCreating
}: ConfigureStepProps) {
    const isBlankTemplate = data.selectedTemplate?.id === "blank";
    const isValid = data.agentName.trim().length > 0;

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
                    ← Back
                </Button>
                <h2 className="text-2xl font-bold">
                    {isBlankTemplate
                        ? "Configure your agent"
                        : `Customize your ${data.selectedTemplate?.name}`}
                </h2>
                <p className="text-muted-foreground">
                    {isBlankTemplate
                        ? "Set up your agent's name and behavior"
                        : "We've pre-configured the basics. Just give it a name."}
                </p>
            </div>

            <Card>
                <CardContent className="space-y-4 p-4">
                    {/* Agent Name */}
                    <div className="space-y-2">
                        <Label htmlFor="agent-name">Agent Name</Label>
                        <Input
                            id="agent-name"
                            placeholder="My Support Agent"
                            value={data.agentName}
                            onChange={(e) => updateData({ agentName: e.target.value })}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="agent-description">Description (optional)</Label>
                        <Input
                            id="agent-description"
                            placeholder="What does this agent do?"
                            value={data.agentDescription}
                            onChange={(e) => updateData({ agentDescription: e.target.value })}
                        />
                    </div>

                    {/* Instructions - only editable for blank template */}
                    {isBlankTemplate && (
                        <div className="space-y-2">
                            <Label htmlFor="instructions">Instructions</Label>
                            <Textarea
                                id="instructions"
                                placeholder="Describe how this agent should behave..."
                                rows={6}
                                value={data.instructions}
                                onChange={(e) => updateData({ instructions: e.target.value })}
                            />
                            <p className="text-muted-foreground text-xs">
                                These instructions tell the AI how to behave and respond
                            </p>
                        </div>
                    )}

                    {/* Pre-configured info for templates */}
                    {!isBlankTemplate && (
                        <div className="bg-muted rounded-lg p-4">
                            <p className="mb-2 text-sm font-medium">Pre-configured for you:</p>
                            <ul className="text-muted-foreground space-y-1 text-sm">
                                <li>
                                    ✓ Model: {data.modelProvider} / {data.modelName}
                                </li>
                                <li>✓ Instructions: Optimized for {data.selectedTemplate?.name}</li>
                                {data.selectedTools.length > 0 && (
                                    <li>✓ Tools: {data.selectedTools.join(", ")}</li>
                                )}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack}>
                    Back
                </Button>
                <Button onClick={onContinue} disabled={!isValid || isCreating}>
                    {isCreating
                        ? "Creating..."
                        : isBlankTemplate
                          ? "Next: Add Tools"
                          : "Create & Test Agent"}
                </Button>
            </div>
        </div>
    );
}
