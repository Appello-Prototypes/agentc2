"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Badge, cn } from "@repo/ui";
import { NODE_STATUS_STYLES, type BuilderNodeData, type BuilderNodeStatus } from "./types";

function RouterNodeComponent({ data }: { data: BuilderNodeData }) {
    const status = (data.status || "pending") as BuilderNodeStatus;
    const modelName = (data.config?.modelName as string) || "";

    return (
        <div className="relative">
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-muted-foreground/50 !border-background !h-2 !w-2 !border-2"
            />
            <div
                className={cn(
                    "bg-background flex items-center gap-2.5 border-2 px-4 py-3 shadow-sm",
                    "clip-hexagon min-w-[200px]",
                    NODE_STATUS_STYLES[status],
                    data.selected && "ring-primary ring-offset-background ring-2 ring-offset-2",
                    "rounded-xl"
                )}
            >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-500">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v4" />
                        <path d="M12 18v4" />
                        <path d="m4.93 4.93 2.83 2.83" />
                        <path d="m16.24 16.24 2.83 2.83" />
                        <path d="M2 12h4" />
                        <path d="M18 12h4" />
                        <path d="m4.93 19.07 2.83-2.83" />
                        <path d="m16.24 7.76 2.83-2.83" />
                    </svg>
                </div>
                <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{data.label || "Router"}</div>
                    {modelName && (
                        <Badge variant="outline" className="mt-0.5 px-1 py-0 text-[9px]">
                            {modelName}
                        </Badge>
                    )}
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

export const RouterNode = memo(RouterNodeComponent);
