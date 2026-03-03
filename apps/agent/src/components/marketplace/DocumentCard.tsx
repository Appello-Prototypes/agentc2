"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { FileTextIcon, BookOpenIcon } from "lucide-react";

interface DocumentSnapshot {
    slug: string;
    name: string;
    description: string | null;
    contentType: string;
    category: string | null;
    tags: string[];
}

interface DocumentCardProps {
    snapshot: DocumentSnapshot;
}

function getContentTypeLabel(ct: string): string {
    const map: Record<string, string> = {
        markdown: "Markdown",
        text: "Plain Text",
        html: "HTML",
        json: "JSON",
        yaml: "YAML"
    };
    return map[ct] ?? ct;
}

export function DocumentCard({ snapshot }: DocumentCardProps) {
    return (
        <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                            <BookOpenIcon className="h-4 w-4 text-amber-400" />
                        </div>
                        <div>
                            <CardTitle className="text-sm">{snapshot.name}</CardTitle>
                            {snapshot.description && (
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                    {snapshot.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                            {getContentTypeLabel(snapshot.contentType)}
                        </Badge>
                        {snapshot.category && (
                            <Badge variant="outline" className="text-xs capitalize">
                                {snapshot.category}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            {snapshot.tags.length > 0 && (
                <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1">
                        {snapshot.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
