"use client";

import { Suspense, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { Button, HugeiconsIcon, Skeleton } from "@repo/ui";
import { Add01Icon, ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";
import { getApiBase } from "@/lib/utils";
import {
    AutomationTable,
    AutomationWizard,
    DeleteConfirmDialog,
    DensityBar,
    SummaryCards,
    useAutomations
} from "@/components/automation";
import type { Automation } from "@/components/automation";

function NetworkAutomationClient() {
    const params = useParams();
    const entitySlug = params.networkSlug as string;
    const apiBase = getApiBase();

    const [showArchived, setShowArchived] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkArchiving, setBulkArchiving] = useState(false);
    const [toggling, setToggling] = useState<string | null>(null);
    const [archiving, setArchiving] = useState<string | null>(null);

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);

    const { automations, summary, agents, loading, error, refetch, setAutomations } =
        useAutomations({
            primitiveType: "network",
            entitySlug,
            includeArchived: showArchived
        });

    const toggleAutomation = useCallback(
        async (automation: Automation) => {
            setToggling(automation.id);
            try {
                const res = await fetch(
                    `${apiBase}/api/live/automations/${encodeURIComponent(automation.id)}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: !automation.isActive })
                    }
                );
                const data = await res.json();
                if (data.success) {
                    setAutomations((prev) =>
                        prev.map((a) =>
                            a.id === automation.id ? { ...a, isActive: !a.isActive } : a
                        )
                    );
                }
            } catch {
                /* silently handle */
            } finally {
                setToggling(null);
            }
        },
        [apiBase, setAutomations]
    );

    const archiveAutomation = useCallback(
        async (automation: Automation, archive: boolean) => {
            setArchiving(automation.id);
            try {
                const res = await fetch(
                    `${apiBase}/api/live/automations/${encodeURIComponent(automation.id)}`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isArchived: archive })
                    }
                );
                const data = await res.json();
                if (data.success) {
                    if (archive && !showArchived) {
                        setAutomations((prev) => prev.filter((a) => a.id !== automation.id));
                    } else {
                        setAutomations((prev) =>
                            prev.map((a) =>
                                a.id === automation.id
                                    ? {
                                          ...a,
                                          isArchived: archive,
                                          archivedAt: archive ? new Date().toISOString() : null,
                                          isActive: archive ? false : a.isActive
                                      }
                                    : a
                            )
                        );
                    }
                }
            } catch {
                /* silently handle */
            } finally {
                setArchiving(null);
            }
        },
        [apiBase, showArchived, setAutomations]
    );

    const bulkArchive = useCallback(async () => {
        if (selectedIds.size === 0) return;
        setBulkArchiving(true);
        try {
            await Promise.all(
                automations
                    .filter((a) => selectedIds.has(a.id))
                    .map((a) =>
                        fetch(`${apiBase}/api/live/automations/${encodeURIComponent(a.id)}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isArchived: true })
                        })
                    )
            );
            refetch();
            setSelectedIds(new Set());
        } catch {
            /* silently handle */
        } finally {
            setBulkArchiving(false);
        }
    }, [apiBase, automations, selectedIds, refetch]);

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold">Automations</h2>
                    <p className="text-muted-foreground text-sm">
                        Schedules and triggers for this network.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={refetch}>
                        <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-4" />
                    </Button>
                    <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                        <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
                        New
                    </Button>
                </div>
            </div>

            <SummaryCards summary={summary} loading={loading} />
            <DensityBar automations={automations} />

            <AutomationTable
                automations={automations}
                loading={loading}
                error={error}
                onToggle={toggleAutomation}
                toggling={toggling}
                onArchive={archiveAutomation}
                archiving={archiving}
                onEdit={(a) => {
                    setSelectedAutomation(a);
                    setEditDialogOpen(true);
                }}
                onDelete={(a) => {
                    setSelectedAutomation(a);
                    setDeleteDialogOpen(true);
                }}
                showArchived={showArchived}
                onShowArchivedChange={setShowArchived}
                onNew={() => setCreateDialogOpen(true)}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                onBulkArchive={bulkArchive}
                bulkArchiving={bulkArchiving}
            />

            <AutomationWizard
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                mode="create"
                automation={null}
                agents={agents}
                apiBase={apiBase}
                onSuccess={refetch}
            />
            <AutomationWizard
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                mode="edit"
                automation={selectedAutomation}
                agents={agents}
                apiBase={apiBase}
                onSuccess={refetch}
            />
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                automation={selectedAutomation}
                apiBase={apiBase}
                onSuccess={refetch}
            />
        </div>
    );
}

export default function NetworkAutomationPage() {
    return (
        <Suspense
            fallback={
                <div className="space-y-6 p-6">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-[400px]" />
                </div>
            }
        >
            <NetworkAutomationClient />
        </Suspense>
    );
}
