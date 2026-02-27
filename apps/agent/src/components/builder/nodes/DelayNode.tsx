"use client";

import { memo } from "react";
import { BaseNode } from "./BaseNode";
import type { BuilderNodeData } from "./types";

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(0)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}

function DelayNodeComponent({ data }: { data: BuilderNodeData }) {
    const delayMs = (data.config?.delayMs as number) || 0;

    return (
        <BaseNode
            data={{ ...data, description: delayMs > 0 ? formatDuration(delayMs) : "No delay set" }}
            shape="pill"
            accentColor="text-slate-500 border-slate-500/30 bg-slate-500/10"
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
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
            }
        />
    );
}

export const DelayNode = memo(DelayNodeComponent);
