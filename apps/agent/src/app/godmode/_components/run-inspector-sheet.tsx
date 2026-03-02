"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from "@repo/ui/components/sheet";
import { getApiBase } from "@/lib/utils";
import RunDetailPanel from "@/components/RunDetailPanel";

interface RunInspectorTarget {
    runId: string;
    agentSlug: string;
    kind?: "agent" | "workflow" | "network";
}

export function RunInspectorSheet({
    target,
    onClose
}: {
    target: RunInspectorTarget | null;
    onClose: () => void;
}) {
    const [runDetail, setRunDetail] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchRunDetail = useCallback(async (t: RunInspectorTarget) => {
        setLoading(true);
        setRunDetail(null);
        try {
            const kind = t.kind || "agent";
            const base = getApiBase();
            let url = "";
            if (kind === "workflow") {
                url = `${base}/api/workflows/runs/${t.runId}`;
            } else if (kind === "network") {
                url = `${base}/api/networks/runs/${t.runId}`;
            } else {
                url = `${base}/api/agents/${t.agentSlug}/runs/${t.runId}`;
            }
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setRunDetail(data.run || data);
            }
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (target) fetchRunDetail(target);
    }, [target, fetchRunDetail]);

    return (
        <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
                <SheetHeader>
                    <SheetTitle>Run Details</SheetTitle>
                    <SheetDescription>
                        {target
                            ? `${target.kind || "agent"} run ${target.runId.slice(0, 8)}...`
                            : "Select a run to inspect"}
                    </SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                    {target && (
                        <RunDetailPanel
                            runDetail={runDetail as never}
                            loading={loading}
                            inputText=""
                            outputText=""
                            status={(runDetail as Record<string, string>)?.status || ""}
                            agentSlug={target.agentSlug}
                            runId={target.runId}
                            kind={target.kind || "agent"}
                            onRefresh={() => fetchRunDetail(target)}
                        />
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
