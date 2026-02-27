"use client";

import { memo } from "react";
import { Badge } from "@repo/ui";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function AgentNodeComponent({ data }: { data: BuilderNodeData }) {
    const agentSlug = (data.config?.agentSlug as string) || "";
    const model = (data.config?.modelName as string) || "";

    return (
        <BaseNode
            data={data}
            accentColor="text-violet-500 border-violet-500/30 bg-violet-500/10"
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
                    <path d="M12 8V4H8" />
                    <rect width="16" height="12" x="4" y="8" rx="2" />
                    <path d="M2 14h2" />
                    <path d="M20 14h2" />
                    <path d="M15 13v2" />
                    <path d="M9 13v2" />
                </svg>
            }
        >
            {(agentSlug || model) && (
                <div className="mt-1 flex items-center gap-1">
                    {agentSlug && (
                        <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                            {agentSlug}
                        </Badge>
                    )}
                    {model && (
                        <Badge variant="outline" className="px-1 py-0 text-[9px]">
                            {model}
                        </Badge>
                    )}
                </div>
            )}
        </BaseNode>
    );
}

export const AgentNode = memo(AgentNodeComponent);
