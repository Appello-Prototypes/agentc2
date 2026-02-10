"use client"

import * as React from "react"
import { cn } from "../../../lib/utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DividerBlock({ config }: { config: any }) {
    const orientation = config.orientation || "horizontal"
    const label = config.label

    if (orientation === "vertical") {
        return (
            <div className={cn("flex justify-center", config.className)}>
                <div className="bg-border h-full w-px" />
            </div>
        )
    }

    if (label) {
        return (
            <div className={cn("flex items-center gap-3 py-2", config.className)}>
                <div className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    {label}
                </span>
                <div className="bg-border h-px flex-1" />
            </div>
        )
    }

    return (
        <div className={cn("py-2", config.className)}>
            <div className="bg-border h-px w-full" />
        </div>
    )
}
