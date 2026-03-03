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
    CrownIcon,
    ZapIcon,
    CpuIcon,
    DatabaseIcon,
    EyeIcon,
    CoinsIcon
} from "lucide-react";

interface AgentSnapshot {
    slug: string;
    name: string;
    description: string | null;
    instructions: string;
    modelProvider: string;
    modelName: string;
    temperature: number | null;
    maxTokens: number | null;
    modelConfig: unknown;
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

function formatSkillSlug(slug: string): string {
    return slug.replace(/-/g, " ").replace(/_/g, " ");
}

function formatTokenCount(tokens: number): string {
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
    return String(tokens);
}

interface ModelConfigDetails {
    thinkingEnabled?: boolean;
    thinkingBudget?: number;
    cacheControl?: boolean;
    contextManagement?: boolean;
    contextManagementTrigger?: number;
}

function parseModelConfig(config: unknown): ModelConfigDetails | null {
    if (!config || typeof config !== "object") return null;
    const c = config as Record<string, unknown>;
    const details: ModelConfigDetails = {};
    let hasDetails = false;

    const anthropic = c.anthropic as Record<string, unknown> | undefined;
    if (anthropic) {
        const thinking = anthropic.thinking as Record<string, unknown> | undefined;
        if (thinking?.type === "enabled") {
            details.thinkingEnabled = true;
            details.thinkingBudget = thinking.budgetTokens as number | undefined;
            hasDetails = true;
        }
        const cache = anthropic.cacheControl as Record<string, unknown> | undefined;
        if (cache) {
            details.cacheControl = true;
            hasDetails = true;
        }
        const ctx = anthropic.contextManagement as Record<string, unknown> | undefined;
        if (ctx) {
            details.contextManagement = true;
            const edits = ctx.edits as Array<Record<string, unknown>> | undefined;
            if (edits?.[0]?.trigger) {
                const trigger = edits[0].trigger as Record<string, unknown>;
                if (trigger.value) {
                    details.contextManagementTrigger = trigger.value as number;
                }
            }
            hasDetails = true;
        }
    }

    return hasDetails ? details : null;
}

export function AgentProfileCard({ snapshot, isEntryPoint }: AgentProfileCardProps) {
    const [instructionsExpanded, setInstructionsExpanded] = useState(false);

    const memoryConfig = snapshot.memoryConfig as {
        lastMessages?: number;
        semanticRecall?: { topK?: number; messageRange?: number };
        workingMemory?: { enabled?: boolean };
    } | null;

    const modelDetails = parseModelConfig(snapshot.modelConfig);

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
                {/* Model & Runtime Badges */}
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
                    {snapshot.maxTokens != null && (
                        <div className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1">
                            <span className="text-xs">
                                Max {formatTokenCount(snapshot.maxTokens)} tokens
                            </span>
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

                {/* Model Config Details */}
                {modelDetails && (
                    <div>
                        <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                            <CpuIcon className="h-3 w-3" />
                            Model Configuration
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {modelDetails.thinkingEnabled && (
                                <div className="flex items-center gap-1.5 rounded-md border border-violet-800/50 bg-violet-500/10 px-2.5 py-1">
                                    <BrainIcon className="h-3.5 w-3.5 text-violet-400" />
                                    <span className="text-xs text-violet-300">
                                        Extended Thinking
                                        {modelDetails.thinkingBudget
                                            ? ` (${formatTokenCount(modelDetails.thinkingBudget)} budget)`
                                            : ""}
                                    </span>
                                </div>
                            )}
                            {modelDetails.contextManagement && (
                                <div className="flex items-center gap-1.5 rounded-md border border-cyan-800/50 bg-cyan-500/10 px-2.5 py-1">
                                    <DatabaseIcon className="h-3.5 w-3.5 text-cyan-400" />
                                    <span className="text-xs text-cyan-300">
                                        Context Management
                                        {modelDetails.contextManagementTrigger
                                            ? ` (compact at ${formatTokenCount(modelDetails.contextManagementTrigger)})`
                                            : ""}
                                    </span>
                                </div>
                            )}
                            {modelDetails.cacheControl && (
                                <div className="flex items-center gap-1.5 rounded-md border border-emerald-800/50 bg-emerald-500/10 px-2.5 py-1">
                                    <CoinsIcon className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-xs text-emerald-300">Prompt Caching</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Semantic Recall */}
                {memoryConfig?.semanticRecall && (
                    <div>
                        <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                            <EyeIcon className="h-3 w-3" />
                            Semantic Recall
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {memoryConfig.semanticRecall.topK != null && (
                                <div className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1">
                                    <span className="text-xs">
                                        Top {memoryConfig.semanticRecall.topK} results
                                    </span>
                                </div>
                            )}
                            {memoryConfig.semanticRecall.messageRange != null && (
                                <div className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1">
                                    <span className="text-xs">
                                        Message range: {memoryConfig.semanticRecall.messageRange}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Skills */}
                {snapshot.skills.length > 0 && (
                    <div>
                        <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                            <ZapIcon className="h-3 w-3" />
                            Skills ({snapshot.skills.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {snapshot.skills.map((skill) => (
                                <Badge
                                    key={skill}
                                    variant="outline"
                                    className="border-blue-800/50 bg-blue-500/5 text-xs text-blue-300 capitalize"
                                >
                                    {formatSkillSlug(skill)}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tools */}
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

                {/* Instructions */}
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
