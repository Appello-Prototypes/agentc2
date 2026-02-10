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

export interface CanvasSchemaForRenderer {
    title: string;
    description?: string;
    layout?: CanvasLayout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataQueries?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    components: any[];
    theme?: {
        primaryColor?: string;
        backgroundColor?: string;
    };
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export const CanvasDataContext = React.createContext<CanvasDataContextValue>({
    queries: {},
    filters: {},
    setFilter: () => {}
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
            onRefresh
        }),
        [data, filters, setFilter, onRefresh]
    );

    const layout = schema.layout || {};
    const columns = layout.columns || 12;
    const gap = layout.gap ?? 4;
    const padding = layout.padding ?? 4;
    const maxWidth = layout.maxWidth || "1400px";
    const layoutType = layout.type || "grid";

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
                    ...(schema.theme?.backgroundColor
                        ? { backgroundColor: schema.theme.backgroundColor }
                        : {})
                }}
            >
                {/* Canvas title */}
                {schema.title && (
                    <div className="mb-6">
                        <h1 className="text-2xl font-semibold tracking-tight">{schema.title}</h1>
                        {schema.description && (
                            <p className="text-muted-foreground mt-1 text-sm">
                                {schema.description}
                            </p>
                        )}
                    </div>
                )}

                {/* Layout */}
                {layoutType === "grid" ? (
                    <div
                        className="grid"
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
