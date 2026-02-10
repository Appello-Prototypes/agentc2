"use client"

import * as React from "react"
import { useCanvasData } from "./CanvasRenderer"

/**
 * Resolves CSS custom property chart colors into concrete color values
 * that can be used in SVG attributes (Recharts fills/strokes).
 *
 * Priority:
 * 1. Explicit `customColors` prop (per-block override)
 * 2. Canvas theme `chartColors` (from CanvasDataContext)
 * 3. Resolved CSS custom properties (--chart-1 through --chart-5)
 * 4. Hardcoded fallback palette
 */

const CHART_CSS_VARS = [
    "--chart-1",
    "--chart-2",
    "--chart-3",
    "--chart-4",
    "--chart-5",
]

/** Fallback colors if CSS variables aren't defined */
const FALLBACK_COLORS = [
    "oklch(0.57 0.26 230)",
    "oklch(0.55 0.20 145)",
    "oklch(0.75 0.18 85)",
    "oklch(0.63 0.24 25)",
    "oklch(0.55 0.24 300)",
    "oklch(0.60 0.20 200)",
    "oklch(0.70 0.18 50)",
    "oklch(0.50 0.22 330)",
]

/**
 * Hook that returns resolved chart colors.
 * Reads from theme context, CSS custom properties, or falls back to defaults.
 */
export function useChartColors(customColors?: string[]): string[] {
    const { theme } = useCanvasData()
    const [resolved, setResolved] = React.useState<string[]>(FALLBACK_COLORS)

    React.useEffect(() => {
        // Priority 1: per-block override
        if (customColors && customColors.length > 0) {
            setResolved(customColors)
            return
        }

        // Priority 2: theme-level chart colors
        if (theme?.chartColors && theme.chartColors.length > 0) {
            setResolved(theme.chartColors)
            return
        }

        // Priority 3: CSS custom properties
        try {
            const style = getComputedStyle(document.documentElement)
            const colors = CHART_CSS_VARS.map((varName, idx) => {
                const value = style.getPropertyValue(varName).trim()
                return value || FALLBACK_COLORS[idx] || FALLBACK_COLORS[0]!
            })

            if (colors.some((c) => c.length > 0)) {
                setResolved(colors)
            }
        } catch {
            // SSR or no document - use fallbacks
        }
    }, [customColors, theme?.chartColors])

    return resolved
}
