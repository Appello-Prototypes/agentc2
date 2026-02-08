"use client";

import { AgentC2Logo } from "@repo/ui";

export function AgentBrand() {
    return (
        <div className="flex items-center gap-[2px]">
            <span className="text-base font-semibold">Agent</span>
            <AgentC2Logo size={26} />
        </div>
    );
}
