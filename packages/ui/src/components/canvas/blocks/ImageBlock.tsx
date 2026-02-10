"use client"

import * as React from "react"
import { useResolvedValue } from "../use-resolved-data"
import { BlockWrapper } from "./BlockWrapper"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ImageBlock({ config }: { config: any }) {
    const resolvedSrc = useResolvedValue(config.src)
    const src = typeof resolvedSrc === "string" ? resolvedSrc : config.src
    const alt = config.alt || ""
    const fit = config.fit || "cover"
    const height = config.height || 200

    const fitMap: Record<string, string> = {
        cover: "object-cover",
        contain: "object-contain",
        fill: "object-fill",
    }
    const fitClass = fitMap[fit] || "object-cover"

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
            noPadding
        >
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt={alt}
                    className={`w-full rounded-b-lg ${fitClass}`}
                    style={{ height: `${height}px` }}
                />
            ) : (
                <div
                    className="bg-muted flex items-center justify-center rounded-b-lg"
                    style={{ height: `${height}px` }}
                >
                    <span className="text-muted-foreground text-sm">No image</span>
                </div>
            )}
        </BlockWrapper>
    )
}
