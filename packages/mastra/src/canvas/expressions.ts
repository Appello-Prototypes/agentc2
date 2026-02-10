/**
 * Canvas Expression Engine
 *
 * Safely evaluates template expressions like:
 *   {{ queries.deals }}
 *   {{ sum(queries.deals, 'amount') }}
 *   {{ count(queries.contacts) }}
 *   {{ formatCurrency(sum(queries.deals, 'amount')) }}
 *   {{ if(count(queries.deals) > 0, 'Active', 'No deals') }}
 *
 * Security: Uses a whitelist of allowed functions. No eval/Function constructor.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface ExpressionContext {
    queries: Record<string, unknown>;
    filters?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * Resolve all expressions in a value. If the value contains `{{ ... }}`,
 * the expression is evaluated. Otherwise the value is returned as-is.
 */
export function resolveExpression(template: string, context: ExpressionContext): unknown {
    if (typeof template !== "string") return template;

    // Check if the entire string is a single expression
    const fullMatch = template.match(/^\{\{\s*(.*?)\s*\}\}$/);
    if (fullMatch) {
        return evaluate(fullMatch[1]!, context);
    }

    // Check for embedded expressions (string interpolation)
    if (template.includes("{{")) {
        return template.replace(/\{\{\s*(.*?)\s*\}\}/g, (_match, expr) => {
            const result = evaluate(expr, context);
            return result == null ? "" : String(result);
        });
    }

    return template;
}

/**
 * Deep-resolve all expression strings in an object tree.
 */
export function resolveExpressions<T>(obj: T, context: ExpressionContext): T {
    if (typeof obj === "string") {
        return resolveExpression(obj, context) as T;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => resolveExpressions(item, context)) as T;
    }
    if (obj !== null && typeof obj === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            result[key] = resolveExpressions(value, context);
        }
        return result as T;
    }
    return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core evaluator
// ─────────────────────────────────────────────────────────────────────────────

