"use client";

import { Button, Card, CardContent, Badge } from "@repo/ui";
import { ArrowLeftIcon } from "lucide-react";
import type { AgentTemplate } from "@/app/onboarding/page";

interface TemplateStepProps {
    templates: AgentTemplate[];
    onSelect: (template: AgentTemplate) => void;
    onBack: () => void;
}

export function TemplateStep({ templates, onSelect, onBack }: TemplateStepProps) {
    const prebuiltTemplates = templates.filter((t) => t.id !== "blank");
    const blankTemplate = templates.find((t) => t.id === "blank");

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
                    <ArrowLeftIcon className="mr-1 size-4" />
                    Back
                </Button>
                <h2 className="text-2xl font-bold">Choose a starting point</h2>
                <p className="text-muted-foreground text-sm">
                    An agent is an AI assistant with a specific role, tools, and memory. Pick a
                    template to get started quickly, or build from scratch.
                </p>
            </div>

            {/* Pre-built templates */}
            <div className="space-y-3">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Templates
                </p>
                <div className="grid gap-3">
                    {prebuiltTemplates.map((template) => (
                        <Card
                            key={template.id}
                            className="hover:border-primary/50 hover:bg-accent/30 cursor-pointer border transition-all"
                            onClick={() => onSelect(template)}
                        >
                            <CardContent className="flex items-center gap-4 p-4">
                                <div
                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl ${template.color}`}
                                >
                                    {template.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">{template.name}</p>
                                        {template.popular && (
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px] font-normal"
                                            >
                                                Popular
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        {template.description}
                                    </p>
                                </div>
                                <div className="text-muted-foreground text-sm">&rarr;</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Blank template */}
            {blankTemplate && (
                <div className="space-y-3">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Or build your own
                    </p>
                    <Card
                        className="hover:border-primary/50 hover:bg-accent/30 cursor-pointer border border-dashed transition-all"
                        onClick={() => onSelect(blankTemplate)}
                    >
                        <CardContent className="flex items-center gap-4 p-4">
                            <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl ${blankTemplate.color}`}
                            >
                                {blankTemplate.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{blankTemplate.name}</p>
                                <p className="text-muted-foreground text-xs">
                                    {blankTemplate.description}
                                </p>
                            </div>
                            <div className="text-muted-foreground text-sm">&rarr;</div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
