"use client";

import { memo } from "react";
import { Badge } from "@repo/ui";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function ForeachNodeComponent({ data }: { data: BuilderNodeData }) {
    const collectionPath = (data.config?.collectionPath as string) || "";
    const concurrency = (data.config?.concurrency as number) || 1;

    return (
        <BaseNode
            data={data}
            accentColor="text-cyan-500 border-cyan-500/30 bg-cyan-500/10"
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
                    <path d="M17 12H3" />
                    <path d="m11 18 6-6-6-6" />
                    <path d="M21 5v14" />
                </svg>
            }
        >
            <div className="mt-1 flex items-center gap-1">
                {collectionPath && (
                    <Badge
                        variant="outline"
                        className="max-w-[120px] truncate px-1 py-0 text-[9px]"
                    >
                        {collectionPath}
                    </Badge>
                )}
                {concurrency > 1 && (
                    <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                        x{concurrency}
                    </Badge>
                )}
            </div>
        </BaseNode>
    );
}

export const ForeachNode = memo(ForeachNodeComponent);
