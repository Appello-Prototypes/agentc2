"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input,
    Separator,
    Skeleton,
    Textarea
} from "@repo/ui";
import { PencilIcon, Trash2Icon, CheckIcon, XIcon } from "lucide-react";

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
    documents: Array<{
        documentId: string;
        role: string | null;
        document: { name: string };
    }>;
    agents: Array<{
        agentId: string;
        agent: { slug: string; name: string };
    }>;
}

export default function SkillOverviewPage() {
    const params = useParams();
    const router = useRouter();
    const skillSlug = params.skillSlug as string;
    const [skill, setSkill] = useState<SkillFull | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    // Inline editing state
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [editTags, setEditTags] = useState("");
    const [saving, setSaving] = useState(false);

    const fetchSkill = useCallback(async () => {
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
    }, [skillSlug]);

    useEffect(() => {
        fetchSkill();
    }, [fetchSkill]);

    const handleDelete = async () => {
        if (
            !skill ||
            !confirm(
                `Delete skill "${skill.name}"?\n\nThis skill is used by ${skill.agents.length} agent(s). Deleting it will affect those agents.\n\nThis cannot be undone.`
            )
        )
            return;
        setDeleting(true);
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skill.id}`, {
                method: "DELETE"
            });
            if (res.ok) router.push("/skills");
        } catch (err) {
            console.error("Failed to delete:", err);
        } finally {
            setDeleting(false);
        }
    };

    const handleSaveField = async (field: string) => {
        if (!skill) return;
        setSaving(true);
        try {
            const body: Record<string, unknown> = {};
            if (field === "tags") {
                body.tags = editTags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
            } else {
                body[field] = editValue;
            }

            const res = await fetch(`${getApiBase()}/api/skills/${skill.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                setEditingField(null);
                await fetchSkill();
            }
        } catch (err) {
            console.error("Failed to save:", err);
        } finally {
            setSaving(false);
        }
    };

    const startEditing = (field: string, currentValue: string) => {
        setEditingField(field);
        setEditValue(currentValue);
        if (field === "tags") {
            setEditTags(currentValue);
        }
    };

    const cancelEditing = () => {
        setEditingField(null);
        setEditValue("");
        setEditTags("");
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
            {/* Header with Name (editable) */}
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    {editingField === "name" ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="text-xl font-bold"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveField("name");
                                    if (e.key === "Escape") cancelEditing();
                                }}
                            />
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveField("name")}
                                disabled={saving}
                            >
                                <CheckIcon className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing}>
                                <XIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="group flex items-center gap-2">
                            <h1 className="text-xl font-bold">{skill.name}</h1>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                onClick={() => startEditing("name", skill.name)}
                            >
                                <PencilIcon className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                    <p className="text-muted-foreground font-mono text-xs">{skill.slug}</p>
                </div>
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
            </div>

            {/* Description (editable) */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Description</CardTitle>
                        {editingField !== "description" && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditing("description", skill.description || "")}
                            >
                                <PencilIcon className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {editingField === "description" ? (
                        <div className="space-y-2">
                            <Textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                rows={3}
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={cancelEditing}>
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveField("description")}
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "Save"}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm">
                            {skill.description || (
                                <span className="text-muted-foreground italic">
                                    No description. Click edit to add one.
                                </span>
                            )}
                        </p>
                    )}
                </CardContent>
            </Card>

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

            {/* Metadata (editable category and tags) */}
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

                    {/* Category (editable) */}
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs font-medium">Category:</span>
                        {editingField === "category" ? (
                            <div className="flex items-center gap-1">
                                <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-7 w-40 text-xs"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveField("category");
                                        if (e.key === "Escape") cancelEditing();
                                    }}
                                />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleSaveField("category")}
                                    disabled={saving}
                                >
                                    <CheckIcon className="h-3 w-3" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={cancelEditing}
                                >
                                    <XIcon className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <div className="group flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">
                                    {skill.category || "none"}
                                </Badge>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 opacity-100 md:h-6 md:w-6 md:opacity-0 md:group-hover:opacity-100"
                                    onClick={() => startEditing("category", skill.category || "")}
                                >
                                    <PencilIcon className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Tags (editable) */}
                    <div className="flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5 text-xs font-medium">
                            Tags:
                        </span>
                        {editingField === "tags" ? (
                            <div className="flex flex-1 items-center gap-1">
                                <Input
                                    value={editTags}
                                    onChange={(e) => setEditTags(e.target.value)}
                                    placeholder="tag1, tag2, tag3"
                                    className="h-7 text-xs"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveField("tags");
                                        if (e.key === "Escape") cancelEditing();
                                    }}
                                />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleSaveField("tags")}
                                    disabled={saving}
                                >
                                    <CheckIcon className="h-3 w-3" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={cancelEditing}
                                >
                                    <XIcon className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <div className="group flex items-center gap-1">
                                <div className="flex flex-wrap gap-1">
                                    {skill.tags.length > 0 ? (
                                        skill.tags.map((t) => (
                                            <Badge
                                                key={t}
                                                variant="secondary"
                                                className="text-[10px]"
                                            >
                                                {t}
                                            </Badge>
                                        ))
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">
                                            none
                                        </span>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 opacity-100 md:h-6 md:w-6 md:opacity-0 md:group-hover:opacity-100"
                                    onClick={() => startEditing("tags", skill.tags.join(", "))}
                                >
                                    <PencilIcon className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

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
