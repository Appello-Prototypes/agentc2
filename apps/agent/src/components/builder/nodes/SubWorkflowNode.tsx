"use client";

import { memo } from "react";
import { Badge } from "@repo/ui";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function SubWorkflowNodeComponent({ data }: { data: BuilderNodeData }) {
    const workflowId = (data.config?.workflowId as string) || "";

    return (
        <BaseNode
            data={data}
            accentColor="text-indigo-500 border-indigo-500/30 bg-indigo-500/10"
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
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                </svg>
            }
        >
            {workflowId && (
                <Badge variant="secondary" className="mt-1 px-1 py-0 text-[9px]">
                    {workflowId}
                </Badge>
            )}
        </BaseNode>
    );
}

export const SubWorkflowNode = memo(SubWorkflowNodeComponent);
