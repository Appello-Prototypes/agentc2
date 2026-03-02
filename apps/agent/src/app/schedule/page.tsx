"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    Button,
    HugeiconsIcon,
    icons,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@repo/ui";
import { Add01Icon, ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";
import { getApiBase } from "@/lib/utils";
import { SidekickSidebar } from "@/components/SidekickSidebar";
import {
    AutomationTable,
    AutomationWizard,
    CalendarView,
    DeleteConfirmDialog,
    DensityBar,
    SummaryCards,
    useAutomations
} from "@/components/automation";
import type { Automation } from "@/components/automation";

function SchedulePageClient() {
    const searchParams = useSearchParams();
    const initialView = searchParams.get("view") || "list";
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

    const { automations, summary, agents, loading, error, refetch, setAutomations, setSummary } =
        useAutomations({ includeArchived: showArchived });

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
            const archivable = automations.filter((a) => selectedIds.has(a.id));
            await Promise.all(
                archivable.map((a) =>
                    fetch(`${apiBase}/api/live/automations/${encodeURIComponent(a.id)}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isArchived: true })
                    })
                )
            );
            const archivedSet = new Set(archivable.map((a) => a.id));
            if (!showArchived) {
                setAutomations((prev) => prev.filter((a) => !archivedSet.has(a.id)));
            } else {
                setAutomations((prev) =>
                    prev.map((a) =>
                        archivedSet.has(a.id)
                            ? {
                                  ...a,
                                  isArchived: true,
                                  archivedAt: new Date().toISOString(),
                                  isActive: false
                              }
                            : a
                    )
                );
            }
            setSelectedIds(new Set());
        } catch {
            /* silently handle */
        } finally {
            setBulkArchiving(false);
        }
    }, [apiBase, automations, selectedIds, showArchived, setAutomations]);

    const handleEdit = (automation: Automation) => {
        setSelectedAutomation(automation);
        setEditDialogOpen(true);
    };

    const handleDelete = (automation: Automation) => {
        setSelectedAutomation(automation);
        setDeleteDialogOpen(true);
    };

    const handleNew = () => setCreateDialogOpen(true);

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Schedule</h1>
                        <p className="text-muted-foreground">
                            Manage automations, schedules, and triggers. See when your agents are
                            scheduled to work.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={refetch}>
                            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-4" />
                        </Button>
                        <Button size="sm" onClick={handleNew}>
                            <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
                            New Automation
                        </Button>
                    </div>
                </div>

                <SummaryCards summary={summary} loading={loading} />
                <DensityBar automations={automations} />

                <Tabs defaultValue={initialView} className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="list">
                            <HugeiconsIcon icon={icons["task-list"]!} className="mr-1.5 size-4" />
                            List
                        </TabsTrigger>
                        <TabsTrigger value="calendar">
                            <HugeiconsIcon icon={icons.calendar!} className="mr-1.5 size-4" />
                            Calendar
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="list" className="mt-0">
                        <AutomationTable
                            automations={automations}
                            loading={loading}
                            error={error}
                            onToggle={toggleAutomation}
                            toggling={toggling}
                            onArchive={archiveAutomation}
                            archiving={archiving}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            showArchived={showArchived}
                            onShowArchivedChange={setShowArchived}
                            onNew={handleNew}
                            selectedIds={selectedIds}
                            onSelectedIdsChange={setSelectedIds}
                            onBulkArchive={bulkArchive}
                            bulkArchiving={bulkArchiving}
                        />
                    </TabsContent>

                    <TabsContent value="calendar" className="mt-0">
                        {loading ? (
                            <Skeleton className="h-[500px]" />
                        ) : (
                            <CalendarView automations={automations} onEditAutomation={handleEdit} />
                        )}
                    </TabsContent>
                </Tabs>
            </div>

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

            <SidekickSidebar
                pageContext={{
                    page: "schedule",
                    summary: summary
                        ? `${summary.total} automations, ${summary.active} active`
                        : undefined
                }}
                onAction={refetch}
            />

            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                automation={selectedAutomation}
                apiBase={apiBase}
                onSuccess={() => {
                    setAutomations((prev) => prev.filter((a) => a.id !== selectedAutomation?.id));
                    setSummary((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  total: Math.max(0, prev.total - 1),
                                  active: selectedAutomation?.isActive
                                      ? Math.max(0, prev.active - 1)
                                      : prev.active,
                                  schedules:
                                      selectedAutomation?.sourceType === "schedule"
                                          ? Math.max(0, prev.schedules - 1)
                                          : prev.schedules,
                                  triggers:
                                      selectedAutomation?.sourceType === "trigger"
                                          ? Math.max(0, prev.triggers - 1)
                                          : prev.triggers
                              }
                            : prev
                    );
                }}
            />
        </div>
    );
}

export default function SchedulePage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading...</div>}>
            <SchedulePageClient />
        </Suspense>
    );
}
