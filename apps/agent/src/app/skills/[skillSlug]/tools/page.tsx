"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Card, CardContent, Input, Skeleton } from "@repo/ui";
import { PlusIcon, XIcon } from "lucide-react";

interface SkillToolData {
    id: string;
    type: string;
    tools: Array<{ toolId: string }>;
}

export default function SkillToolsPage() {
    const params = useParams();
    const skillSlug = params.skillSlug as string;
    const [skill, setSkill] = useState<SkillToolData | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [newToolId, setNewToolId] = useState("");

    const fetchSkill = async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skillSlug}`);
            if (res.ok) {
                const data = await res.json();
                const s = data.skill || data;
                setSkill({ id: s.id, type: s.type, tools: s.tools || [] });
            }
        } catch (err) {
            console.error("Failed to load:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSkill();
    }, [skillSlug]);

    const handleAttach = async () => {
        if (!skill || !newToolId.trim() || actionLoading) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skill.id}/tools`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toolId: newToolId.trim() })
            });
            if (res.ok) {
                setNewToolId("");
                fetchSkill();
            }
        } catch (err) {
            console.error("Failed to attach tool:", err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDetach = async (toolId: string) => {
        if (!skill || actionLoading) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skill.id}/tools`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toolId })
            });
            if (res.ok) fetchSkill();
        } catch (err) {
            console.error("Failed to detach tool:", err);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <Skeleton className="h-64 w-full" />;
    if (!skill) return <p className="text-muted-foreground">Skill not found.</p>;

    const isSystem = skill.type === "SYSTEM";

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Tools ({skill.tools.length})</h2>
            </div>

            {/* Attach tool (USER skills only) */}
            {!isSystem && (
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Tool ID (e.g., web-fetch, calculator)"
                        value={newToolId}
                        onChange={(e) => setNewToolId(e.target.value)}
                        className="max-w-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleAttach()}
                    />
                    <Button
                        size="sm"
                        onClick={handleAttach}
                        disabled={actionLoading || !newToolId.trim()}
                    >
                        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                        Attach Tool
                    </Button>
                </div>
            )}

            {/* Tool list */}
            {skill.tools.length > 0 ? (
                <Card>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {skill.tools.map((t) => (
                                <div
                                    key={t.toolId}
                                    className="flex items-center justify-between px-4 py-3"
                                >
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {t.toolId}
                                    </Badge>
                                    {!isSystem && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDetach(t.toolId)}
                                            disabled={actionLoading}
                                        >
                                            <XIcon className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground text-sm italic">
                            {skill.type === "SYSTEM" && skill.tools.length === 0
                                ? "This is an MCP integration skill. Tools are resolved dynamically at runtime from the connected MCP server."
                                : "No tools attached. Add tools to define what this skill can do."}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
