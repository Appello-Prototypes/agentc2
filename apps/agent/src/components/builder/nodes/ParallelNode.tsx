"use client";

import { memo } from "react";
import { Badge } from "@repo/ui";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function ParallelNodeComponent({ data }: { data: BuilderNodeData }) {
    const branches = (data.config?.branches as unknown[]) || [];

    return (
        <BaseNode
            data={data}
            accentColor="text-teal-500 border-teal-500/30 bg-teal-500/10"
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
                    <path d="M8 6v12" />
                    <path d="M16 6v12" />
                </svg>
            }
        >
            <Badge variant="secondary" className="mt-1 px-1 py-0 text-[9px]">
                {branches.length} branches
            </Badge>
        </BaseNode>
    );
}

export const ParallelNode = memo(ParallelNodeComponent);
