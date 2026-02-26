"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Skeleton,
    Alert,
    AlertDescription,
    Badge,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Input
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Partner {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    allowedDomains: string[];
    tokenMaxAgeSec: number;
    createdAt: string;
    _count: {
        deployments: number;
        users: number;
    };
}

export default function EmbedPartnersPage() {
    const router = useRouter();
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch(`${getApiBase()}/api/embed-partners`)
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    setPartners(data.partners);
                } else {
                    setError(data.error || "Failed to load partners");
                }
            })
            .catch(() => setError("Failed to load partners"))
            .finally(() => setLoading(false));
    }, []);

    const filtered = partners.filter(
        (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.slug.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Embed Partners</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage external platforms that embed AgentC2
                    </p>
                </div>
                <Button onClick={() => router.push("/settings/embed-partners/new")}>
                    + Add Partner
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {partners.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 py-12">
                        <p className="text-muted-foreground text-sm">
                            No embed partners configured yet.
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => router.push("/settings/embed-partners/new")}
                        >
                            Create Your First Partner
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                                Partners ({partners.length})
                            </CardTitle>
                            <Input
                                placeholder="Search by name or slug..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="max-w-xs"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Slug</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-center">Deployments</TableHead>
                                    <TableHead className="text-center">Users</TableHead>
                                    <TableHead className="text-right">Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((partner) => (
                                    <TableRow
                                        key={partner.id}
                                        className="cursor-pointer"
                                        onClick={() =>
                                            router.push(`/settings/embed-partners/${partner.id}`)
                                        }
                                    >
                                        <TableCell className="font-medium">
                                            {partner.name}
                                        </TableCell>
                                        <TableCell>
                                            <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                                                {partner.slug}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={partner.isActive ? "default" : "secondary"}
                                            >
                                                {partner.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {partner._count.deployments}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {partner._count.users}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-right text-sm">
                                            {new Date(partner.createdAt).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filtered.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="text-muted-foreground py-8 text-center"
                                        >
                                            No partners match your search.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
