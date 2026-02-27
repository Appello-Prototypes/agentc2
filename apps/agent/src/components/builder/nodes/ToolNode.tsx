"use client";

import { memo } from "react";
import { Badge } from "@repo/ui";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function ToolNodeComponent({ data }: { data: BuilderNodeData }) {
    const toolId = (data.config?.toolId as string) || "";

    return (
        <BaseNode
            data={data}
            accentColor="text-blue-500 border-blue-500/30 bg-blue-500/10"
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
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
            }
        >
            {toolId && (
                <Badge variant="secondary" className="mt-1 px-1 py-0 text-[9px]">
                    {toolId}
                </Badge>
            )}
        </BaseNode>
    );
}

export const ToolNode = memo(ToolNodeComponent);
