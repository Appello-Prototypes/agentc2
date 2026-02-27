"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Badge, cn } from "@repo/ui";
import { NODE_STATUS_STYLES, type BuilderNodeData, type BuilderNodeStatus } from "./types";

function TriggerNodeComponent({ data }: { data: BuilderNodeData }) {
    const status = (data.status || "pending") as BuilderNodeStatus;

    return (
        <div className="relative">
            <div
                className={cn(
                    "bg-background flex min-w-[180px] items-center gap-2.5 rounded-l-full rounded-r-xl border-2 px-4 py-2.5 shadow-sm",
                    NODE_STATUS_STYLES[status],
                    data.selected && "ring-primary ring-offset-background ring-2 ring-offset-2"
                )}
            >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                </div>
                <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{data.label}</div>
                    <Badge variant="outline" className="mt-0.5 px-1 py-0 text-[9px]">
                        visual only
                    </Badge>
                </div>
            </div>
            <Handle
                type="source"
                position={Position.Bottom}
                className="!bg-muted-foreground/50 !border-background !h-2 !w-2 !border-2"
            />
        </div>
    );
}

export const TriggerNode = memo(TriggerNodeComponent);
