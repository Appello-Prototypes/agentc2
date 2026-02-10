"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { CanvasBlock } from "./CanvasBlock";

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrored from schema to avoid cross-package dependency on zod)
// ─────────────────────────────────────────────────────────────────────────────

export interface CanvasLayout {
    type?: "grid" | "stack";
    columns?: number;
    gap?: number;
    padding?: number;
    maxWidth?: string;
}

export interface CanvasThemeForRenderer {
    primaryColor?: string;
    backgroundColor?: string;
    cardBackground?: string;
    cardBorder?: string;
    textColor?: string;
    mutedTextColor?: string;
    chartColors?: string[];
    borderRadius?: "none" | "sm" | "md" | "lg" | "xl";
    density?: "compact" | "default" | "spacious";
}

export interface CanvasSchemaForRenderer {
    title: string;
    description?: string;
    layout?: CanvasLayout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataQueries?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    components: any[];
    theme?: CanvasThemeForRenderer;
}

export interface CanvasDataContextValue {
    /** Query results keyed by query ID */
    queries: Record<string, unknown>;
    /** Current filter values keyed by filter ID */
    filters: Record<string, unknown>;
    /** Set a filter value */
    setFilter: (filterId: string, value: unknown) => void;
    /** Trigger a data refresh */
    onRefresh?: () => void;
    /** Theme configuration */
    theme?: CanvasThemeForRenderer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export const CanvasDataContext = React.createContext<CanvasDataContextValue>({
    queries: {},
    filters: {},
    setFilter: () => {},
    theme: undefined
});

export function useCanvasData() {
    return React.useContext(CanvasDataContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Renderer
// ─────────────────────────────────────────────────────────────────────────────

export interface CanvasRendererProps {
    schema: CanvasSchemaForRenderer;
    data: Record<string, unknown>;
    onRefresh?: () => void;
    className?: string;
}

// Map border radius tokens to CSS values
const RADIUS_MAP: Record<string, string> = {
    none: "0px",
    sm: "0.25rem",
    md: "0.45rem",
    lg: "0.75rem",
    xl: "1rem"
};

// Map density tokens to padding multipliers
const DENSITY_PADDING: Record<string, number> = {
    compact: 3,
    default: 4,
    spacious: 6
};

function buildThemeStyle(theme?: CanvasThemeForRenderer): React.CSSProperties {
    if (!theme) return {};
    const vars: Record<string, string> = {};

    if (theme.primaryColor) vars["--canvas-primary"] = theme.primaryColor;
    if (theme.backgroundColor) vars["--canvas-bg"] = theme.backgroundColor;
    if (theme.cardBackground) vars["--canvas-card-bg"] = theme.cardBackground;
    if (theme.cardBorder) vars["--canvas-card-border"] = theme.cardBorder;
    if (theme.textColor) vars["--canvas-text"] = theme.textColor;
    if (theme.mutedTextColor) vars["--canvas-muted"] = theme.mutedTextColor;
    if (theme.borderRadius) vars["--canvas-radius"] = RADIUS_MAP[theme.borderRadius] || "0.45rem";

    // Set chart color overrides
    if (theme.chartColors) {
        theme.chartColors.forEach((color, idx) => {
            vars[`--chart-${idx + 1}`] = color;
        });
    }

    return vars as React.CSSProperties;
}

export function CanvasRenderer({ schema, data, onRefresh, className }: CanvasRendererProps) {
    const [filters, setFilters] = React.useState<Record<string, unknown>>({});

    const setFilter = React.useCallback((filterId: string, value: unknown) => {
        setFilters((prev) => ({ ...prev, [filterId]: value }));
    }, []);

    const contextValue = React.useMemo<CanvasDataContextValue>(
        () => ({
            queries: data,
            filters,
            setFilter,
            onRefresh,
            theme: schema.theme
        }),
        [data, filters, setFilter, onRefresh, schema.theme]
    );

    const layout = schema.layout || {};
    const columns = layout.columns || 12;
    const density = schema.theme?.density || "default";
    const gap = layout.gap ?? DENSITY_PADDING[density]!;
    const padding = layout.padding ?? DENSITY_PADDING[density]!;
    const maxWidth = layout.maxWidth || "1400px";
    const layoutType = layout.type || "grid";
    const themeStyles = buildThemeStyle(schema.theme);

    const visibleComponents = (schema.components || []).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => !c.hidden
    );

    return (
        <CanvasDataContext.Provider value={contextValue}>
            <div
                className={cn("mx-auto w-full", className)}
                style={{
                    maxWidth,
                    padding: `${padding * 4}px`,
                    ...themeStyles,
                    ...(schema.theme?.backgroundColor
                        ? { backgroundColor: schema.theme.backgroundColor }
                        : {}),
                    ...(schema.theme?.textColor ? { color: schema.theme.textColor } : {})
                }}
            >
                {/* Canvas title */}
                {schema.title && (
                    <div className="mb-6">
                        <h1 className="text-2xl font-semibold tracking-tight">{schema.title}</h1>
                        {schema.description && (
                            <p
                                className="mt-1 text-sm"
                                style={{
                                    color: schema.theme?.mutedTextColor || undefined
                                }}
                            >
                                {schema.description}
                            </p>
                        )}
                    </div>
                )}

                {/* Layout */}
                {layoutType === "grid" ? (
                    <div
                        className="canvas-grid grid"
                        style={{
                            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                            gap: `${gap * 4}px`
                        }}
                    >
                        {visibleComponents.map(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (component: any) => (
                                <div
                                    key={component.id}
                                    className="canvas-grid-cell"
                                    style={{
                                        gridColumn: `span ${Math.min(component.span || 12, columns)} / span ${Math.min(component.span || 12, columns)}`
                                    }}
                                >
                                    <CanvasBlock component={component} />
                                </div>
                            )
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col" style={{ gap: `${gap * 4}px` }}>
                        {visibleComponents.map(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (component: any) => (
                                <CanvasBlock key={component.id} component={component} />
                            )
                        )}
                    </div>
                )}
            </div>
        </CanvasDataContext.Provider>
    );
}
