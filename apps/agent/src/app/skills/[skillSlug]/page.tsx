"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Separator,
    Skeleton
} from "@repo/ui";
import { Trash2Icon } from "lucide-react";

interface SkillFull {
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
    tools: Array<{ toolId: string }>;
    documents: Array<{ documentId: string; role: string | null; document: { name: string } }>;
    agents: Array<{ agentId: string; agent: { slug: string; name: string } }>;
}

export default function SkillOverviewPage() {
    const params = useParams();
    const router = useRouter();
    const skillSlug = params.skillSlug as string;
    const [skill, setSkill] = useState<SkillFull | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/skills/${skillSlug}`);
                if (res.ok) {
                    const data = await res.json();
                    setSkill(data.skill || data);
                }
            } catch (err) {
                console.error("Failed to load skill:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [skillSlug]);

    const handleDelete = async () => {
        if (!skill || !confirm(`Delete skill "${skill.name}"? This cannot be undone.`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skill.id}`, { method: "DELETE" });
            if (res.ok) router.push("/skills");
        } catch (err) {
            console.error("Failed to delete:", err);
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }
    if (!skill) return <p className="text-muted-foreground">Skill not found.</p>;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold">{skill.name}</h1>
                    <p className="text-muted-foreground font-mono text-xs">{skill.slug}</p>
                </div>
                {skill.type === "USER" && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="text-destructive"
                    >
                        <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                    </Button>
                )}
            </div>

            {/* Description */}
            {skill.description && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">{skill.description}</p>
                    </CardContent>
                </Card>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs">Tools</p>
                        <p className="text-lg font-bold">{skill.tools.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs">Documents</p>
                        <p className="text-lg font-bold">{skill.documents.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs">Agents</p>
                        <p className="text-lg font-bold">{skill.agents.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-xs">Version</p>
                        <p className="text-lg font-bold">v{skill.version}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Metadata */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs font-medium">Type:</span>
                        <Badge
                            variant={skill.type === "SYSTEM" ? "default" : "secondary"}
                            className="text-xs"
                        >
                            {skill.type}
                        </Badge>
                    </div>
                    {skill.category && (
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs font-medium">
                                Category:
                            </span>
                            <Badge variant="outline" className="text-xs">
                                {skill.category}
                            </Badge>
                        </div>
                    )}
                    {skill.tags.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs font-medium">Tags:</span>
                            <div className="flex flex-wrap gap-1">
                                {skill.tags.map((t) => (
                                    <Badge key={t} variant="secondary" className="text-[10px]">
                                        {t}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                    <Separator />
                    <div className="text-muted-foreground flex gap-4 text-xs">
                        <span>Created: {new Date(skill.createdAt).toLocaleDateString()}</span>
                        <span>Updated: {new Date(skill.updatedAt).toLocaleDateString()}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Examples */}
            {skill.examples && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Examples</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-muted/50 max-h-48 overflow-y-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                            {skill.examples}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
