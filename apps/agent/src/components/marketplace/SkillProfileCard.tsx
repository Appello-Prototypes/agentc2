"use client";

import { useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { ZapIcon, WrenchIcon, FileTextIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";

interface SkillSnapshot {
    slug: string;
    name: string;
    description: string | null;
    instructions: string;
    category: string | null;
    tags: string[];
    tools: Array<{ toolId: string }>;
    documents: string[];
}

interface SkillProfileCardProps {
    snapshot: SkillSnapshot;
}

function formatToolName(toolId: string): string {
    return toolId.replace(/-/g, " ").replace(/_/g, " ");
}

export function SkillProfileCard({ snapshot }: SkillProfileCardProps) {
    const [instructionsExpanded, setInstructionsExpanded] = useState(false);

    const instructionLines = snapshot.instructions.split("\n");
    const previewLines = instructionLines.slice(0, 3).join("\n");
    const hasMoreLines = instructionLines.length > 3;

    return (
        <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                            <ZapIcon className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base">{snapshot.name}</CardTitle>
                            {snapshot.description && (
                                <p className="text-muted-foreground mt-0.5 text-sm">
                                    {snapshot.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {snapshot.category && (
                            <Badge variant="outline" className="text-xs capitalize">
                                {snapshot.category}
                            </Badge>
                        )}
                        <Badge variant="outline" className="shrink-0 text-xs">
                            Skill
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {snapshot.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {snapshot.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}

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

                {snapshot.documents.length > 0 && (
                    <div>
                        <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                            <FileTextIcon className="h-3 w-3" />
                            Documents ({snapshot.documents.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {snapshot.documents.map((doc) => (
                                <Badge key={doc} variant="outline" className="text-xs capitalize">
                                    {doc.replace(/-/g, " ")}
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
