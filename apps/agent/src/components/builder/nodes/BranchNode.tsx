"use client";

import { memo } from "react";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function BranchNodeComponent({ data }: { data: BuilderNodeData }) {
    const branches = (data.config?.branches as Array<{ condition?: string }>) || [];
    const labels = branches.map((b, i) => b.condition || `Condition ${i + 1}`);
    labels.push("Default");

    return (
        <BaseNode
            data={data}
            shape="diamond"
            accentColor="text-orange-500"
            icon={
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
                    <path d="M16 3h5v5" />
                    <path d="M8 3H3v5" />
                    <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
                    <path d="m15 9 6-6" />
                </svg>
            }
            handles={{ top: true, bottom: true, bottomCount: labels.length, bottomLabels: labels }}
        />
    );
}

export const BranchNode = memo(BranchNodeComponent);
