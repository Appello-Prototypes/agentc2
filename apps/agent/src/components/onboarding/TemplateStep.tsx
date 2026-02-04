"use client";

import { Button, Card, CardContent } from "@repo/ui";
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
                    ← Back
                </Button>
                <h2 className="text-2xl font-bold">How do you want to start?</h2>
                <p className="text-muted-foreground">
                    Choose a pre-built template or start with a blank canvas
                </p>
            </div>

            {/* Pre-built templates */}
            <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-medium">Start from a template</p>
                <div className="grid gap-3">
                    {prebuiltTemplates.map((template) => (
                        <Card
                            key={template.id}
                            className="hover:border-primary cursor-pointer transition-colors"
                            onClick={() => onSelect(template)}
                        >
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-2xl">
                                    {template.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">{template.name}</p>
                                    <p className="text-muted-foreground text-sm">
                                        {template.description}
                                    </p>
                                </div>
                                <div className="text-muted-foreground">→</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Blank template */}
            {blankTemplate && (
                <div className="space-y-3">
                    <p className="text-muted-foreground text-sm font-medium">
                        Or build from scratch
                    </p>
                    <Card
                        className="hover:border-primary cursor-pointer border-dashed transition-colors"
                        onClick={() => onSelect(blankTemplate)}
                    >
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-2xl">
                                {blankTemplate.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">{blankTemplate.name}</p>
                                <p className="text-muted-foreground text-sm">
                                    {blankTemplate.description}
                                </p>
                            </div>
                            <div className="text-muted-foreground">→</div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
