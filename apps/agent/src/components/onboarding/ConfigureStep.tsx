"use client";

import { useState } from "react";
import {
    Button,
    Card,
    CardContent,
    Input,
    Textarea,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@repo/ui";
import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { OnboardingData } from "@/app/onboarding/page";

interface ConfigureStepProps {
    data: OnboardingData;
    updateData: (updates: Partial<OnboardingData>) => void;
    onContinue: () => void;
    onBack: () => void;
}

const MODELS = [
    { provider: "openai", name: "gpt-4o", label: "GPT-4o", description: "Fast and capable" },
    {
        provider: "openai",
        name: "gpt-4o-mini",
        label: "GPT-4o Mini",
        description: "Faster, lower cost"
    },
    {
        provider: "anthropic",
        name: "claude-sonnet-4-20250514",
        label: "Claude Sonnet 4",
        description: "Excellent reasoning"
    },
    {
        provider: "anthropic",
        name: "claude-haiku-3-5-20241022",
        label: "Claude Haiku 3.5",
        description: "Fast and efficient"
    }
];

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export function ConfigureStep({ data, updateData, onContinue, onBack }: ConfigureStepProps) {
    const isBlankTemplate = data.selectedTemplate?.id === "blank";
    const isValid = data.agentName.trim().length > 0;
    const [showAdvanced, setShowAdvanced] = useState(false);

    const slug = slugify(data.agentName);
    const currentModelKey = `${data.modelProvider}:${data.modelName}`;

    const handleModelChange = (key: string | null) => {
        if (!key) return;
        const model = MODELS.find((m) => `${m.provider}:${m.name}` === key);
        if (model) {
            updateData({ modelProvider: model.provider, modelName: model.name });
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
                    <ArrowLeftIcon className="mr-1 size-4" />
                    Back
                </Button>
                <h2 className="text-2xl font-bold">
                    {isBlankTemplate
                        ? "Configure your agent"
                        : `Customize your ${data.selectedTemplate?.name}`}
                </h2>
                <p className="text-muted-foreground text-sm">
                    {isBlankTemplate
                        ? "Set up your agent's name, model, and behavior."
                        : "We've pre-configured the basics. Give it a name and customize if needed."}
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
                        {slug && (
                            <p className="text-muted-foreground text-xs">
                                Slug: <code className="bg-muted rounded px-1">{slug}</code>
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="agent-description">
                            Description{" "}
                            <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Input
                            id="agent-description"
                            placeholder="What does this agent do?"
                            value={data.agentDescription}
                            onChange={(e) => updateData({ agentDescription: e.target.value })}
                        />
                    </div>

                    {/* Model selector */}
                    <div className="space-y-2">
                        <Label>Model</Label>
                        <Select value={currentModelKey} onValueChange={handleModelChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                                {MODELS.map((model) => (
                                    <SelectItem
                                        key={`${model.provider}:${model.name}`}
                                        value={`${model.provider}:${model.name}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{model.label}</span>
                                            <span className="text-muted-foreground text-xs">
                                                {model.description}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Instructions - always editable for blank, collapsible for templates */}
                    {isBlankTemplate ? (
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
                                These instructions tell the AI how to behave and respond.
                            </p>
                        </div>
                    ) : (
                        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                            <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-sm transition-colors">
                                {showAdvanced ? (
                                    <ChevronDownIcon className="size-4" />
                                ) : (
                                    <ChevronRightIcon className="size-4" />
                                )}
                                View & edit instructions
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-3">
                                <div className="space-y-2">
                                    <Textarea
                                        id="instructions"
                                        rows={8}
                                        value={data.instructions}
                                        onChange={(e) =>
                                            updateData({ instructions: e.target.value })
                                        }
                                        className="text-sm"
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        Pre-configured for {data.selectedTemplate?.name}. Edit to
                                        customize behavior.
                                    </p>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onBack}>
                    Back
                </Button>
                <Button onClick={onContinue} disabled={!isValid}>
                    Continue
                </Button>
            </div>
        </div>
    );
}
