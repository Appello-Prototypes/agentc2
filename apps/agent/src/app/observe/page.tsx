"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon, Tabs, TabsContent, TabsList, TabsTrigger, icons } from "@repo/ui";
import { LiveRunsContent, ObservabilityDashboard } from "@/app/live/page";
import { ActivityLogTab } from "@/app/triggers/page";

function ObservePageClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activeTab = searchParams.get("tab") || "dashboard";

    const handleTabChange = useCallback(
        (value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value === "dashboard") {
                params.delete("tab");
            } else {
                params.set("tab", value);
            }
            const qs = params.toString();
            router.replace(`/observe${qs ? `?${qs}` : ""}`, { scroll: false });
        },
        [router, searchParams]
    );

    return (
        <div className="h-full overflow-y-auto">
            <div className="container mx-auto space-y-6 py-6">
                <div>
                    <h1 className="text-3xl font-bold">Observe</h1>
                    <p className="text-muted-foreground">
                        Monitor agent executions in real-time and inspect what triggered each run.
                    </p>
                </div>

                <Tabs
                    defaultValue="dashboard"
                    value={activeTab}
                    onValueChange={handleTabChange}
                    className="space-y-6"
                >
                    <TabsList>
                        <TabsTrigger value="dashboard">
                            <HugeiconsIcon icon={icons.analytics!} className="mr-1.5 size-4" />
                            Dashboard
                        </TabsTrigger>
                        <TabsTrigger value="runs">
                            <HugeiconsIcon icon={icons.activity!} className="mr-1.5 size-4" />
                            Runs
                        </TabsTrigger>
                        <TabsTrigger value="triggers">
                            <HugeiconsIcon icon={icons["play-circle"]!} className="mr-1.5 size-4" />
                            Triggers
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="runs" className="mt-0">
                        <LiveRunsContent />
                    </TabsContent>

                    <TabsContent value="dashboard" className="mt-0">
                        <ObservabilityDashboard />
                    </TabsContent>

                    <TabsContent value="triggers" className="mt-0">
                        <ActivityLogTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

export default function ObservePage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground p-6 text-sm">Loading...</div>}>
            <ObservePageClient />
        </Suspense>
    );
}
