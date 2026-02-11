"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import {
    Badge,
    Card,
    CardContent,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Skeleton
} from "@repo/ui";
import { ChevronDownIcon } from "lucide-react";

interface SkillVersion {
    id: string;
    version: number;
    instructions: string;
    configJson: unknown;
    changeSummary: string | null;
    createdAt: string;
    createdBy: string | null;
}

export default function SkillVersionsPage() {
    const params = useParams();
    const skillSlug = params.skillSlug as string;
    const [versions, setVersions] = useState<SkillVersion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // First get the skill to get its ID
                const skillRes = await fetch(`${getApiBase()}/api/skills/${skillSlug}`);
                if (skillRes.ok) {
                    const data = await skillRes.json();
                    const s = data.skill || data;
                    const versionsRes = await fetch(`${getApiBase()}/api/skills/${s.id}/versions`);
                    if (versionsRes.ok) {
                        const vData = await versionsRes.json();
                        setVersions(vData.versions || vData || []);
                    }
                }
            } catch (err) {
                console.error("Failed to load:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [skillSlug]);

    if (loading) return <Skeleton className="h-64 w-full" />;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Version History ({versions.length})</h2>

            {versions.length > 0 ? (
                <div className="space-y-3">
                    {versions.map((v) => (
                        <Collapsible key={v.id}>
                            <Card>
                                <CollapsibleTrigger className="w-full">
                                    <CardContent className="flex items-center justify-between p-4">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="text-xs">
                                                v{v.version}
                                            </Badge>
                                            <span className="text-sm">
                                                {v.changeSummary || "No change summary"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground text-xs">
                                                {new Date(v.createdAt).toLocaleDateString()}
                                            </span>
                                            <ChevronDownIcon className="text-muted-foreground h-4 w-4" />
                                        </div>
                                    </CardContent>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="border-t px-4 py-3">
                                        <p className="text-muted-foreground mb-2 text-xs font-medium">
                                            Instructions at v{v.version}:
                                        </p>
                                        <pre className="bg-muted/50 max-h-48 overflow-y-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
                                            {v.instructions}
                                        </pre>
                                        {v.createdBy && (
                                            <p className="text-muted-foreground mt-2 text-xs">
                                                By: {v.createdBy}
                                            </p>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground text-sm italic">
                            No version history yet. Versions are created when instructions or
                            composition changes.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
