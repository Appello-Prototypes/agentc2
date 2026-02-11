"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Badge, Button, Card, CardContent, Skeleton } from "@repo/ui";
import { XIcon } from "lucide-react";

interface SkillDocData {
    id: string;
    type: string;
    documents: Array<{
        documentId: string;
        role: string | null;
        document: { id: string; slug: string; name: string; category: string | null };
    }>;
}

export default function SkillDocumentsPage() {
    const params = useParams();
    const skillSlug = params.skillSlug as string;
    const [skill, setSkill] = useState<SkillDocData | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchSkill = async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skillSlug}`);
            if (res.ok) {
                const data = await res.json();
                const s = data.skill || data;
                setSkill({ id: s.id, type: s.type, documents: s.documents || [] });
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

    const handleDetach = async (documentId: string) => {
        if (!skill || actionLoading) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skill.id}/documents`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId })
            });
            if (res.ok) fetchSkill();
        } catch (err) {
            console.error("Failed to detach document:", err);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <Skeleton className="h-64 w-full" />;
    if (!skill) return <p className="text-muted-foreground">Skill not found.</p>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Documents ({skill.documents.length})</h2>
            </div>

            {skill.documents.length > 0 ? (
                <Card>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {skill.documents.map((d) => (
                                <div
                                    key={d.documentId}
                                    className="flex items-center justify-between px-4 py-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/knowledge/${d.document.slug || d.documentId}`}
                                            className="text-primary text-sm font-medium hover:underline"
                                        >
                                            {d.document.name}
                                        </Link>
                                        {d.role && (
                                            <Badge variant="secondary" className="text-[10px]">
                                                {d.role}
                                            </Badge>
                                        )}
                                        {d.document.category && (
                                            <Badge variant="outline" className="text-[10px]">
                                                {d.document.category}
                                            </Badge>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDetach(d.documentId)}
                                        disabled={actionLoading}
                                    >
                                        <XIcon className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground text-sm italic">
                            No documents attached to this skill.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
