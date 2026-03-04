"use client";

import { useState, useCallback } from "react";
import { Loader2Icon, WebhookIcon } from "lucide-react";
import { Button } from "@repo/ui";
import { getApiBase } from "@/lib/utils";
import type { StepRendererProps } from "../PlaybookSetupWizard";

export function WebhookCreateStep({ installationId, step, onComplete }: StepRendererProps) {
    const base = getApiBase();
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = useCallback(async () => {
        setCreating(true);
        setError(null);
        try {
            const setupRes = await fetch(
                `${base}/api/playbooks/installations/${installationId}/setup`
            );
            const setupData = (await setupRes.json()) as {
                configSteps: {
                    id: string;
                    data: { repository?: string } | null;
                }[];
                installation: { id: string };
            };

            const repoStep = setupData.configSteps.find((s) => s.id === "select-repo");
            const repository = repoStep?.data?.repository as string | undefined;

            if (!repository) {
                setError("Select a repository first");
                setCreating(false);
                return;
            }

            const webhookPath = `sdlc_${installationId.slice(-8)}`;

            const res = await fetch(
                `${base}/api/playbooks/installations/${installationId}/setup/configure`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        stepId: step.id,
                        data: { repository, webhookPath }
                    })
                }
            );

            if (!res.ok) {
                const data = (await res.json()) as {
                    error?: string;
                    details?: { message?: string };
                };
                throw new Error(data.error ?? data.details?.message ?? "Failed to create webhook");
            }

            onComplete();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Webhook creation failed");
        } finally {
            setCreating(false);
        }
    }, [base, installationId, step.id, onComplete]);

    return (
        <div className="space-y-3">
            <div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-muted-foreground text-xs">{step.description}</p>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? (
                    <>
                        <Loader2Icon className="mr-2 h-3 w-3 animate-spin" />
                        Creating webhook...
                    </>
                ) : (
                    <>
                        <WebhookIcon className="mr-2 h-3 w-3" />
                        Create GitHub Webhook
                    </>
                )}
            </Button>
        </div>
    );
}
