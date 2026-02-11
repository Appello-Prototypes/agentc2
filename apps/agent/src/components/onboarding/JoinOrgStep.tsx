"use client";

import { useState } from "react";
import { Button, Card, CardContent } from "@repo/ui";
import { BuildingIcon, PlusIcon } from "lucide-react";

interface SuggestedOrg {
    id: string;
    name: string;
    slug: string;
}

interface JoinOrgStepProps {
    organization: SuggestedOrg;
    onJoin: () => Promise<void>;
    onCreateOwn: () => Promise<void>;
}

export function JoinOrgStep({ organization, onJoin, onCreateOwn }: JoinOrgStepProps) {
    const [loading, setLoading] = useState<"join" | "create" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleJoin = async () => {
        setLoading("join");
        setError(null);
        try {
            await onJoin();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to join organization");
        } finally {
            setLoading(null);
        }
    };

    const handleCreateOwn = async () => {
        setLoading("create");
        setError(null);
        try {
            await onCreateOwn();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create organization");
        } finally {
            setLoading(null);
        }
    };

    return (
        <Card className="border-0 shadow-none">
            <CardContent className="space-y-8 py-8 text-center">
                {/* Icon */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-violet-600 shadow-lg">
                    <BuildingIcon className="size-8 text-white" />
                </div>

                {/* Headline */}
                <div className="space-y-3">
                    <h1 className="text-3xl font-bold tracking-tight">Join an organization</h1>
                    <p className="text-muted-foreground mx-auto max-w-lg text-base">
                        An organization matching your email domain already exists. Would you like to
                        join them?
                    </p>
                </div>

                {/* Org card */}
                <div className="mx-auto max-w-sm rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                            <BuildingIcon className="size-5" />
                        </div>
                        <div className="min-w-0 text-left">
                            <p className="truncate text-sm font-medium">{organization.name}</p>
                            <p className="text-muted-foreground text-xs">{organization.slug}</p>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-auto max-w-sm rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col items-center gap-3 pt-2">
                    <Button
                        size="lg"
                        className="px-10"
                        onClick={handleJoin}
                        disabled={loading !== null}
                    >
                        {loading === "join" ? "Joining..." : `Join ${organization.name}`}
                    </Button>
                    <button
                        onClick={handleCreateOwn}
                        disabled={loading !== null}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
                    >
                        <PlusIcon className="size-3" />
                        {loading === "create"
                            ? "Creating..."
                            : "Create my own organization instead"}
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}
