"use client";

import { useCanvasData } from "./CanvasRenderer";

/**
 * Lightweight client-side expression resolver for canvas blocks.
 * Handles the common case of {{ queries.xxx }} data references.
 *
 * For full expression evaluation (functions, aggregations), the server
 * pre-resolves values. This hook handles runtime data binding.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useResolvedData(expression: string | undefined): any {
    const { queries, filters } = useCanvasData();

    if (!expression) return undefined;
    if (typeof expression !== "string") return expression;

    // Strip {{ }} wrapper
    const match = expression.match(/^\{\{\s*(.*?)\s*\}\}$/);
    if (!match) return expression;

    const path = match[1]!.trim();
    return resolvePath(path, { queries, filters });
}

/**
 * Resolve a single value expression - returns string/number for display.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useResolvedValue(expression: string | undefined): any {
    const { queries, filters } = useCanvasData();

    if (!expression) return undefined;
    if (typeof expression !== "string") return expression;

    const match = expression.match(/^\{\{\s*(.*?)\s*\}\}$/);
    if (!match) return expression;

    const path = match[1]!.trim();

    // Handle simple function calls client-side
    const funcMatch = path.match(/^(\w+)\(([\s\S]*)\)$/);
    if (funcMatch) {
        const funcName = funcMatch[1]!;
        const argsStr = funcMatch[2]!;
        return evaluateClientFunction(funcName, argsStr, { queries, filters });
    }

    return resolvePath(path, { queries, filters });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolvePath(path: string, context: Record<string, any>): any {
    const parts = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = context;
    for (const part of parts) {
        if (current == null) return undefined;
        const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (bracketMatch) {
            current = current[bracketMatch[1]!];
            if (Array.isArray(current)) {
                current = current[parseInt(bracketMatch[2]!, 10)];
            }
        } else {
            current = current[part];
        }
    }
    return current;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function evaluateClientFunction(name: string, argsStr: string, context: Record<string, any>): any {
    // Parse first argument as a data reference
    const args = argsStr.split(",").map((s) => s.trim());
    const firstArg = args[0];
    const secondArg = args[1];

    // Resolve first arg as path, second as string literal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = firstArg
        ? resolvePath(firstArg.replace(/^["']|["']$/g, ""), context)
        : undefined;
    const key = secondArg ? secondArg.replace(/^["']|["']$/g, "") : undefined;

    if (
        !Array.isArray(data) &&
        name !== "if" &&
        name !== "formatCurrency" &&
        name !== "formatNumber"
    ) {
        // Try as expression
        if (firstArg) {
            const resolved = resolvePath(firstArg, context);
            if (Array.isArray(resolved)) data = resolved;
        }
    }

    switch (name) {
        case "sum": {
            if (!Array.isArray(data)) return 0;
            return data.reduce((acc: number, item: unknown) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const val = key ? (item as any)?.[key] : item;
                return acc + (Number(val) || 0);
            }, 0);
        }
        case "count":
            return Array.isArray(data) ? data.length : 0;
        case "avg": {
            if (!Array.isArray(data) || data.length === 0) return 0;
            const total = data.reduce((acc: number, item: unknown) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const val = key ? (item as any)?.[key] : item;
                return acc + (Number(val) || 0);
            }, 0);
            return total / data.length;
        }
        case "min": {
            if (!Array.isArray(data) || data.length === 0) return 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const vals = data.map((item: any) => Number(key ? item?.[key] : item) || 0);
            return Math.min(...vals);
        }
        case "max": {
            if (!Array.isArray(data) || data.length === 0) return 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const vals = data.map((item: any) => Number(key ? item?.[key] : item) || 0);
            return Math.max(...vals);
        }
        case "formatCurrency": {
            const num = Number(data);
            if (isNaN(num)) return String(data);
            return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                num
            );
        }
        case "formatNumber": {
            const num = Number(data);
            if (isNaN(num)) return String(data);
            return new Intl.NumberFormat("en-US").format(num);
        }
        case "formatPercent": {
            const num = Number(data);
            if (isNaN(num)) return String(data);
            return `${(num * 100).toFixed(1)}%`;
        }
        default:
            return data;
    }
}

/**
 * Format a value based on a column format type.
 */
export function formatValue(
    value: unknown,
    format?: string,
    prefix?: string,
    suffix?: string
): string {
    if (value == null) return "";

    let formatted: string;

    switch (format) {
        case "currency":
            formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD"
            }).format(Number(value) || 0);
            break;
        case "percent":
            formatted = `${(Number(value) * 100).toFixed(1)}%`;
            break;
        case "number":
            formatted = new Intl.NumberFormat("en-US").format(Number(value) || 0);
            break;
        case "date":
            try {
                formatted = new Date(value as string).toLocaleDateString();
            } catch {
                formatted = String(value);
            }
            break;
        case "datetime":
            try {
                formatted = new Date(value as string).toLocaleString();
            } catch {
                formatted = String(value);
            }
            break;
        case "boolean":
            formatted = value ? "Yes" : "No";
            break;
        default:
            formatted = String(value);
    }

    return `${prefix || ""}${formatted}${suffix || ""}`;
}
