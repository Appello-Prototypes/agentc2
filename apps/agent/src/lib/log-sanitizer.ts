/**
 * Log Sanitizer
 *
 * Redacts PII patterns and truncates conversation content from log output.
 * Addresses PIPEDA Principle 4 (Limiting Collection) and Principle 5
 * (Limiting Use, Disclosure, and Retention).
 *
 * Usage:
 *   import { sanitizeForLog } from "@/lib/log-sanitizer";
 *   console.error("[MyRoute] Error:", sanitizeForLog(error));
 *   console.log("[MyRoute] Request body:", sanitizeForLog(body));
 */

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        replacement: "[EMAIL_REDACTED]"
    },
    {
        pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
        replacement: "[PHONE_REDACTED]"
    },
    {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        replacement: "[SSN_REDACTED]"
    },
    {
        pattern:
            /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
        replacement: "[CARD_REDACTED]"
    },
    {
        pattern: /\b[A-Z]{2}\d{6,9}\b/g,
        replacement: "[ID_REDACTED]"
    }
];

const SENSITIVE_KEYS = new Set([
    "password",
    "secret",
    "token",
    "apiKey",
    "api_key",
    "authorization",
    "credential",
    "ssn",
    "socialSecurity",
    "creditCard",
    "cardNumber"
]);

/**
 * Redact PII patterns and truncate conversation content for safe logging.
 *
 * @param data - Any value to sanitize (string, object, Error, etc.)
 * @param maxLength - Maximum output length (default 500 chars)
 * @returns Sanitized string safe for logging
 */
export function sanitizeForLog(data: unknown, maxLength = 500): string {
    if (data === null || data === undefined) return String(data);

    let text: string;

    if (data instanceof Error) {
        text = `${data.name}: ${data.message}`;
    } else if (typeof data === "string") {
        text = data;
    } else if (typeof data === "object") {
        try {
            text = JSON.stringify(data, sensitizeReplacer, 0);
        } catch {
            text = String(data);
        }
    } else {
        text = String(data);
    }

    for (const { pattern, replacement } of PII_PATTERNS) {
        // Reset lastIndex for global regex patterns
        pattern.lastIndex = 0;
        text = text.replace(pattern, replacement);
    }

    if (text.length > maxLength) {
        text = text.slice(0, maxLength) + "...[truncated]";
    }

    return text;
}

/**
 * JSON.stringify replacer that redacts sensitive keys.
 */
function sensitizeReplacer(key: string, value: unknown): unknown {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        return "[REDACTED]";
    }
    // Truncate long string values (e.g., conversation content)
    if (typeof value === "string" && value.length > 200) {
        return value.slice(0, 200) + "...[truncated]";
    }
    return value;
}

/**
 * Create a sanitized error object for structured logging.
 */
export function sanitizeError(error: unknown): {
    name: string;
    message: string;
    stack?: string;
} {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: sanitizeForLog(error.message, 300),
            stack: error.stack
                ? sanitizeForLog(error.stack.split("\n").slice(0, 3).join("\n"), 500)
                : undefined
        };
    }
    return {
        name: "UnknownError",
        message: sanitizeForLog(error, 300)
    };
}