function evaluate(expression: string, context: ExpressionContext): unknown {
    const trimmed = expression.trim();

    // Try to parse as function call: funcName(args...)
    const funcMatch = trimmed.match(/^(\w+)\(([\s\S]*)\)$/);
    if (funcMatch) {
        const funcName = funcMatch[1]!;
        const argsStr = funcMatch[2]!;
        const func = FUNCTIONS[funcName];
        if (func) {
            const args = parseArguments(argsStr, context);
            return func(...args);
        }
    }

    // Try comparison operators for conditionals
    if (
        trimmed.includes(" > ") ||
        trimmed.includes(" < ") ||
        trimmed.includes(" === ") ||
        trimmed.includes(" >= ") ||
        trimmed.includes(" <= ") ||
        trimmed.includes(" !== ")
    ) {
        return evaluateComparison(trimmed, context);
    }

    // Try arithmetic: a + b, a - b, a * b, a / b
    const arithMatch = trimmed.match(/^(.+?)\s*([+\-*/])\s*(.+)$/);
    if (arithMatch) {
        const left = evaluate(arithMatch[1]!, context);
        const right = evaluate(arithMatch[3]!, context);
        if (typeof left === "number" && typeof right === "number") {
            switch (arithMatch[2]) {
                case "+":
                    return left + right;
                case "-":
                    return left - right;
                case "*":
                    return left * right;
                case "/":
                    return right !== 0 ? left / right : 0;
            }
        }
    }

    // Try property access: queries.deals, queries.deals.length
    if (trimmed.includes(".")) {
        return resolvePropertyPath(trimmed, context);
    }

    // Try numeric literal
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== "") return num;

    // Try string literal (single or double quoted)
    const strMatch = trimmed.match(/^["'](.*)["']$/);
    if (strMatch) return strMatch[1];

    // Try boolean
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null" || trimmed === "undefined") return null;

    // Try as simple variable name
    if (trimmed in context) return context[trimmed];

    return trimmed;
}

function evaluateComparison(expr: string, context: ExpressionContext): boolean {
    const ops = [" >= ", " <= ", " !== ", " === ", " > ", " < "];
    for (const op of ops) {
        const idx = expr.indexOf(op);
        if (idx !== -1) {
            const left = evaluate(expr.slice(0, idx), context);
            const right = evaluate(expr.slice(idx + op.length), context);
            const l = typeof left === "number" ? left : Number(left);
            const r = typeof right === "number" ? right : Number(right);
            switch (op.trim()) {
                case ">":
                    return l > r;
                case "<":
                    return l < r;
                case ">=":
                    return l >= r;
                case "<=":
                    return l <= r;
                case "===":
                    return left === right;
                case "!==":
                    return left !== right;
            }
        }
    }
    return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property path resolution (e.g., "queries.deals" or "queries.deals.length")
// ─────────────────────────────────────────────────────────────────────────────

function resolvePropertyPath(path: string, context: ExpressionContext): unknown {
    const parts = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = context;

    for (const part of parts) {
        if (current == null) return undefined;
        // Support array indexing: items[0]
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

// ─────────────────────────────────────────────────────────────────────────────
// Argument parser for function calls
// ─────────────────────────────────────────────────────────────────────────────

function parseArguments(argsStr: string, context: ExpressionContext): unknown[] {
    const args: unknown[] = [];
    let depth = 0;
    let current = "";
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < argsStr.length; i++) {
        const ch = argsStr[i]!;

        if (inString) {
            current += ch;
            if (ch === stringChar && argsStr[i - 1] !== "\\") {
                inString = false;
            }
            continue;
        }

        if (ch === '"' || ch === "'") {
            inString = true;
            stringChar = ch;
            current += ch;
            continue;
        }

        if (ch === "(") {
            depth++;
            current += ch;
            continue;
        }

        if (ch === ")") {
            depth--;
            current += ch;
            continue;
        }

        if (ch === "," && depth === 0) {
            args.push(evaluate(current.trim(), context));
            current = "";
            continue;
        }

        current += ch;
    }

    if (current.trim()) {
        args.push(evaluate(current.trim(), context));
    }

    return args;
}

// ─────────────────────────────────────────────────────────────────────────────
// Whitelisted functions
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const FUNCTIONS: Record<string, (...args: any[]) => unknown> = {
    // Aggregation
    sum: (arr: any[], key?: string) => {
        if (!Array.isArray(arr)) return 0;
        return arr.reduce((acc, item) => {
            const val = key ? getNestedValue(item, key) : item;
            return acc + (typeof val === "number" ? val : Number(val) || 0);
        }, 0);
    },
    count: (arr: any[]) => {
        if (!Array.isArray(arr)) return 0;
        return arr.length;
    },
    avg: (arr: any[], key?: string) => {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const total = FUNCTIONS.sum!(arr, key) as number;
        return total / arr.length;
    },
    min: (arr: any[], key?: string) => {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const values = arr.map((item) => {
            const val = key ? getNestedValue(item, key) : item;
            return typeof val === "number" ? val : Number(val) || 0;
        });
        return Math.min(...values);
    },
    max: (arr: any[], key?: string) => {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const values = arr.map((item) => {
            const val = key ? getNestedValue(item, key) : item;
            return typeof val === "number" ? val : Number(val) || 0;
        });
        return Math.max(...values);
    },

    // Transformations
    filter: (arr: any[], key: string, value: any) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter((item) => getNestedValue(item, key) === value);
    },
    groupBy: (arr: any[], key: string) => {
        if (!Array.isArray(arr)) return {};
        const groups: Record<string, any[]> = {};
        for (const item of arr) {
            const groupKey = String(getNestedValue(item, key) ?? "unknown");
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey]!.push(item);
        }
        // Return as array of { key, items, count } for chart compatibility
        return Object.entries(groups).map(([k, items]) => ({
            key: k,
            name: k,
            items,
            count: items.length,
            value: items.length
        }));
    },
    sortBy: (arr: any[], key: string, direction: string = "asc") => {
        if (!Array.isArray(arr)) return [];
        return [...arr].sort((a, b) => {
            const aVal = getNestedValue(a, key) as string | number;
            const bVal = getNestedValue(b, key) as string | number;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return direction === "desc" ? -cmp : cmp;
        });
    },
    first: (arr: any[]) => {
        if (!Array.isArray(arr)) return null;
        return arr[0] ?? null;
    },
    last: (arr: any[]) => {
        if (!Array.isArray(arr)) return null;
        return arr[arr.length - 1] ?? null;
    },
    take: (arr: any[], n: number) => {
        if (!Array.isArray(arr)) return [];
        return arr.slice(0, n);
    },
    skip: (arr: any[], n: number) => {
        if (!Array.isArray(arr)) return [];
        return arr.slice(n);
    },
    map: (arr: any[], key: string) => {
        if (!Array.isArray(arr)) return [];
        return arr.map((item) => getNestedValue(item, key));
    },
    flatten: (arr: any[]) => {
        if (!Array.isArray(arr)) return [];
        return arr.flat();
    },
    unique: (arr: any[], key?: string) => {
        if (!Array.isArray(arr)) return [];
        if (key) {
            const seen = new Set();
            return arr.filter((item) => {
                const val = getNestedValue(item, key);
                if (seen.has(val)) return false;
                seen.add(val);
                return true;
            });
        }
        return [...new Set(arr)];
    },
    reduce: (arr: any[], key: string, initial: number = 0) => {
        if (!Array.isArray(arr)) return initial;
        return arr.reduce((acc, item) => acc + (Number(getNestedValue(item, key)) || 0), initial);
    },

    // Formatting
    formatCurrency: (value: any, currency: string = "USD", locale: string = "en-US") => {
        const num = Number(value);
        if (isNaN(num)) return String(value);
        return new Intl.NumberFormat(locale, { style: "currency", currency }).format(num);
    },
    formatNumber: (value: any, decimals: number = 0, locale: string = "en-US") => {
        const num = Number(value);
        if (isNaN(num)) return String(value);
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    },
    formatPercent: (value: any, decimals: number = 1) => {
        const num = Number(value);
        if (isNaN(num)) return String(value);
        return `${(num * 100).toFixed(decimals)}%`;
    },
    formatDate: (value: any, locale: string = "en-US") => {
        try {
            return new Date(value as string).toLocaleDateString(locale);
        } catch {
            return String(value);
        }
    },
    formatDateTime: (value: any, locale: string = "en-US") => {
        try {
            return new Date(value as string).toLocaleString(locale);
        } catch {
            return String(value);
        }
    },

    // Conditionals
    if: (condition: any, trueValue: any, falseValue: any = null) => {
        return condition ? trueValue : falseValue;
    },

    // Math
    round: (value: any, decimals: number = 0) => {
        const num = Number(value);
        if (isNaN(num)) return 0;
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
    },
    abs: (value: any) => Math.abs(Number(value) || 0),
    ceil: (value: any) => Math.ceil(Number(value) || 0),
    floor: (value: any) => Math.floor(Number(value) || 0),

    // String
    lowercase: (value: any) => String(value).toLowerCase(),
    uppercase: (value: any) => String(value).toUpperCase(),
    capitalize: (value: any) => {
        const str = String(value);
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    concat: (...args: any[]) => args.map(String).join(""),
    join: (arr: any[], separator: string = ", ") => {
        if (!Array.isArray(arr)) return String(arr);
        return arr.join(separator);
    },

    // Object access
    keys: (obj: any) => (obj && typeof obj === "object" ? Object.keys(obj) : []),
    values: (obj: any) => (obj && typeof obj === "object" ? Object.values(obj) : []),
    entries: (obj: any) =>
        obj && typeof obj === "object"
            ? Object.entries(obj).map(([k, v]) => ({ key: k, value: v }))
            : [],

    // JSON
    toJson: (value: any) => JSON.stringify(value, null, 2),
    parseJson: (value: any) => {
        try {
            return JSON.parse(String(value));
        } catch {
            return null;
        }
    }
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
    if (obj == null) return undefined;
    const parts = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = obj;
    for (const part of parts) {
        if (current == null) return undefined;
        current = current[part];
    }
    return current;
}
