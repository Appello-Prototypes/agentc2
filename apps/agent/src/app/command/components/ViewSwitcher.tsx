"use client";

import { lazy, Suspense } from "react";
import { Skeleton } from "@repo/ui";
import type { ViewMode, CommandViewProps } from "../types";

const PipelineSwimlanes = lazy(() =>
    import("./views/PipelineSwimlanes").then((m) => ({ default: m.PipelineSwimlanes }))
);
const MissionControlGrid = lazy(() =>
    import("./views/MissionControlGrid").then((m) => ({ default: m.MissionControlGrid }))
);
const TimelineWaterfall = lazy(() =>
    import("./views/TimelineWaterfall").then((m) => ({ default: m.TimelineWaterfall }))
);
const SplitInbox = lazy(() =>
    import("./views/SplitInbox").then((m) => ({ default: m.SplitInbox }))
);
const TopologyFlow = lazy(() =>
    import("./views/TopologyFlow").then((m) => ({ default: m.TopologyFlow }))
);

function ViewFallback() {
    return (
        <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
        </div>
    );
}

interface ViewSwitcherProps {
    viewMode: ViewMode;
    viewProps: CommandViewProps;
}

export function ViewSwitcher({ viewMode, viewProps }: ViewSwitcherProps) {
    return (
        <Suspense fallback={<ViewFallback />}>
            {viewMode === "pipeline" && <PipelineSwimlanes {...viewProps} />}
            {viewMode === "grid" && <MissionControlGrid {...viewProps} />}
            {viewMode === "timeline" && <TimelineWaterfall {...viewProps} />}
            {viewMode === "inbox" && <SplitInbox {...viewProps} />}
            {viewMode === "topology" && <TopologyFlow {...viewProps} />}
        </Suspense>
    );
}
