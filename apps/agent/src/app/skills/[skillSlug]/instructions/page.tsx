"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Skeleton,
    Textarea
} from "@repo/ui";

export default function SkillInstructionsPage() {
    const params = useParams();
    const skillSlug = params.skillSlug as string;
    const [instructions, setInstructions] = useState("");
    const [skillType, setSkillType] = useState("");
    const [skillId, setSkillId] = useState("");
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${getApiBase()}/api/skills/${skillSlug}`);
                if (res.ok) {
                    const data = await res.json();
                    const s = data.skill || data;
                    setInstructions(s.instructions || "");
                    setSkillType(s.type || "");
                    setSkillId(s.id || "");
                }
            } catch (err) {
                console.error("Failed to load:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [skillSlug]);

    const handleSave = async () => {
        if (!skillId) return;
        setSaving(true);
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skillId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instructions: editValue,
                    changeSummary: "Updated instructions"
                })
            });
            if (res.ok) {
                setInstructions(editValue);
                setEditing(false);
            }
        } catch (err) {
            console.error("Failed to save:", err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Skeleton className="h-64 w-full" />;

    const isSystem = skillType === "SYSTEM";
    const charCount = instructions.length;
    const estimatedTokens = Math.ceil(charCount / 4);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Instructions</h2>
                <div className="flex items-center gap-2">
                    <div className="text-muted-foreground flex gap-3 text-xs">
                        <span>{charCount.toLocaleString()} chars</span>
                        <span>~{estimatedTokens.toLocaleString()} tokens</span>
                    </div>
                    <div className="flex rounded-md border">
                        <button
                            className={`px-3 py-1 text-xs ${viewMode === "rendered" ? "bg-muted font-medium" : ""}`}
                            onClick={() => setViewMode("rendered")}
                        >
                            Rendered
                        </button>
                        <button
                            className={`px-3 py-1 text-xs ${viewMode === "raw" ? "bg-muted font-medium" : ""}`}
                            onClick={() => setViewMode("raw")}
                        >
                            Raw
                        </button>
                    </div>
                    {!isSystem && !editing && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setEditValue(instructions);
                                setEditing(true);
                            }}
                        >
                            Edit
                        </Button>
                    )}
                    {isSystem && (
                        <Badge variant="secondary" className="text-xs">
                            Read-only (SYSTEM)
                        </Badge>
                    )}
                </div>
            </div>

            {editing ? (
                <Card>
                    <CardContent className="p-4">
                        <Textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={20}
                            className="font-mono text-xs"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-4">
                        {viewMode === "rendered" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <pre className="text-sm whitespace-pre-wrap">
                                    {instructions || "No instructions."}
                                </pre>
                            </div>
                        ) : (
                            <pre className="bg-muted/50 overflow-x-auto rounded-md p-4 font-mono text-xs whitespace-pre-wrap">
                                {instructions || "No instructions."}
                            </pre>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
