"use client";

import { memo } from "react";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function HumanNodeComponent({ data }: { data: BuilderNodeData }) {
    return (
        <BaseNode
            data={data}
            accentColor="text-amber-500 border-amber-500/30 bg-amber-500/10"
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
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            }
        />
    );
}

export const HumanNode = memo(HumanNodeComponent);
