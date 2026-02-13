"use client";

import Image from "next/image";

export function AgentBrand() {
    return (
        <div className="flex items-center gap-2">
            <Image src="/c2-icon.png" alt="AgentC2" width={24} height={24} className="rounded-md" />
            <span className="text-base font-semibold">AgentC2</span>
        </div>
    );
}
