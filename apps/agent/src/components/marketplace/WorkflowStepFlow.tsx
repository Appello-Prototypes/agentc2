"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { WorkflowIcon, ArrowRightIcon, WrenchIcon, BotIcon, GlobeIcon } from "lucide-react";

interface WorkflowStep {
    id: string;
    type: string;
    toolId?: string;
    label?: string;
}

interface WorkflowSnapshot {
    slug: string;
    name: string;
    description: string | null;
    definitionJson: unknown;
    inputSchemaJson: unknown;
    maxSteps: number;
}

interface WorkflowStepFlowProps {
    workflow: WorkflowSnapshot;
}

function getStepIcon(step: WorkflowStep) {
    if (step.type === "tool") return <WrenchIcon className="h-3.5 w-3.5 text-yellow-400" />;
    if (step.type === "agent") return <BotIcon className="h-3.5 w-3.5 text-blue-400" />;
    return <GlobeIcon className="h-3.5 w-3.5 text-zinc-400" />;
}

function getStepLabel(step: WorkflowStep): string {
    if (step.label) return step.label;
    if (step.toolId) return step.toolId.replace(/-/g, " ");
    return step.id;
}

export function WorkflowStepFlow({ workflow }: WorkflowStepFlowProps) {
    const definition = workflow.definitionJson as {
        steps?: WorkflowStep[];
    } | null;

    const steps = definition?.steps ?? [];

    const inputSchema = workflow.inputSchemaJson as {
        properties?: Record<string, { type: string; description?: string }>;
        required?: string[];
    } | null;

    const inputFields = inputSchema?.properties ? Object.entries(inputSchema.properties) : [];

    return (
        <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                            <WorkflowIcon className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base">{workflow.name}</CardTitle>
                            {workflow.description && (
                                <p className="text-muted-foreground mt-0.5 text-sm">
                                    {workflow.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                        Workflow
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {steps.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        {steps.map((step, idx) => (
                            <div key={step.id} className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold">
                                        {idx + 1}
                                    </div>
                                    {getStepIcon(step)}
                                    <span className="text-sm capitalize">{getStepLabel(step)}</span>
                                </div>
                                {idx < steps.length - 1 && (
                                    <ArrowRightIcon className="h-4 w-4 text-zinc-600" />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {inputFields.length > 0 && (
                    <div>
                        <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                            Inputs
                        </div>
                        <div className="space-y-1">
                            {inputFields.map(([key, schema]) => (
                                <div key={key} className="flex items-center gap-2 text-sm">
                                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
                                        {key}
                                    </code>
                                    <span className="text-muted-foreground text-xs">
                                        {schema.type}
                                    </span>
                                    {schema.description && (
                                        <span className="text-muted-foreground text-xs">
                                            — {schema.description}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
