"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface NetworkVersion {
    id: string;
    version: number;
    description?: string | null;
    createdAt: string;
}

export default function NetworkVersionsPage() {
    const params = useParams();
    const networkSlug = params.networkSlug as string;
    const [versions, setVersions] = useState<NetworkVersion[]>([]);

    useEffect(() => {
        const fetchVersions = async () => {
            const res = await fetch(`${getApiBase()}/api/networks/${networkSlug}/versions`);
            const data = await res.json();
            setVersions(data.versions || []);
        };
        fetchVersions();
    }, [networkSlug]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Network versions</CardTitle>
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
    );
}
