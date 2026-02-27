"use client";

import { useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import {
    BotIcon,
    BrainIcon,
    WrenchIcon,
    MemoryStickIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    SparklesIcon,
    CrownIcon
} from "lucide-react";

interface AgentSnapshot {
    slug: string;
    name: string;
    description: string | null;
    instructions: string;
    modelProvider: string;
    modelName: string;
    temperature: number | null;
    memoryEnabled: boolean;
    memoryConfig: unknown;
    maxSteps: number | null;
    tools: Array<{ toolId: string; config: unknown }>;
    skills: string[];
    metadata: unknown;
}

interface AgentProfileCardProps {
    snapshot: AgentSnapshot;
    isEntryPoint?: boolean;
}

function getProviderLabel(provider: string): string {
    const map: Record<string, string> = {
        anthropic: "Anthropic",
        openai: "OpenAI",
        google: "Google"
    };
    return map[provider] ?? provider;
}

function getModelLabel(model: string): string {
    return model
        .replace("claude-", "Claude ")
        .replace("gpt-", "GPT-")
        .replace("gemini-", "Gemini ")
        .replace(/-/g, " ");
}

function formatToolName(toolId: string): string {
    return toolId.replace(/-/g, " ").replace(/_/g, " ");
}

export function AgentProfileCard({ snapshot, isEntryPoint }: AgentProfileCardProps) {
    const [instructionsExpanded, setInstructionsExpanded] = useState(false);

    const memoryConfig = snapshot.memoryConfig as {
        lastMessages?: number;
        semanticRecall?: { topK?: number };
        workingMemory?: { enabled?: boolean };
    } | null;

    const instructionLines = snapshot.instructions.split("\n");
    const previewLines = instructionLines.slice(0, 3).join("\n");
    const hasMoreLines = instructionLines.length > 3;

    return (
        <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                            <BotIcon className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                {snapshot.name}
                                {isEntryPoint && (
                                    <Badge className="bg-blue-500/10 text-xs text-blue-400">
                                        <CrownIcon className="mr-1 h-3 w-3" />
                                        Entry Point
                                    </Badge>
                                )}
                            </CardTitle>
                            {snapshot.description && (
                                <p className="text-muted-foreground mt-0.5 text-sm">
                                    {snapshot.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                        Agent
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1">
                        <BrainIcon className="h-3.5 w-3.5 text-purple-400" />
                        <span className="text-xs">
                            {getProviderLabel(snapshot.modelProvider)} /{" "}
                            {getModelLabel(snapshot.modelName)}
                        </span>
                    </div>
                    {snapshot.temperature != null && (
                        <div className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1">
                            <SparklesIcon className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-xs">Temp: {snapshot.temperature}</span>
                        </div>
                    )}
                    {snapshot.memoryEnabled && (
                        <div className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1">
                            <MemoryStickIcon className="h-3.5 w-3.5 text-green-400" />
                            <span className="text-xs">
                                Memory
                                {memoryConfig?.lastMessages
                                    ? ` (${memoryConfig.lastMessages} msgs)`
                                    : ""}
                                {memoryConfig?.workingMemory?.enabled ? " + working" : ""}
                            </span>
                        </div>
                    )}
                    {snapshot.maxSteps != null && (
                        <div className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1">
                            <span className="text-xs">Max {snapshot.maxSteps} steps</span>
                        </div>
                    )}
                </div>

                {snapshot.tools.length > 0 && (
                    <div>
                        <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                            <WrenchIcon className="h-3 w-3" />
                            Tools ({snapshot.tools.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {snapshot.tools.map((tool) => (
                                <Badge
                                    key={tool.toolId}
                                    variant="outline"
                                    className="text-xs capitalize"
                                >
                                    {formatToolName(tool.toolId)}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}


                <div>
                    <button
                        onClick={() => setInstructionsExpanded(!instructionsExpanded)}
                        className="text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 text-xs font-medium tracking-wide uppercase transition-colors"
                    >
                        {instructionsExpanded ? (
                            <ChevronDownIcon className="h-3 w-3" />
                        ) : (
                            <ChevronRightIcon className="h-3 w-3" />
                        )}
                        Instructions
                    </button>
                    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
                        <pre className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                            {instructionsExpanded ? snapshot.instructions : previewLines}
                            {!instructionsExpanded && hasMoreLines && (
                                <span className="text-blue-400"> ...click to expand</span>
                            )}
                        </pre>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
