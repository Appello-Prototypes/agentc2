"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Separator,
    Sheet,
    SheetContent,
    Skeleton
} from "@repo/ui";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";

interface SkillDetail {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    instructions: string;
    examples: string | null;
    category: string | null;
    tags: string[];
    version: number;
    type: string;
    createdAt: string;
    updatedAt: string;
    documents: Array<{
        documentId: string;
        role: string | null;
        document: { id: string; slug: string; name: string; category: string | null };
    }>;
    tools: Array<{ toolId: string }>;
    agents: Array<{
        agentId: string;
        agent: { id: string; slug: string; name: string };
    }>;
}

interface SkillVersion {
    id: string;
    version: number;
    changeSummary: string | null;
    createdAt: string;
    createdBy: string | null;
}

export interface SkillDetailSheetProps {
    skillId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDetach?: (skillId: string) => void;
    onFork?: (skillId: string) => void;
    agentId?: string;
}

export function SkillDetailSheet({
    skillId,
    open,
    onOpenChange,
    onDetach,
    onFork
}: SkillDetailSheetProps) {
    const [skill, setSkill] = useState<SkillDetail | null>(null);
    const [versions, setVersions] = useState<SkillVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [instructionsExpanded, setInstructionsExpanded] = useState(false);

    useEffect(() => {
        if (!skillId || !open) return;
        setLoading(true);
        setSkill(null);
        setVersions([]);

        const fetchData = async () => {
            try {
                const [skillRes, versionsRes] = await Promise.all([
                    fetch(`${getApiBase()}/api/skills/${skillId}`),
                    fetch(`${getApiBase()}/api/skills/${skillId}/versions`)
                ]);
                if (skillRes.ok) {
                    const data = await skillRes.json();
                    setSkill(data.skill || data);
                }
                if (versionsRes.ok) {
                    const data = await versionsRes.json();
                    setVersions(data.versions || data || []);
                }
            } catch (err) {
                console.error("Failed to load skill detail:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [skillId, open]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto p-0 sm:w-[520px] sm:max-w-[520px]">
                {loading ? (
                    <div className="space-y-4 p-6">
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : skill ? (
                    <div className="flex h-full flex-col">
                        {/* Header */}
                        <div className="border-b p-6">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h2 className="text-lg font-semibold">{skill.name}</h2>
                                    <p className="text-muted-foreground font-mono text-xs">
                                        {skill.slug}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-xs">
                                        v{skill.version}
                                    </Badge>
                                    <Badge
                                        variant={skill.type === "SYSTEM" ? "default" : "secondary"}
                                        className="text-xs"
                                    >
                                        {skill.type}
                                    </Badge>
                                </div>
                            </div>
                            {skill.category && (
                                <Badge variant="outline" className="mt-2 text-xs">
                                    {skill.category}
                                </Badge>
                            )}
                            {skill.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {skill.tags.map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="secondary"
                                            className="text-[10px]"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            {skill.description && (
                                <p className="text-muted-foreground mt-3 text-sm">
                                    {skill.description}
                                </p>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-1 overflow-y-auto p-6">
                            {/* Instructions */}
                            <Collapsible
                                open={instructionsExpanded}
                                onOpenChange={setInstructionsExpanded}
                            >
                                <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
                                    <h3 className="text-sm font-medium">Instructions</h3>
                                    <ChevronDownIcon
                                        className={`text-muted-foreground h-4 w-4 transition-transform ${instructionsExpanded ? "rotate-180" : ""}`}
                                    />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="bg-muted/50 max-h-64 overflow-y-auto rounded-md p-3">
                                        <pre className="text-xs whitespace-pre-wrap">
                                            {skill.instructions}
                                        </pre>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            <Separator />

                            {/* Examples */}
                            {skill.examples && (
                                <>
                                    <Collapsible>
                                        <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
                                            <h3 className="text-sm font-medium">Examples</h3>
                                            <ChevronDownIcon className="text-muted-foreground h-4 w-4" />
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="bg-muted/50 max-h-48 overflow-y-auto rounded-md p-3">
                                                <pre className="text-xs whitespace-pre-wrap">
                                                    {skill.examples}
                                                </pre>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                    <Separator />
                                </>
                            )}

                            {/* Tools */}
                            <div className="py-2">
                                <h3 className="mb-2 text-sm font-medium">
                                    Tools ({skill.tools.length})
                                </h3>
                                {skill.tools.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {skill.tools.map((t) => (
                                            <Badge
                                                key={t.toolId}
                                                variant="outline"
                                                className="font-mono text-[10px]"
                                            >
                                                {t.toolId}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-xs italic">
                                        No static tools — MCP tools resolved dynamically at runtime
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Documents */}
                            <div className="py-2">
                                <h3 className="mb-2 text-sm font-medium">
                                    Documents ({skill.documents.length})
                                </h3>
                                {skill.documents.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {skill.documents.map((d) => (
                                            <div
                                                key={d.documentId}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <Link
                                                    href={`/knowledge/${d.document.slug || d.documentId}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {d.document.name}
                                                </Link>
                                                {d.role && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-[10px]"
                                                    >
                                                        {d.role}
                                                    </Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-xs italic">
                                        No documents attached
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Agent Usage */}
                            <div className="py-2">
                                <h3 className="mb-2 text-sm font-medium">
                                    Used by ({skill.agents.length} agents)
                                </h3>
                                {skill.agents.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {skill.agents.map((a) => (
                                            <Link
                                                key={a.agentId}
                                                href={`/agents/${a.agent.slug}/configure`}
                                                className="text-primary block text-xs hover:underline"
                                            >
                                                {a.agent.name}
                                                <span className="text-muted-foreground ml-1">
                                                    ({a.agent.slug})
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-xs italic">
                                        Not used by any agents yet
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Version History */}
                            <div className="py-2">
                                <h3 className="mb-2 text-sm font-medium">
                                    Version History ({versions.length})
                                </h3>
                                {versions.length > 0 ? (
                                    <div className="space-y-2">
                                        {versions.slice(0, 5).map((v) => (
                                            <div
                                                key={v.id}
                                                className="bg-muted/30 rounded-md p-2 text-xs"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px]"
                                                    >
                                                        v{v.version}
                                                    </Badge>
                                                    <span className="text-muted-foreground">
                                                        {new Date(v.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {v.changeSummary && (
                                                    <p className="text-muted-foreground mt-1">
                                                        {v.changeSummary}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                        {versions.length > 5 && (
                                            <p className="text-muted-foreground text-center text-xs">
                                                + {versions.length - 5} more versions
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-xs italic">
                                        No version history
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="border-t p-4">
                            <div className="flex items-center gap-2">
                                <Link href={`/skills/${skill.slug}`} className="flex-1">
                                    <Button variant="outline" size="sm" className="w-full">
                                        <ExternalLinkIcon className="mr-1.5 h-3.5 w-3.5" />
                                        View Full Page
                                    </Button>
                                </Link>
                                {onFork && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onFork(skill.id)}
                                    >
                                        Duplicate
                                    </Button>
                                )}
                                {onDetach && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive flex-1"
                                        onClick={() => onDetach(skill.id)}
                                    >
                                        Detach
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center p-6">
                        <p className="text-muted-foreground text-sm">Skill not found</p>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
