"use client";

import { memo } from "react";
import { Badge } from "@repo/ui";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function TransformNodeComponent({ data }: { data: BuilderNodeData }) {
    return (
        <BaseNode
            data={data}
            accentColor="text-gray-500 border-gray-500/30 bg-gray-500/10"
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
                    <path d="M4 20h16" />
                    <path d="m6 16 6-12 6 12" />
                </svg>
            }
        >
            <Badge variant="outline" className="mt-1 px-1 py-0 text-[9px]">
                pass-through
            </Badge>
        </BaseNode>
    );
}

export const TransformNode = memo(TransformNodeComponent);
