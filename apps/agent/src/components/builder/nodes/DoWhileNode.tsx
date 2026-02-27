"use client";

import { memo } from "react";
import { Badge } from "@repo/ui";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function DoWhileNodeComponent({ data }: { data: BuilderNodeData }) {
    const condition = (data.config?.conditionExpression as string) || "";
    const maxIterations = (data.config?.maxIterations as number) || 10;

    return (
        <BaseNode
            data={data}
            accentColor="text-cyan-600 border-cyan-600/30 bg-cyan-600/10"
            icon={
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
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
            }
        >
            <div className="mt-1 flex items-center gap-1">
                {condition && (
                    <Badge
                        variant="outline"
                        className="max-w-[120px] truncate px-1 py-0 text-[9px]"
                    >
                        {condition}
                    </Badge>
                )}
                <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                    max {maxIterations}
                </Badge>
            </div>
        </BaseNode>
    );
}

export const DoWhileNode = memo(DoWhileNodeComponent);
