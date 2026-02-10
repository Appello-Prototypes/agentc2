"use client";

import * as React from "react";
import { cn } from "../../../lib/utils";
import { useCanvasData } from "../CanvasRenderer";

export function BlockWrapper({
    title,
    description,
    children,
    className,
    noPadding
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}) {
    const { theme } = useCanvasData();

    const themeStyle: React.CSSProperties = {};
    if (theme?.cardBackground) themeStyle.backgroundColor = theme.cardBackground;
    if (theme?.cardBorder) themeStyle.borderColor = theme.cardBorder;
    if (theme?.borderRadius) {
        const radiusMap: Record<string, string> = {
            none: "0px",
            sm: "0.25rem",
            md: "0.45rem",
            lg: "0.75rem",
            xl: "1rem"
        };
        themeStyle.borderRadius = radiusMap[theme.borderRadius] || "0.45rem";
    }

    const density = theme?.density || "default";
    const headerPadding = density === "compact" ? "px-3 py-2" : density === "spacious" ? "px-5 py-4" : "px-4 py-3";
    const bodyPadding = density === "compact" ? "p-3" : density === "spacious" ? "p-5" : "p-4";

    return (
        <div
            className={cn(
                "bg-card text-card-foreground rounded-lg border shadow-sm",
                className
            )}
            style={themeStyle}
        >
            {(title || description) && (
                <div className={cn("border-b", headerPadding)}>
                    {title && <h3 className="text-sm font-semibold">{title}</h3>}
                    {description && (
                        <p
                            className="mt-0.5 text-xs"
                            style={{ color: theme?.mutedTextColor || undefined }}
                        >
                            {description}
                        </p>
                    )}
                </div>
            )}
            <div className={cn(!noPadding && bodyPadding)}>{children}</div>
        </div>
    );
}
