"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import { ChangelogTimeline } from "@/components/changelog";

interface WorkflowVersion {
    id: string;
    version: number;
    description?: string | null;
    createdAt: string;
}

export default function WorkflowVersionsPage() {
    const params = useParams();
    const workflowSlug = params.workflowSlug as string;
    const [versions, setVersions] = useState<WorkflowVersion[]>([]);

    useEffect(() => {
        const fetchVersions = async () => {
            const res = await fetch(`${getApiBase()}/api/workflows/${workflowSlug}/versions`);
            const data = await res.json();
            setVersions(data.versions || []);
        };
        fetchVersions();
    }, [workflowSlug]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Workflow versions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {versions.length === 0 ? (
                        <div className="text-muted-foreground">No versions yet.</div>
                    ) : (
                        versions.map((version) => (
                            <div key={version.id} className="flex justify-between">
                                <div>v{version.version}</div>
                                <div className="text-muted-foreground">{version.description}</div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <ChangelogTimeline entityType="workflow" entityId={workflowSlug} title="Audit Trail" />
        </div>
    );
}
