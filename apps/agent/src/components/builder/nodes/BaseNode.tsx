"use client";

import { memo, type ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { Badge, cn } from "@repo/ui";
import {
    NODE_STATUS_STYLES,
    NODE_STATUS_DOT,
    type BuilderNodeData,
    type BuilderNodeStatus
} from "./types";

interface BaseNodeProps {
    data: BuilderNodeData;
    icon?: ReactNode;
    accentColor?: string;
    shape?: "rectangle" | "diamond" | "pill" | "hexagon";
    handles?: {
        top?: boolean;
        bottom?: boolean;
        left?: boolean;
        right?: boolean;
        bottomCount?: number;
        bottomLabels?: string[];
    };
    children?: ReactNode;
}

function BaseNodeComponent({
    data,
    icon,
    accentColor,
    shape = "rectangle",
    handles,
    children
}: BaseNodeProps) {
    const status = (data.status || "pending") as BuilderNodeStatus;
    const isSelected = data.selected;
    const badges = data.badges || [];

    const handleConfig = handles || { top: true, bottom: true };

    if (shape === "diamond") {
        return (
            <div className="relative">
                {handleConfig.top && (
                    <Handle
                        type="target"
                        position={Position.Top}
                        className="!bg-muted-foreground/50 !border-background !h-2 !w-2 !border-2"
                    />
                )}
                <div
                    className={cn(
                        "bg-background flex h-[100px] w-[100px] rotate-45 items-center justify-center rounded-lg border-2 shadow-sm",
                        NODE_STATUS_STYLES[status],
                        isSelected && "ring-primary ring-offset-background ring-2 ring-offset-2"
                    )}
                >
                    <div className="flex -rotate-45 flex-col items-center gap-1">
                        {icon && (
                            <div className={cn("text-muted-foreground", accentColor)}>{icon}</div>
                        )}
                        <div className="max-w-[70px] truncate text-[10px] font-medium">
                            {data.label}
                        </div>
                    </div>
                </div>
                {(handleConfig.bottomCount ?? 1) > 1 && handleConfig.bottomLabels
                    ? handleConfig.bottomLabels.map((label, i) => (
                          <Handle
                              key={`bottom-${i}`}
                              type="source"
                              position={Position.Bottom}
                              id={`branch-${i}`}
                              className="!bg-muted-foreground/50 !border-background !h-2 !w-2 !border-2"
                              style={{
                                  left: `${((i + 1) / (handleConfig.bottomLabels!.length + 1)) * 100}%`
                              }}
                          />
                      ))
                    : handleConfig.bottom !== false && (
                          <Handle
                              type="source"
                              position={Position.Bottom}
                              className="!bg-muted-foreground/50 !border-background !h-2 !w-2 !border-2"
                          />
                      )}
            </div>
        );
    }

    return (
        <div className="relative">
            {handleConfig.top && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!bg-muted-foreground/50 !border-background !h-2 !w-2 !border-2"
                />
            )}
            <div
                className={cn(
                    "bg-background max-w-[300px] min-w-[200px] border-2 shadow-sm",
                    shape === "pill" ? "rounded-full px-4 py-2" : "rounded-xl px-3 py-2.5",
                    NODE_STATUS_STYLES[status],
                    isSelected && "ring-primary ring-offset-background ring-2 ring-offset-2"
                )}
            >
                <div className="flex items-start gap-2.5">
                    {icon && (
                        <div
                            className={cn(
                                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                                accentColor || "text-muted-foreground"
                            )}
                        >
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <div
                                className={cn(
                                    "h-1.5 w-1.5 shrink-0 rounded-full",
                                    NODE_STATUS_DOT[status]
                                )}
                            />
                            <div className="truncate text-xs font-semibold">{data.label}</div>
                        </div>
                        {data.description && (
                            <div className="text-muted-foreground mt-0.5 truncate text-[10px]">
                                {data.description}
                            </div>
                        )}
                        {children}
                    </div>
                    {badges.length > 0 && (
                        <div className="flex flex-col gap-1">
                            {badges.map((badge, i) => (
                                <Badge
                                    key={i}
                                    variant={badge.variant || "outline"}
                                    className="px-1 py-0 text-[9px]"
                                >
                                    {badge.label}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {handleConfig.bottom !== false && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!bg-muted-foreground/50 !border-background !h-2 !w-2 !border-2"
                />
            )}
        </div>
    );
}

export const BaseNode = memo(BaseNodeComponent);
